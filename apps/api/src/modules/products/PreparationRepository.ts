import type { DataSource } from 'typeorm';
import { FieldSuggestion, type SuggestionField, type SuggestionValue } from './FieldSuggestion.ts';
import {
  PreparationRun,
  type PreparationErrorCode,
  type PreparationScope,
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

  async startRun(runId: string): Promise<void> {
    await this.dataSource
      .getRepository(PreparationRun)
      .update({ id: runId }, { status: 'running', startedAt: new Date() });
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
        { id: runId },
        {
          status: outcome.status,
          errorCode: outcome.status === 'failed' ? outcome.errorCode : null,
          finishedAt: new Date(),
        },
      );
    });
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
