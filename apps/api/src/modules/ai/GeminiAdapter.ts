import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { config } from '../../config.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { optimizeFrame } from './AnthropicAdapter.ts';

export type PriceSearchQuery = {
  readonly title: string;
  readonly description: string;
  /** How many go is the caller's choice (`config.ai.priceSearch.maxFrames`); none is fine. */
  readonly frames?: readonly Uint8Array[];
};

export type PriceListing = { readonly price: string; readonly url: string };

/** For the worker's log only — Gemini calls stay out of the token ledger (ADR 0025). */
export type PriceSearchCall = {
  readonly model: string;
  readonly webSearchQueries: readonly string[];
  /** `vertexaisearch` redirects, kept apart from the listing URLs so the gate can compare them. */
  readonly groundingUris: readonly string[];
  readonly inputTokens: number;
  readonly outputTokens: number;
};

/**
 * The adapter's own union, so `PreparationService` classifies a failure without knowing the SDK
 * (ADR 0023). The range invariant (`priceFrom ≤ priceTo`, both > 0) is the service's to check.
 */
export type PriceSearchResult =
  | {
      readonly kind: 'found';
      readonly priceFrom: string;
      readonly priceTo: string;
      readonly listings: readonly PriceListing[];
      readonly call: PriceSearchCall;
    }
  | { readonly kind: 'unparsed'; readonly call: PriceSearchCall }
  | { readonly kind: 'quotaExhausted'; readonly reason: string }
  | { readonly kind: 'unavailable'; readonly reason: string };

/** What the SDK call is reduced to, in the adapter's own terms, so a spec can stand in for it. */
export type GeminiRequest = {
  readonly prompt: string;
  /** Base64 JPEG, already optimized. */
  readonly frames: readonly string[];
};

export type GeminiReply = {
  readonly text: string | undefined;
  /** Set when the prompt was blocked or generation stopped for anything but `STOP`/`MAX_TOKENS`. */
  readonly refusal: string | undefined;
  readonly call: PriceSearchCall;
};

/** An `ApiError` re-thrown under the adapter's name: a spec cannot import the SDK to build one. */
export class GeminiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Gemini answered HTTP ${String(status)}`);
  }
}

const PriceSchema = z.string().regex(productConstraints.pricePattern);

const RangeSchema = z.object({
  priceFrom: PriceSchema,
  priceTo: PriceSchema,
  listings: z
    .array(
      z.object({
        price: PriceSchema,
        url: z
          .string()
          .regex(/^https?:\/\//)
          .max(2048),
      }),
    )
    .min(1)
    .max(5),
});

/** Only the part of a Google API error body that tells a daily quota from a per-minute one. */
const QuotaErrorSchema = z.object({
  error: z.object({
    details: z.array(
      z.object({
        violations: z.array(z.object({ quotaId: z.string().optional() })).optional(),
      }),
    ),
  }),
});

const NORMAL_FINISH = new Set(['STOP', 'MAX_TOKENS']);

/**
 * Talks to Gemini with Google Search grounding (ADR 0020) and nothing else — it never sees a card,
 * the Prom-else-OLX choice or the database. Every failure comes back as a result, never a throw:
 * the run must close without pg-boss retrying it (ADR 0023).
 */
export class GeminiAdapter {
  private readonly client: GoogleGenAI;

  constructor(private readonly apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async findPriceRange(query: PriceSearchQuery): Promise<PriceSearchResult> {
    let reply: GeminiReply;
    try {
      const frames = await Promise.all((query.frames ?? []).map(optimizeFrame));
      reply = await this.generate({
        prompt: pricePrompt(query.title, query.description),
        frames: frames.map((bytes) => Buffer.from(bytes).toString('base64')),
      });
    } catch (error) {
      return this.failure(error);
    }

    if (reply.refusal !== undefined) {
      return { kind: 'unavailable', reason: `The model declined to answer (${reply.refusal})` };
    }
    const range = parseRange(reply.text);
    if (range === undefined) {
      return { kind: 'unparsed', call: reply.call };
    }
    return { kind: 'found', ...range, call: reply.call };
  }

  /** One request per run: the SDK only repeats a call when asked to, and it is not asked here. */
  protected async generate(request: GeminiRequest): Promise<GeminiReply> {
    let response;
    try {
      response = await this.client.models.generateContent({
        model: config.ai.priceSearch.model,
        contents: [
          {
            role: 'user',
            parts: [
              ...request.frames.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
              { text: request.prompt },
            ],
          },
        ],
        config: {
          tools: [{ googleSearch: {} }],
          httpOptions: { timeout: config.ai.priceSearch.timeoutMs },
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new GeminiHttpError(error.status, error.message);
      }
      throw error;
    }

    const candidate = response.candidates?.[0];
    const blockReason = response.promptFeedback?.blockReason;
    const finishReason = candidate?.finishReason;
    const metadata = candidate?.groundingMetadata;
    const usage = response.usageMetadata;
    return {
      text: response.text,
      refusal:
        blockReason !== undefined
          ? `blockReason: ${blockReason}`
          : finishReason !== undefined && !NORMAL_FINISH.has(finishReason)
            ? `finishReason: ${finishReason}`
            : undefined,
      call: {
        model: response.modelVersion ?? config.ai.priceSearch.model,
        webSearchQueries: metadata?.webSearchQueries ?? [],
        groundingUris: (metadata?.groundingChunks ?? []).flatMap((chunk) =>
          chunk.web?.uri === undefined ? [] : [chunk.web.uri],
        ),
        inputTokens: (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0),
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      },
    };
  }

  private failure(error: unknown): PriceSearchResult {
    if (error instanceof GeminiHttpError) {
      const reason = this.safeReason(`HTTP ${String(error.status)}: ${error.body}`);
      return error.status === 429 && isDailyQuota(error.body)
        ? { kind: 'quotaExhausted', reason }
        : { kind: 'unavailable', reason };
    }
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { kind: 'unavailable', reason: this.safeReason(reason) };
  }

  /** The key never reaches a log or a stored run, whatever an error message happens to echo. */
  private safeReason(reason: string): string {
    const redacted = this.apiKey === '' ? reason : reason.replaceAll(this.apiKey, '[redacted]');
    return redacted.slice(0, config.ai.errorDetailMaxLength);
  }
}

function pricePrompt(title: string, description: string): string {
  return (
    'Знайди в пошуку актуальну ціну вживаного товару на українських майданчиках (OLX, Prom, ' +
    'інші оголошення в Україні) і назви вилку цін у гривнях.\n\n' +
    `Назва: ${title}\nОпис: ${description}\n\n` +
    'Наведи від 1 до 5 оголошень, які ти справді знайшов, з ціною й посиланням на сторінку ' +
    'оголошення. Не вигадуй ні цін, ні посилань. Відповідь — лише JSON без жодного тексту ' +
    'навколо, ціни — рядками з десятковим числом без валюти й пробілів:\n' +
    '{"priceFrom": "1500", "priceTo": "2500", "listings": [{"price": "1800", "url": "https://..."}]}'
  );
}

/** Structured outputs do not combine with search on 2.5, so the JSON comes out of free text. */
function parseRange(
  text: string | undefined,
): Omit<Extract<PriceSearchResult, { kind: 'found' }>, 'kind' | 'call'> | undefined {
  if (text === undefined) {
    return undefined;
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end < start) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return undefined;
  }
  const parsed = RangeSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The only sign of a daily quota is a `quotaId` with `PerDay` in the error details, and Google
 * does not document it (ADR 0023): anything else is an ordinary failure.
 */
function isDailyQuota(body: string): boolean {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return false;
  }
  const parsed = QuotaErrorSchema.safeParse(json);
  return (
    parsed.success &&
    parsed.data.error.details.some((detail) =>
      (detail.violations ?? []).some((violation) => violation.quotaId?.includes('PerDay')),
    )
  );
}
