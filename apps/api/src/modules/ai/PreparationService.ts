import { config } from '../../config.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
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

function errorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, config.ai.errorDetailMaxLength);
}

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
      let value = rewrite.value;
      if ((job.field === 'titleProm' || job.field === 'titleOlx') && typeof value === 'string') {
        // A title column is a single varchar(200) line, whatever the model wrote (AC-61).
        const line = value.replace(/\s+/g, ' ').trim();
        value =
          line.length > productConstraints.titleMaxLength
            ? line
                .slice(0, productConstraints.titleMaxLength + 1)
                .replace(/\s\S*$/, '')
                .slice(0, productConstraints.titleMaxLength)
            : line;
      }
      await this.runs.finishRun(job.runId, {
        status: 'succeeded',
        suggestions: [{ field: SUGGESTION_FIELDS[job.field], value }],
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
      // A title column is a single varchar(200) line, whatever the model wrote (AC-61).
      const [titleProm = '', titleOlx = ''] = [texts.titleProm, texts.titleOlx].map((title) => {
        const line = title.replace(/\s+/g, ' ').trim();
        return line.length > productConstraints.titleMaxLength
          ? line
              .slice(0, productConstraints.titleMaxLength + 1)
              .replace(/\s\S*$/, '')
              .slice(0, productConstraints.titleMaxLength)
          : line;
      });
      suggestions.push(
        { field: 'title_prom', value: titleProm },
        { field: 'title_olx', value: titleOlx },
        { field: 'description_prom', value: texts.descriptionProm },
        { field: 'description_olx', value: texts.descriptionOlx },
        { field: 'seo_keywords', value: texts.seoKeywords },
      );
    }

    if (job.scope === 'price' || job.scope === 'both') {
      let price: PriceResult;
      try {
        price = await this.adapter.findPriceRange(priceQuery(card));
      } catch (error) {
        // The texts already paid for stay with the run; only the price is reported missing.
        await this.runs.finishRun(job.runId, {
          status: 'failed',
          errorCode: 'price_unavailable',
          errorDetail: errorDetail(error),
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
   * `error` is the one the last attempt threw.
   */
  async abandon(runId: string, error: unknown): Promise<void> {
    await this.runs.finishRun(runId, {
      status: 'failed',
      errorCode: 'preparation_failed',
      errorDetail: errorDetail(error),
      suggestions: [],
    });
  }

  /**
   * The two paths `abandon` cannot cover: `expireInSeconds` killed the last attempt (the handler
   * never reached its own `catch`), or `abandon` itself failed. Returns how many runs were closed.
   */
  async closeStuckRuns(): Promise<number> {
    return this.runs.closeStuckRuns(config.queue.preparation.stuckAfterSeconds);
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
