import type { PreparationRepository } from './PreparationRepository.ts';
import type { PreparationRun } from './PreparationRun.ts';
import type { PreparationQueue, RewritableCardField } from './PreparationQueue.ts';
import type { ProductRepository } from './ProductRepository.ts';

export type PreparationRequest =
  | { readonly scope: 'texts' | 'price' | 'both' }
  | { readonly scope: 'field'; readonly field: RewritableCardField; readonly draftText: string };

export type PreparationStart = {
  readonly run: PreparationRun;
  /** `false` when the same input already had a run, which is returned instead of a new one. */
  readonly created: boolean;
};

export class PreparationRunService {
  constructor(
    private readonly products: ProductRepository,
    private readonly runs: PreparationRepository,
    private readonly queue: PreparationQueue,
  ) {}

  async start(productId: string, request: PreparationRequest): Promise<PreparationStart> {
    throw new Error('Not implemented');
  }

  async getRun(productId: string, runId: string): Promise<PreparationRun> {
    throw new Error('Not implemented');
  }
}
