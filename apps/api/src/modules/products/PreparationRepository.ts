import { In, IsNull, Not, type DataSource } from 'typeorm';
import {
  FieldSuggestion,
  type SuggestionField,
  type SuggestionResolution,
  type SuggestionValue,
} from './FieldSuggestion.ts';
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
      readonly suggestions: readonly SuggestionDraft[];
    };

export type TokenTotals = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type RunClaim = {
  readonly run: PreparationRun;
  /** `false` when a run with the same idempotency key already existed and was returned instead. */
  readonly created: boolean;
};

const UNFINISHED: PreparationStatus[] = ['queued', 'running'];

/**
 * A failed run guards nothing, so it stops answering for its key: the UNIQUE index leaves it out
 * as well, and the same input starts a new run instead of reading the failure back.
 */
const NOT_FAILED = Not<PreparationStatus>('failed');

export class PreparationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createRun(draft: PreparationRunDraft): Promise<PreparationRun> {
    const runs = this.dataSource.getRepository(PreparationRun);
    return runs.save(
      runs.create({
        ...draft,
        status: 'queued',
        errorCode: null,
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
    const inserted = await runs
      .createQueryBuilder()
      .insert()
      .values({
        ...draft,
        status: 'queued',
        errorCode: null,
        inputTokens: 0,
        outputTokens: 0,
        startedAt: null,
        finishedAt: null,
      })
      .orIgnore()
      .execute();
    const run = await runs.findOneByOrFail({
      idempotencyKey: draft.idempotencyKey,
      status: NOT_FAILED,
    });
    return { run, created: (inserted.raw as unknown[]).length > 0 };
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
      .findOneBy({ idempotencyKey, status: NOT_FAILED });
  }

  async findRun(productId: string, runId: string): Promise<PreparationRun | null> {
    return this.dataSource.getRepository(PreparationRun).findOneBy({ id: runId, productId });
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

  /** One transaction: a run is never seen finished without its suggestions (AC-28). */
  async finishRun(runId: string, outcome: RunOutcome): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (outcome.suggestions.length > 0) {
        await manager
          .getRepository(FieldSuggestion)
          .insert(outcome.suggestions.map(({ field, value }) => ({ runId, field, value })));
      }
      await manager.getRepository(PreparationRun).update(
        { id: runId, status: In(UNFINISHED) },
        {
          status: outcome.status,
          errorCode: outcome.status === 'failed' ? outcome.errorCode : null,
          finishedAt: new Date(),
        },
      );
    });
  }

  /** Oldest first: the check on reading a card takes the latest suggestion of each field. */
  async findSuggestions(productId: string): Promise<FieldSuggestion[]> {
    return this.dataSource
      .getRepository(FieldSuggestion)
      .createQueryBuilder('suggestion')
      .innerJoin(PreparationRun, 'run', 'run.id = suggestion.runId')
      .where('run.productId = :productId', { productId })
      .orderBy('suggestion.createdAt', 'ASC')
      .addOrderBy('suggestion.id', 'ASC')
      .getMany();
  }

  async findSuggestion(productId: string, suggestionId: string): Promise<FieldSuggestion | null> {
    return this.dataSource
      .getRepository(FieldSuggestion)
      .createQueryBuilder('suggestion')
      .innerJoin(PreparationRun, 'run', 'run.id = suggestion.runId')
      .where('suggestion.id = :suggestionId', { suggestionId })
      .andWhere('run.productId = :productId', { productId })
      .getOne();
  }

  /**
   * `false` for a suggestion that already carries a decision: the condition is part of the update,
   * so two decisions racing each other end with exactly one of them recorded.
   */
  async resolveSuggestion(
    suggestionId: string,
    resolution: SuggestionResolution,
  ): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(FieldSuggestion)
      .update({ id: suggestionId, resolution: IsNull() }, { resolution, resolvedAt: new Date() });
    return (result.affected ?? 0) > 0;
  }

  async sumTokens(productId: string): Promise<TokenTotals> {
    // `sum` over int is bigint, which the driver hands over as a string; the cast keeps it a number.
    const totals = await this.dataSource
      .getRepository(PreparationRun)
      .createQueryBuilder('run')
      .select('coalesce(sum(run.inputTokens), 0)::int', 'inputTokens')
      .addSelect('coalesce(sum(run.outputTokens), 0)::int', 'outputTokens')
      .where('run.productId = :productId', { productId })
      .getRawOne<TokenTotals>();
    return totals ?? { inputTokens: 0, outputTokens: 0 };
  }
}
