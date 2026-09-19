import { createHash } from 'node:crypto';
import { config } from '../../config.ts';
import type { PreparationRepository } from './PreparationRepository.ts';
import type { PreparationRun } from './PreparationRun.ts';
import type { PreparationQueue, RewritableCardField } from './PreparationQueue.ts';
import {
  PreparationInputIncomplete,
  PreparationRateLimited,
  ProductNotFound,
} from './ProductErrors.ts';
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
    const product = await this.products.findById(productId);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    const readsFrames = request.scope === 'texts' || request.scope === 'both';
    const readsTitles = request.scope === 'price' || request.scope === 'both';
    if (readsFrames && product.images.length === 0) {
      throw new PreparationInputIncomplete('gallery');
    }
    if (request.scope === 'price' && product.titleProm === '' && product.titleOlx === '') {
      throw new PreparationInputIncomplete('title');
    }

    // 20 runs of a card per hour, whatever their scope (T24 decision 3).
    if ((await this.runs.countRecentRuns(productId, 60 * 60)) >= 20) {
      throw new PreparationRateLimited();
    }

    // The key names the input the run reads, so a changed input starts a new run and an unchanged
    // one returns the run it already has.
    const input = {
      frames: readsFrames
        ? [...product.images]
            .sort((left, right) => left.position - right.position)
            .map((image) => [image.id, image.isMain])
        : null,
      titles: readsTitles ? [product.titleProm, product.titleOlx] : null,
      field: request.scope === 'field' ? [request.field, request.draftText] : null,
    };
    const inputVersion = createHash('sha256').update(JSON.stringify(input)).digest('hex');

    const claim = await this.runs.createRunOnce({
      productId,
      scope: request.scope,
      idempotencyKey: `${productId}:${request.scope}:${inputVersion}`,
      model: config.ai.model,
    });
    if (claim.created) {
      await this.queue.enqueue({ runId: claim.run.id, productId, ...request });
    }
    return claim;
  }

  /** A run looked up through another card is answered as missing, like the card itself would be. */
  async getRun(productId: string, runId: string): Promise<PreparationRun> {
    const run = await this.runs.findRun(productId, runId);
    if (run === null) {
      throw new ProductNotFound(productId);
    }
    return run;
  }
}
