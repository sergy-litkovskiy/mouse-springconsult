import { config } from '../../config.ts';
import type { MediaService } from '../media/index.ts';
import {
  ProductNotFound,
  type PreparationRepository,
  type Product,
  type ProductRepository,
  type SuggestionDraft,
  type SuggestionField,
} from '../products/index.ts';
import type { AnthropicAdapter, PriceResult, RewritableField } from './AnthropicAdapter.ts';

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

const SUGGESTION_FIELDS: Record<RewritableField, SuggestionField> = {
  titleProm: 'title_prom',
  titleOlx: 'title_olx',
  descriptionProm: 'description_prom',
  descriptionOlx: 'description_olx',
  seoKeywords: 'seo_keywords',
};

function priceQuery(card: Product): string {
  // Text columns are NOT NULL with '' as the default, so "absent" in AC-27 is an empty string.
  const title = card.titleProm !== '' ? card.titleProm : card.titleOlx;
  const description = card.descriptionProm !== '' ? card.descriptionProm : card.descriptionOlx;
  return description !== '' ? `${title} ${description}` : title;
}

export class PreparationService {
  constructor(
    private readonly adapter: AnthropicAdapter,
    private readonly runs: PreparationRepository,
    private readonly products: ProductRepository,
    private readonly media: MediaService,
  ) {}

  async prepare(job: PreparationJob): Promise<void> {
    if (!(await this.runs.startRun(job.runId))) {
      return;
    }

    if (job.scope === 'field') {
      const rewrite = await this.adapter.rewriteField(job.field, job.draftText);
      await this.runs.recordUsage(job.runId, rewrite.usage);
      await this.runs.finishRun(job.runId, {
        status: 'succeeded',
        suggestions: [{ field: SUGGESTION_FIELDS[job.field], value: rewrite.value }],
      });
      return;
    }

    const card = await this.products.findById(job.productId);
    if (card === null) {
      throw new ProductNotFound(job.productId);
    }

    const suggestions: SuggestionDraft[] = [];

    if (job.scope === 'texts' || job.scope === 'both') {
      const texts = await this.adapter.generateTexts(await this.readRecognitionFrames(card));
      await this.runs.recordUsage(job.runId, texts.usage);
      suggestions.push(
        { field: 'description_prom', value: texts.descriptionProm },
        { field: 'description_olx', value: texts.descriptionOlx },
        { field: 'seo_keywords', value: texts.seoKeywords },
      );
    }

    if (job.scope === 'price' || job.scope === 'both') {
      let price: PriceResult;
      try {
        price = await this.adapter.findPriceRange(priceQuery(card));
      } catch {
        // The texts already paid for stay with the run; only the price is reported missing.
        await this.runs.finishRun(job.runId, {
          status: 'failed',
          errorCode: 'price_unavailable',
          suggestions,
        });
        return;
      }
      await this.runs.recordUsage(job.runId, price.usage);
      suggestions.push({
        field: 'price',
        value: { priceFrom: price.priceFrom, priceTo: price.priceTo },
      });
    }

    await this.runs.finishRun(job.runId, { status: 'succeeded', suggestions });
  }

  /**
   * Called by the worker once the last retry of a job has failed: without it the run would stay
   * `running`, and the polling client would never learn that the preparation did not happen.
   */
  async abandon(runId: string): Promise<void> {
    await this.runs.finishRun(runId, {
      status: 'failed',
      errorCode: 'preparation_failed',
      suggestions: [],
    });
  }

  private async readRecognitionFrames(card: Product): Promise<Uint8Array[]> {
    // The main frame goes first: recognition leans on it, and the ceiling may cut the rest.
    const gallery = [
      ...card.images.filter((image) => image.isMain),
      ...card.images.filter((image) => !image.isMain),
    ].slice(0, config.ai.maxFramesPerRequest);
    const frames: Uint8Array[] = [];
    for (const image of gallery) {
      frames.push(await this.media.read(image.r2Key));
    }
    return frames;
  }
}
