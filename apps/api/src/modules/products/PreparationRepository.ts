import type { DataSource } from 'typeorm';
import type { SuggestionField, SuggestionValue } from './FieldSuggestion.ts';
import type { PreparationRun, PreparationScope } from './PreparationRun.ts';

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
      readonly errorCode: string;
      readonly suggestions: readonly SuggestionDraft[];
    };

export type TokenTotals = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export class PreparationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createRun(draft: PreparationRunDraft): Promise<PreparationRun> {
    throw new Error('Not implemented');
  }

  async startRun(runId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async recordUsage(runId: string, usage: CallUsage): Promise<void> {
    throw new Error('Not implemented');
  }

  async finishRun(runId: string, outcome: RunOutcome): Promise<void> {
    throw new Error('Not implemented');
  }

  async sumTokens(productId: string): Promise<TokenTotals> {
    throw new Error('Not implemented');
  }
}
