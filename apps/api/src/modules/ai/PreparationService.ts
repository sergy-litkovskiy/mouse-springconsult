import type { MediaService } from '../media/index.ts';
import type { PreparationRepository, ProductRepository } from '../products/index.ts';
import type { AnthropicAdapter, RewritableField } from './AnthropicAdapter.ts';

export type PreparationJob =
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'texts' | 'price' | 'both';
    }
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'field';
      readonly field: RewritableField;
      readonly draftText: string;
    };

export class PreparationService {
  constructor(
    private readonly adapter: AnthropicAdapter,
    private readonly runs: PreparationRepository,
    private readonly products: ProductRepository,
    private readonly media: MediaService,
  ) {}

  async prepare(job: PreparationJob): Promise<void> {
    throw new Error('Not implemented');
  }
}
