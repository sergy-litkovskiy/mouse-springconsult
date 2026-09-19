import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import sharp from 'sharp';
import { z } from 'zod';
import { config } from '../../config.ts';

export type RewritableField =
  'titleProm' | 'titleOlx' | 'descriptionProm' | 'descriptionOlx' | 'seoKeywords';

export type Usage = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type TextsResult = {
  /** Returned to the caller only — never persisted as a field of its own (ADR 0014). */
  readonly recognizedItem: string;
  readonly descriptionProm: string;
  readonly descriptionOlx: string;
  readonly seoKeywords: readonly string[];
  readonly usage: Usage;
};

export type PriceResult = {
  readonly priceFrom: string;
  readonly priceTo: string;
  readonly sources: readonly string[];
  readonly usage: Usage;
};

export type FieldRewriteResult = {
  readonly value: string | readonly string[];
  readonly usage: Usage;
};

/**
 * The adapter's own request-content shape, structurally compatible with the SDK's content block
 * union but named independently of it — so a test double (or anything else outside this file) can
 * describe what it received without importing the SDK (`deps:check`, rule `anthropic-sdk-stays-in-the-adapter`).
 */
export type ModelContentBlock =
  | {
      readonly type: 'image';
      readonly source: {
        readonly type: 'base64';
        readonly media_type: 'image/jpeg';
        readonly data: string;
      };
    }
  | { readonly type: 'text'; readonly text: string };

/**
 * Covers both a `stop_reason: "refusal"` and an answer that failed to parse against its schema —
 * `ai/CLAUDE.md` requires `stop_reason` to be checked before the response is read either way, and
 * the caller (T28) treats both the same: the call produced nothing usable.
 */
export class ModelAnswerUnavailable extends Error {}

const PLAIN_TEXT_RULE =
  'Respond in plain text only: no Markdown, no emphasis marks, no emoji, and no wrapper phrases ' +
  'like "Here is your description:" — just the content itself.';

const TextsSchema = z.object({
  recognizedItem: z.string(),
  descriptionProm: z.string(),
  descriptionOlx: z.string(),
  seoKeywords: z.array(z.string()),
});

const PriceSchema = z.object({
  priceFrom: z.string(),
  priceTo: z.string(),
  sources: z.array(z.string()),
});

const FieldValueSchema = z.object({
  value: z.union([z.string(), z.array(z.string())]),
});

type RequestResult<T> = { readonly value: T; readonly usage: Usage };

/**
 * Talks to `claude-sonnet-5` (ADR 0004) and nothing else — no products, no queue, no persistence.
 * Out of scope on purpose: composing the price query (T28, AC-27) and writing suggestions (T28).
 */
export class AnthropicAdapter {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Recognizes the item and writes both listings from up to `config.ai.maxFramesPerRequest`
   * frames in the same call (ADR 0014) — additional gallery frames are never sent to the model.
   */
  async generateTexts(frames: readonly Uint8Array[]): Promise<TextsResult> {
    const selected = frames.slice(0, config.ai.maxFramesPerRequest);
    const optimized = await Promise.all(selected.map(optimizeFrame));

    const content: ModelContentBlock[] = [
      ...optimized.map((bytes): ModelContentBlock => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: Buffer.from(bytes).toString('base64'),
        },
      })),
      {
        type: 'text',
        text:
          'These are photos of a secondhand item for a marketplace listing. Identify what the ' +
          'item is (and its brand/model if visible), then write, in Ukrainian: a Prom.ua listing ' +
          'description with SEO keywords, and a separate OLX listing description. ' +
          PLAIN_TEXT_RULE,
      },
    ];

    const { value, usage } = await this.requestTexts(content);
    return { ...value, usage };
  }

  /** `query` is already composed by the caller (T28, AC-27) — this method does not read `products`. */
  async findPriceRange(query: string): Promise<PriceResult> {
    const { value, usage } = await this.requestPrice([
      {
        type: 'text',
        text:
          `Search the web for the current secondhand market price range, in Ukraine, for: ` +
          `${query}. Report it as a "from – to" range in Ukrainian hryvnias and list only the ` +
          `source URLs you actually used — never invent a price or a source. ${PLAIN_TEXT_RULE}`,
      },
    ]);
    return { ...value, usage };
  }

  /** Text-only rewrite of one field from its draft — no photos, no read of `products` (ADR 0015). */
  async rewriteField(field: RewritableField, draftText: string): Promise<FieldRewriteResult> {
    const listInstruction =
      field === 'seoKeywords' ? ' Return a list of keywords, not a sentence.' : '';
    const { value, usage } = await this.requestFieldRewrite([
      {
        type: 'text',
        text:
          `Rewrite this ${fieldKind(field)} draft as a new variant — same subject and language, ` +
          `better phrasing: "${draftText}".${listInstruction} ${PLAIN_TEXT_RULE}`,
      },
    ]);
    return { value: value.value, usage };
  }

  protected async requestTexts(
    content: readonly ModelContentBlock[],
  ): Promise<RequestResult<z.infer<typeof TextsSchema>>> {
    return this.request(content, TextsSchema, config.ai.effort.texts);
  }

  protected async requestPrice(
    content: readonly ModelContentBlock[],
  ): Promise<RequestResult<z.infer<typeof PriceSchema>>> {
    return this.request(content, PriceSchema, config.ai.effort.price, [
      {
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: config.ai.webSearch.maxUses,
        user_location: { type: 'approximate', timezone: config.ai.webSearch.userTimezone },
      },
    ]);
  }

  protected async requestFieldRewrite(
    content: readonly ModelContentBlock[],
  ): Promise<RequestResult<z.infer<typeof FieldValueSchema>>> {
    return this.request(content, FieldValueSchema, config.ai.effort.field);
  }

  /**
   * The one place that calls the SDK. `stop_reason` is read before `parsed_output` (ai/CLAUDE.md):
   * a refusal or a schema mismatch must not be mistaken for a usable result.
   */
  private async request<T>(
    content: readonly ModelContentBlock[],
    schema: z.ZodType<T>,
    effort: (typeof config.ai.effort)[keyof typeof config.ai.effort],
    tools?: Anthropic.Messages.ToolUnion[],
  ): Promise<RequestResult<T>> {
    const response = await this.client.messages.parse({
      model: config.ai.model,
      max_tokens: 16_000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(schema), effort },
      ...(tools === undefined ? {} : { tools }),
      messages: [{ role: 'user', content: [...content] }],
    });

    if (response.stop_reason === 'refusal') {
      throw new ModelAnswerUnavailable('The model declined to answer');
    }
    if (response.parsed_output === null) {
      throw new ModelAnswerUnavailable(
        `The model did not return a parseable answer (stop_reason: ${String(response.stop_reason)})`,
      );
    }

    return {
      value: response.parsed_output,
      usage: {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}

/**
 * Longer side ≤ 1568 px, JPEG q80, sRGB, EXIF stripped (`ai/CLAUDE.md`) — a deliberate cost cut,
 * not a model limit. `.rotate()` first: without it, stripping EXIF drops the orientation tag and
 * a phone photo taken in portrait would reach the model sideways.
 */
async function optimizeFrame(bytes: Uint8Array): Promise<Uint8Array> {
  const optimized = await sharp(bytes)
    .rotate()
    .resize({
      width: config.ai.frameOptimization.maxDimensionPx,
      height: config.ai.frameOptimization.maxDimensionPx,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toColorspace('srgb')
    .jpeg({ quality: config.ai.frameOptimization.jpegQuality })
    .toBuffer();
  return new Uint8Array(optimized);
}

function fieldKind(field: RewritableField): string {
  switch (field) {
    case 'titleProm':
    case 'titleOlx':
      return 'listing title';
    case 'descriptionProm':
    case 'descriptionOlx':
      return 'listing description';
    case 'seoKeywords':
      return 'SEO keyword list';
  }
}
