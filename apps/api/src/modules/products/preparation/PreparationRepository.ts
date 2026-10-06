import { In, type DataSource } from 'typeorm';
import { FieldSuggestion, type SuggestionField, type SuggestionValue } from './FieldSuggestion.ts';
import {
  PreparationRun,
  type PreparationErrorCode,
  type PreparationScope,
  type PreparationStatus,
} from './PreparationRun.ts';

export type PreparationRunDraft = {
  readonly productId: string;
  readonly scope: PreparationScope;
  readonly idempotencyKey: string;
  readonly model: string;
};

export type SuggestionDraft = {
  readonly field: SuggestionField;
  readonly value: SuggestionValue;
};

export type CallUsage = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type RunOutcome =
  | { readonly status: 'succeeded'; readonly suggestions: readonly SuggestionDraft[] }
  | {
      readonly status: 'failed';
      readonly errorCode: PreparationErrorCode;
      readonly errorDetail: string;
      readonly suggestions: readonly SuggestionDraft[];
    };

export type TokenTotals = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

/** Tokens of one model summed across every run of the card, so pricing it is one lookup per model. */
export type ModelTokenTotals = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type RunClaim = {
  readonly run: PreparationRun;
  /** `false` when a run with the same idempotency key already existed and was returned instead. */
  readonly created: boolean;
};

/**
 * Only a run still going answers for its key, and the UNIQUE index covers exactly these: once a run
 * has finished, either way, the same input starts a new one.
 */
const UNFINISHED: PreparationStatus[] = ['queued', 'running'];

export class PreparationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createRun(draft: PreparationRunDraft): Promise<PreparationRun> {
    const runs = this.dataSource.getRepository(PreparationRun);
    return runs.save(
      runs.create({
        ...draft,
        status: 'queued',
        errorCode: null,
        errorDetail: null,
        inputTokens: 0,
        outputTokens: 0,
        startedAt: null,
        finishedAt: null,
      }),
    );
  }

  /**
   * `ON CONFLICT DO NOTHING` rather than a lookup first: two starts of the same input at once
   * would both miss the lookup, and the UNIQUE index is what settles which of them created the run.
   */
  async createRunOnce(draft: PreparationRunDraft): Promise<RunClaim> {
    const runs = this.dataSource.getRepository(PreparationRun);
    // Two passes, because the insert and the read after it are not one statement: the insert can be
    // ignored over a live run that then finishes — succeeded or failed — before the read, which
    // leaves the read with nothing. The second pass meets a key no row holds any more and inserts a
    // new run, the one a repeat asks for. Two misses in a row would mean the same run
    // finished twice, so there is nothing to wait for and the caller gets the error.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const inserted = await runs
        .createQueryBuilder()
        .insert()
        .values({
          ...draft,
          status: 'queued',
          errorCode: null,
          errorDetail: null,
          inputTokens: 0,
          outputTokens: 0,
          startedAt: null,
          finishedAt: null,
        })
        .orIgnore()
        .execute();
      const run = await runs.findOneBy({
        idempotencyKey: draft.idempotencyKey,
        status: In(UNFINISHED),
      });
      if (run !== null) {
        return { run, created: (inserted.raw as unknown[]).length > 0 };
      }
    }

    throw new Error(`run ${draft.idempotencyKey} finished twice between its insert and the read`);
  }

  async countRecentRuns(productId: string, windowSeconds: number): Promise<number> {
    return this.dataSource
      .getRepository(PreparationRun)
      .createQueryBuilder('run')
      .where('run.productId = :productId', { productId })
      .andWhere('run.createdAt > now() - make_interval(secs => :windowSeconds)', { windowSeconds })
      .getCount();
  }

  async findRunByKey(idempotencyKey: string): Promise<PreparationRun | null> {
    return this.dataSource
      .getRepository(PreparationRun)
      .findOneBy({ idempotencyKey, status: In(UNFINISHED) });
  }

  async findRun(productId: string, runId: string): Promise<PreparationRun | null> {
    return this.dataSource.getRepository(PreparationRun).findOneBy({ id: runId, productId });
  }

  async findFailedRuns(productId: string): Promise<PreparationRun[]> {
    return this.dataSource.getRepository(PreparationRun).find({
      where: { productId, status: 'failed' },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /**
   * `false` for a run that has already finished: pg-boss delivers a job again when the worker died
   * after the finishing commit but before acknowledging it, and that job must not pay twice.
   */
  async startRun(runId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(PreparationRun)
      .update({ id: runId, status: In(UNFINISHED) }, { status: 'running', startedAt: new Date() });
    return result.affected !== 0;
  }

  /** Adds in SQL rather than read-modify-write: a retried attempt pays again, and both bills count. */
  async recordUsage(runId: string, usage: CallUsage): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(PreparationRun)
      .set({
        model: usage.model,
        inputTokens: () => 'input_tokens + :inputTokens',
        outputTokens: () => 'output_tokens + :outputTokens',
      })
      .where('id = :runId', { runId })
      .setParameters({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens })
      .execute();
  }

  /**
   * One transaction: a run is never seen finished without its suggestions. Each suggestion
   * replaces the card's previous one for its field, and `created_at` moves to this generation.
   */
  async finishRun(runId: string, outcome: RunOutcome): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (outcome.suggestions.length > 0) {
        const { productId } = await manager
          .getRepository(PreparationRun)
          .findOneByOrFail({ id: runId });
        await manager
          .createQueryBuilder()
          .insert()
          .into(FieldSuggestion)
          .values(
            outcome.suggestions.map(({ field, value }) => ({ productId, runId, field, value })),
          )
          .orUpdate(['value', 'run_id', 'created_at'], ['product_id', 'field'])
          .execute();
      }
      await manager.getRepository(PreparationRun).update(
        { id: runId, status: In(UNFINISHED) },
        {
          status: outcome.status,
          errorCode: outcome.status === 'failed' ? outcome.errorCode : null,
          errorDetail: outcome.status === 'failed' ? outcome.errorDetail : null,
          finishedAt: new Date(),
        },
      );
    });
  }

  /**
   * The status guard is the same one `finishRun` carries, so the sweep and a handler that is
   * finishing the very same run at that moment cannot both write an outcome.
   */
  async closeStuckRuns(olderThanSeconds: number): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(PreparationRun)
      .set({
        status: 'failed',
        errorCode: 'preparation_failed',
        errorDetail: `Closed by the sweep: still unfinished after ${String(olderThanSeconds)}s`,
        finishedAt: new Date(),
      })
      .where('status in (:...unfinished)', { unfinished: UNFINISHED })
      .andWhere('created_at < now() - make_interval(secs => :olderThanSeconds)', {
        olderThanSeconds,
      })
      .execute();
    return result.affected ?? 0;
  }

  async findSuggestions(productId: string): Promise<FieldSuggestion[]> {
    return this.dataSource.getRepository(FieldSuggestion).find({
      where: { productId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /**
   * One row per model, so pricing a card is a lookup per model rather than per run; a card with
   * no runs comes back as an empty list, which the cost function then prices as "0.0000".
   */
  async sumTokensByModel(productId: string): Promise<ModelTokenTotals[]> {
    // `sum` over int is bigint, which the driver hands over as a string; the cast keeps it a number.
    return this.dataSource
      .getRepository(PreparationRun)
      .createQueryBuilder('run')
      .select('run.model', 'model')
      .addSelect('coalesce(sum(run.inputTokens), 0)::int', 'inputTokens')
      .addSelect('coalesce(sum(run.outputTokens), 0)::int', 'outputTokens')
      .where('run.productId = :productId', { productId })
      .groupBy('run.model')
      .orderBy('run.model', 'ASC')
      .getRawMany<ModelTokenTotals>();
  }
}
