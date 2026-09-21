import { createHash } from 'node:crypto';
import { config } from '../../config.ts';
import type { PreparationRepository } from './PreparationRepository.ts';
import type { PreparationRun } from './PreparationRun.ts';
import type { Product } from './Product.ts';
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

    // The key names the input the model actually receives (data-model.md, "версія входу"), so a
    // changed input starts a new run and an unchanged one returns the run it already has.
    const input = {
      frames: readsFrames ? recognitionFrameKeys(product) : null,
      priceQuery: readsTitles ? priceQueryInput(product) : null,
      field: request.scope === 'field' ? [request.field, request.draftText] : null,
    };
    const inputVersion = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const idempotencyKey = `${productId}:${request.scope}:${inputVersion}`;

    // A repeat of the same input costs nothing, so it is answered before the limit is counted.
    const existing = await this.runs.findRunByKey(idempotencyKey);
    if (existing === null) {
      const { maxRuns, windowSeconds } = config.rateLimit.preparation;
      if ((await this.runs.countRecentRuns(productId, windowSeconds)) >= maxRuns) {
        throw new PreparationRateLimited();
      }
    }

    const claim =
      existing === null
        ? await this.runs.createRunOnce({
            productId,
            scope: request.scope,
            idempotencyKey,
            model: config.ai.model,
          })
        : { run: existing, created: false };
    // The row and the job are two writes: a run still queued may have lost its send, and queueing
    // it again is safe because the job id is the run id.
    if (claim.run.status === 'queued') {
      await this.queue.enqueue({ runId: claim.run.id, productId, ...request });
    }
    return claim;
  }

  /** Newest first; an unknown card is answered as missing rather than as a card with no failures. */
  async listFailedRuns(productId: string): Promise<PreparationRun[]> {
    if ((await this.products.findById(productId)) === null) {
      throw new ProductNotFound(productId);
    }
    return this.runs.findFailedRuns(productId);
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

/** The frames the worker sends: the main one first, then gallery order, up to the per-call ceiling. */
function recognitionFrameKeys(product: Product): string[] {
  return [...product.images]
    .sort(
      (left, right) => Number(right.isMain) - Number(left.isMain) || left.position - right.position,
    )
    .slice(0, config.ai.maxFramesPerRequest)
    .map((image) => image.r2Key);
}

/** The AC-27 formula the worker builds its search from; '' is "absent" in NOT NULL text columns. */
function priceQueryInput(product: Product): [string, string] {
  return [
    product.titleProm !== '' ? product.titleProm : product.titleOlx,
    product.descriptionProm !== '' ? product.descriptionProm : product.descriptionOlx,
  ];
}
