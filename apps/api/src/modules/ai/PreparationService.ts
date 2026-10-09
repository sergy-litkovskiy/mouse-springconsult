import { config } from '../../config.ts';
import type { FieldRewriteMode } from '../../contracts/ai.contract.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { logger } from '../../logger.ts';
import type { MediaService } from '../media/index.ts';
import {
  ProductNotFound,
  priceSearchInput,
  type PreparationRepository,
  type Product,
  type ProductRepository,
  type SuggestionDraft,
  type SuggestionField,
} from '../products/index.ts';
import type { AnthropicAdapter, RewritableField } from './AnthropicAdapter.ts';
import type { GeminiAdapter } from './GeminiAdapter.ts';

export type PreparationJob =
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'texts' | 'price' | 'both';
    }
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'price';
      readonly title: string;
      readonly description: string;
    }
  | {
      readonly runId: string;
      readonly productId: string;
      readonly scope: 'field';
      readonly field: RewritableField;
      readonly draftText: string;
      /** Optional for backward compat with queue jobs enqueued before modes existed. */
      readonly mode?: FieldRewriteMode;
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

/** A title column is a single varchar(200) line, whatever the model wrote. */
function singleLineTitle(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (line.length <= productConstraints.titleMaxLength) {
    return line;
  }
  // Cut at the last word boundary that fits; a single overlong word is cut mid-word.
  return line
    .slice(0, productConstraints.titleMaxLength + 1)
    .replace(/\s\S*$/, '')
    .slice(0, productConstraints.titleMaxLength);
}

export class PreparationService {
  constructor(
    private readonly adapter: AnthropicAdapter,
    private readonly gemini: GeminiAdapter | null,
    private readonly runs: PreparationRepository,
    private readonly products: ProductRepository,
    private readonly media: MediaService,
  ) {}

  async prepare(job: PreparationJob): Promise<void> {
    if (!(await this.runs.startRun(job.runId))) {
      return;
    }

    if (job.scope === 'field') {
      const rewrite = await this.adapter.rewriteField(
        job.field,
        job.draftText,
        job.mode ?? 'improve',
      );
      await this.runs.recordUsage(job.runId, rewrite.usage);
      const isTitle = job.field === 'titleProm' || job.field === 'titleOlx';
      const value =
        isTitle && typeof rewrite.value === 'string'
          ? singleLineTitle(rewrite.value)
          : rewrite.value;
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
      const titleProm = singleLineTitle(texts.titleProm);
      const titleOlx = singleLineTitle(texts.titleOlx);
      suggestions.push(
        { field: 'title_prom', value: titleProm },
        { field: 'title_olx', value: titleOlx },
        { field: 'description_prom', value: texts.descriptionProm },
        { field: 'description_olx', value: texts.descriptionOlx },
        { field: 'seo_keywords', value: texts.seoKeywords },
      );

      if (job.scope === 'both' && this.gemini !== null) {
        // The search leans on the texts just written, not on the saved card, which may be empty.
        const search = priceSearchInput({
          titleProm,
          titleOlx,
          descriptionProm: texts.descriptionProm,
          descriptionOlx: texts.descriptionOlx,
        });
        if (search.kind === 'missing') {
          await this.runs.finishRun(job.runId, {
            status: 'failed',
            errorCode: 'price_not_found',
            errorDetail: `the texts carry no ${search.missing.join(' and ')} to search by`,
            suggestions,
          });
          return;
        }
        await this.searchPrice(
          this.gemini,
          job.runId,
          search.title,
          search.description,
          suggestions,
        );
        return;
      }
    }

    if (job.scope === 'price' && 'title' in job && this.gemini !== null) {
      await this.searchPrice(this.gemini, job.runId, job.title, job.description, suggestions);
      return;
    }

    if (job.scope === 'price' || job.scope === 'both') {
      // A job gets here without a Gemini key, or a `price` one without the title to search by: the
      // texts already paid for stay with the run, and the run closes without a throw so pg-boss
      // does not retry it.
      await this.runs.finishRun(job.runId, {
        status: 'failed',
        errorCode: 'price_unavailable',
        errorDetail: 'price search is not configured',
        suggestions,
      });
      return;
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

  private async searchPrice(
    gemini: GeminiAdapter,
    runId: string,
    title: string,
    description: string,
    suggestions: readonly SuggestionDraft[],
  ): Promise<void> {
    const result = await gemini.findPriceRange({ title, description });
    // The pair is draft text and stays out of the log, as the queue payload does; tokens and
    // queries live only here, never in the run row (ADR 0025).
    const call = 'call' in result ? result.call : undefined;
    const logSearch = (code: string): void => {
      logger.info(
        {
          runId,
          model: call?.model ?? config.ai.priceSearch.model,
          code,
          webSearchQueries: call?.webSearchQueries ?? [],
          inputTokens: call?.inputTokens ?? 0,
          outputTokens: call?.outputTokens ?? 0,
        },
        'price search finished',
      );
    };
    if (result.kind === 'unavailable' || result.kind === 'quotaExhausted') {
      const errorCode =
        result.kind === 'unavailable' ? 'price_unavailable' : 'price_quota_exhausted';
      logSearch(errorCode);
      await this.runs.finishRun(runId, {
        status: 'failed',
        errorCode,
        errorDetail: result.reason,
        suggestions,
      });
      return;
    }
    if (
      result.kind === 'unparsed' ||
      !(Number(result.priceFrom) > 0) ||
      !(Number(result.priceTo) > 0) ||
      Number(result.priceFrom) > Number(result.priceTo)
    ) {
      logSearch('price_not_found');
      await this.runs.finishRun(runId, {
        status: 'failed',
        errorCode: 'price_not_found',
        errorDetail:
          result.kind === 'unparsed'
            ? 'the answer did not parse as a price range'
            : `the range ${result.priceFrom}–${result.priceTo} is not a valid range`,
        suggestions,
      });
      return;
    }
    logSearch('succeeded');
    await this.runs.finishRun(runId, {
      status: 'succeeded',
      suggestions: [
        ...suggestions,
        {
          field: 'price',
          value: {
            priceFrom: result.priceFrom,
            priceTo: result.priceTo,
            listings: result.listings,
          },
        },
      ],
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
