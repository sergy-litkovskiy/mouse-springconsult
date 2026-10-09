import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { config } from '../../config.ts';
import {
  GeminiAdapter,
  GeminiHttpError,
  type GeminiReply,
  type GeminiRequest,
  type PriceSearchResult,
} from './GeminiAdapter.ts';

const API_KEY = 'test-gemini-key';

const CALL = {
  model: 'gemini-2.5-flash',
  webSearchQueries: ['навушники Sony WH-1000XM4 б/у ціна'],
  groundingUris: ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc'],
  inputTokens: 120,
  outputTokens: 80,
};

const LISTING = { price: '1800', url: 'https://www.olx.ua/d/uk/obyavlenie/sony-IDabc.html' };

function rangeText(listings: readonly { price: string; url: string }[] = [LISTING]): string {
  return JSON.stringify({ priceFrom: '1500', priceTo: '2500.00', listings });
}

function quotaBody(quotaId: string): string {
  return JSON.stringify({
    error: {
      code: 429,
      message: 'You exceeded your current quota.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
              quotaId,
            },
          ],
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' },
      ],
    },
  });
}

/** Never talks to Gemini: the one method that reaches the SDK is replaced by a script. */
class ScriptedGeminiAdapter extends GeminiAdapter {
  readonly requests: GeminiRequest[] = [];

  constructor(private readonly script: () => GeminiReply) {
    super(API_KEY);
  }

  override async generate(request: GeminiRequest): Promise<GeminiReply> {
    this.requests.push(request);
    return this.script();
  }
}

function answering(text: string | undefined, refusal?: string): ScriptedGeminiAdapter {
  return new ScriptedGeminiAdapter(() => ({ text, refusal, call: CALL }));
}

function failingWith(error: unknown): ScriptedGeminiAdapter {
  return new ScriptedGeminiAdapter(() => {
    throw error;
  });
}

async function search(adapter: GeminiAdapter): Promise<PriceSearchResult> {
  return adapter.findPriceRange({ title: 'Навушники Sony', description: 'Б/у, повний комплект.' });
}

describe('GeminiAdapter', () => {
  it('returns the range, its listings and the call details when the reply parses', async () => {
    const result = await search(answering(rangeText()));

    assert.deepEqual(result, {
      kind: 'found',
      priceFrom: '1500',
      priceTo: '2500.00',
      listings: [LISTING],
      call: CALL,
    });
  });

  it('reads the JSON out of a ```json fence with prose around it', async () => {
    const result = await search(
      answering(`Ось що я знайшов:\n\`\`\`json\n${rangeText()}\n\`\`\`\nЦіни актуальні.`),
    );

    assert.equal(result.kind, 'found');
  });

  it('accepts a 2048-character listing URL', async () => {
    const url = `https://olx.ua/${'a'.repeat(2048 - 'https://olx.ua/'.length)}`;
    assert.equal(url.length, 2048);

    const result = await search(answering(rangeText([{ price: '1800', url }])));

    assert.equal(result.kind, 'found');
  });

  it('reports an unparsed reply, with the call details, when there is no JSON', async () => {
    const result = await search(answering('На жаль, я не знайшов оголошень.'));

    assert.deepEqual(result, { kind: 'unparsed', call: CALL });
  });

  it('reports an unparsed reply when the text is missing', async () => {
    assert.equal((await search(answering(undefined))).kind, 'unparsed');
  });

  it('reports an unparsed reply when there are no listings', async () => {
    assert.equal((await search(answering(rangeText([])))).kind, 'unparsed');
  });

  it('reports an unparsed reply for six listings instead of keeping five', async () => {
    const six = Array.from({ length: 6 }, () => LISTING);

    assert.equal((await search(answering(rangeText(six)))).kind, 'unparsed');
  });

  it('reports an unparsed reply for a javascript: listing URL', async () => {
    const result = await search(
      answering(rangeText([LISTING, { price: '1900', url: 'javascript:alert(1)' }])),
    );

    assert.equal(result.kind, 'unparsed');
  });

  it('reports an unparsed reply for a 2049-character listing URL', async () => {
    const url = `https://olx.ua/${'a'.repeat(2049 - 'https://olx.ua/'.length)}`;
    assert.equal(url.length, 2049);

    const result = await search(answering(rangeText([{ price: '1800', url }])));

    assert.equal(result.kind, 'unparsed');
  });

  it('reports an unparsed reply for a price that is not a decimal string', async () => {
    const result = await search(
      answering(JSON.stringify({ priceFrom: '1 500 грн', priceTo: '2500', listings: [LISTING] })),
    );

    assert.equal(result.kind, 'unparsed');
  });

  it('reports an exhausted quota for a 429 whose quotaId names a daily limit', async () => {
    const result = await search(
      failingWith(
        new GeminiHttpError(429, quotaBody('GenerateRequestsPerDayPerProjectPerModel-FreeTier')),
      ),
    );

    assert.equal(result.kind, 'quotaExhausted');
  });

  it('reports a 429 without a daily quotaId as an unavailable service', async () => {
    const result = await search(
      failingWith(
        new GeminiHttpError(429, quotaBody('GenerateRequestsPerMinutePerProjectPerModel-FreeTier')),
      ),
    );

    assert.equal(result.kind, 'unavailable');
  });

  it('reports a 429 with a body that is not JSON as an unavailable service', async () => {
    const result = await search(failingWith(new GeminiHttpError(429, 'Too Many Requests')));

    assert.equal(result.kind, 'unavailable');
  });

  it('reports an unavailable service for a 503', async () => {
    const result = await search(
      failingWith(new GeminiHttpError(503, '{"error":{"code":503,"status":"UNAVAILABLE"}}')),
    );

    assert.ok(result.kind === 'unavailable');
    assert.match(result.reason, /HTTP 503/);
  });

  it('reports an unavailable service for a timeout or a network error', async () => {
    const timeout = new Error('This operation was aborted');
    timeout.name = 'AbortError';

    assert.equal((await search(failingWith(timeout))).kind, 'unavailable');
    assert.equal((await search(failingWith(new TypeError('fetch failed')))).kind, 'unavailable');
  });

  it('reports an unavailable service when the model declines', async () => {
    const result = await search(answering(rangeText(), 'finishReason: SAFETY'));

    assert.ok(result.kind === 'unavailable');
    assert.match(result.reason, /SAFETY/);
  });

  it('keeps the key out of the reason and cuts the reason to the configured length', async () => {
    const result = await search(
      failingWith(new GeminiHttpError(400, `API key ${API_KEY} not valid. ${'x'.repeat(1000)}`)),
    );

    assert.ok(result.kind === 'unavailable');
    assert.doesNotMatch(result.reason, new RegExp(API_KEY));
    assert.ok(result.reason.length <= config.ai.errorDetailMaxLength);
  });

  it('sends the title and description, and no frames when none are given', async () => {
    const adapter = answering(rangeText());

    await search(adapter);

    assert.equal(adapter.requests.length, 1);
    assert.match(adapter.requests[0]?.prompt ?? '', /Навушники Sony/);
    assert.match(adapter.requests[0]?.prompt ?? '', /Б\/у, повний комплект\./);
    assert.deepEqual(adapter.requests[0]?.frames, []);
  });

  it('sends every given frame as an optimized JPEG', async () => {
    const png = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    const adapter = answering(rangeText());

    await adapter.findPriceRange({
      title: 'Навушники Sony',
      description: 'Б/у.',
      frames: [new Uint8Array(png), new Uint8Array(png)],
    });

    const frames = adapter.requests[0]?.frames ?? [];
    assert.equal(frames.length, 2);
    const meta = await sharp(Buffer.from(frames[0] ?? '', 'base64')).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(Math.max(meta.width, meta.height), config.ai.frameOptimization.maxDimensionPx);
  });

  it('reports an unavailable service instead of throwing when a frame cannot be read', async () => {
    const adapter = answering(rangeText());

    const result = await adapter.findPriceRange({
      title: 'Навушники Sony',
      description: 'Б/у.',
      frames: [new Uint8Array([1, 2, 3])],
    });

    assert.equal(result.kind, 'unavailable');
    assert.equal(adapter.requests.length, 0);
  });
});
