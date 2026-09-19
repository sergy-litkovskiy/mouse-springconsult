import { config } from '../../config.ts';
import type { MediaService } from '../media/index.ts';
import {
  ProductNotFound,
  type PreparationRepository,
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

export class PreparationService {
  constructor(
    private readonly adapter: AnthropicAdapter,
    private readonly runs: PreparationRepository,
    private readonly products: ProductRepository,
    private readonly media: MediaService,
  ) {}

  async prepare(job: PreparationJob): Promise<void> {
    await this.runs.startRun(job.runId);

    if (job.scope === 'field') {
      const fields: Record<RewritableField, SuggestionField> = {
        titleProm: 'title_prom',
        titleOlx: 'title_olx',
        descriptionProm: 'description_prom',
        descriptionOlx: 'description_olx',
        seoKeywords: 'seo_keywords',
      };
      const rewrite = await this.adapter.rewriteField(job.field, job.draftText);
      await this.runs.recordUsage(job.runId, rewrite.usage);
      await this.runs.finishRun(job.runId, {
        status: 'succeeded',
        suggestions: [{ field: fields[job.field], value: rewrite.value }],
      });
      return;
    }

    const card = await this.products.findById(job.productId);
    if (card === null) {
      throw new ProductNotFound(job.productId);
    }

    const suggestions: SuggestionDraft[] = [];

    if (job.scope === 'texts' || job.scope === 'both') {
      // The main frame goes first: recognition leans on it, and the ceiling may cut the rest.
      const gallery = [
        ...card.images.filter((image) => image.isMain),
        ...card.images.filter((image) => !image.isMain),
      ].slice(0, config.ai.maxFramesPerRequest);
      const frames: Uint8Array[] = [];
      for (const image of gallery) {
        frames.push(await this.media.read(image.r2Key));
      }

      const texts = await this.adapter.generateTexts(frames);
      await this.runs.recordUsage(job.runId, texts.usage);
      suggestions.push(
        { field: 'description_prom', value: texts.descriptionProm },
        { field: 'description_olx', value: texts.descriptionOlx },
        { field: 'seo_keywords', value: texts.seoKeywords },
      );
    }

    if (job.scope === 'price' || job.scope === 'both') {
      // Text columns are NOT NULL with '' as the default, so "absent" in AC-27 is an empty string.
      const title = card.titleProm !== '' ? card.titleProm : card.titleOlx;
      const description = card.descriptionProm !== '' ? card.descriptionProm : card.descriptionOlx;
      const query = description !== '' ? `${title} ${description}` : title;

      let price: PriceResult;
      try {
        price = await this.adapter.findPriceRange(query);
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
}
