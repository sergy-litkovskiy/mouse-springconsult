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

const REDIRECT = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQsony';
const LISTING_URL = 'https://www.olx.ua/d/uk/obyavlenie/sony-IDabc.html';
const LISTING = { price: '1800', url: REDIRECT };

function redirect(id: string): string {
  return `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`;
}

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

/**
 * Never talks to Gemini or to the redirect host: both methods that reach the network are replaced
 * by a script.
 */
class ScriptedGeminiAdapter extends GeminiAdapter {
  readonly requests: GeminiRequest[] = [];

  constructor(
    private readonly script: () => GeminiReply,
    private readonly redirects: ReadonlyMap<string, string> = new Map([[REDIRECT, LISTING_URL]]),
  ) {
    super(API_KEY);
  }

  override async generate(request: GeminiRequest): Promise<GeminiReply> {
    this.requests.push(request);
    return this.script();
  }

  protected override async resolveRedirect(url: string): Promise<string | undefined> {
    const target = this.redirects.get(url);
    if (target === 'unreachable') {
      throw new TypeError('fetch failed');
    }
    return target;
  }
}

function answering(
  text: string | undefined,
  refusal?: string,
  redirects?: ReadonlyMap<string, string>,
): ScriptedGeminiAdapter {
  return new ScriptedGeminiAdapter(() => ({ text, refusal, call: CALL }), redirects);
}

function leadingTo(text: string, redirects: Record<string, string>): ScriptedGeminiAdapter {
  return answering(text, undefined, new Map(Object.entries(redirects)));
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
      priceFrom: '1800',
      priceTo: '1800',
      listings: [{ price: '1800', url: LISTING_URL }],
      call: CALL,
    });
  });

  it('rebuilds the range from the kept listings instead of the one the model named', async () => {
    const text = rangeText([
      { price: '650', url: redirect('a') },
      { price: '4200', url: redirect('search') },
      { price: '375', url: redirect('b') },
    ]);

    const result = await search(
      leadingTo(text, {
        [redirect('a')]: 'https://www.olx.ua/d/obyavlenie/casio-mtp-1084-IDYFNh2.html',
        [redirect('search')]: 'https://www.olx.ua/uk/list/q-casio-mtp/',
        [redirect('b')]: 'https://prom.ua/ua/p1898742664-casio-mtp.html',
      }),
    );

    assert.ok(result.kind === 'found');
    assert.equal(result.priceFrom, '375');
    assert.equal(result.priceTo, '650');
    assert.deepEqual(
      result.listings.map((listing) => listing.url),
      [
        'https://www.olx.ua/d/obyavlenie/casio-mtp-1084-IDYFNh2.html',
        'https://prom.ua/ua/p1898742664-casio-mtp.html',
      ],
    );
  });

  it('drops a listing URL the model wrote itself rather than took from the search', async () => {
    const text = rangeText([LISTING, { price: '900', url: LISTING_URL }]);

    const result = await search(answering(text));

    assert.ok(result.kind === 'found');
    assert.deepEqual(result.listings, [{ price: '1800', url: LISTING_URL }]);
    assert.equal(
      (await search(answering(rangeText([{ price: '900', url: LISTING_URL }])))).kind,
      'unparsed',
    );
  });

  it('keeps listing pages of Shafa and Kloomba', async () => {
    const pages = [
      'https://shafa.ua/item/221547323-lavandovyy-ametist-gran-6mm',
      'https://shafa.ua/uk/item/221618837-futbolka-dlya-divchinki-ff-blakitna',
      'https://shafa.ua/women/sport-otdyh/sportivnyye-kostyumy/216943978-kostyum-sportivniy',
      'https://kloomba.com/o/kovdra-praporc-48069987/',
    ];
    const text = rangeText(pages.map((_, i) => ({ price: '900', url: redirect(String(i)) })));

    const result = await search(
      leadingTo(text, Object.fromEntries(pages.map((page, i) => [redirect(String(i)), page]))),
    );

    assert.ok(result.kind === 'found');
    assert.deepEqual(
      result.listings.map((listing) => listing.url),
      pages,
    );
  });

  it('drops category pages of Shafa and Kloomba', async () => {
    const categories = [
      'https://shafa.ua/women',
      'https://shafa.ua/uk/women/platya',
      'https://kloomba.com/market/detskaya-odezhda/',
    ];
    const text = rangeText(categories.map((_, i) => ({ price: '900', url: redirect(String(i)) })));

    const result = await search(
      leadingTo(text, Object.fromEntries(categories.map((page, i) => [redirect(String(i)), page]))),
    );

    assert.equal(result.kind, 'unparsed');
  });

  it('reports an unparsed reply when every redirect leads to a search or a home page', async () => {
    const text = rangeText([
      { price: '7000', url: redirect('list') },
      { price: '9500', url: redirect('home') },
    ]);

    const result = await search(
      leadingTo(text, {
        [redirect('list')]: 'https://www.olx.ua/uk/hobbi-otdyh-i-sport/q-lego-ev3/',
        [redirect('home')]: 'https://www.olx.ua/',
      }),
    );

    assert.equal(result.kind, 'unparsed');
  });

  it('reports an unparsed reply instead of throwing when a redirect cannot be resolved', async () => {
    const text = rangeText([
      { price: '1800', url: redirect('down') },
      { price: '1900', url: redirect('nowhere') },
    ]);

    const result = await search(leadingTo(text, { [redirect('down')]: 'unreachable' }));

    assert.equal(result.kind, 'unparsed');
  });

  it('keeps the listing address without its query string and keeps it once', async () => {
    const text = rangeText([
      { price: '50', url: redirect('a') },
      { price: '50', url: redirect('b') },
    ]);
    const page = 'https://m.olx.ua/d/obyavlenie/perehdnik-ca-44-IDZicGT.html';

    const result = await search(
      leadingTo(text, {
        [redirect('a')]: `${page}?reason=ip%7Ccool%3Abase#gallery`,
        [redirect('b')]: page,
      }),
    );

    assert.ok(result.kind === 'found');
    assert.deepEqual(result.listings, [{ price: '50', url: page }]);
  });

  it('reads the JSON out of a ```json fence with prose around it', async () => {
    const result = await search(
      answering(`Ось що я знайшов:\n\`\`\`json\n${rangeText()}\n\`\`\`\nЦіни актуальні.`),
    );

    assert.equal(result.kind, 'found');
  });

  it('keeps a listing whose address is 2048 characters and drops one of 2049', async () => {
    const prefix = 'https://www.olx.ua/d/obyavlenie/';
    const page = (length: number): string =>
      `${prefix}${'a'.repeat(length - prefix.length - '.html'.length)}.html`;
    assert.equal(page(2048).length, 2048);

    const at = await search(leadingTo(rangeText(), { [REDIRECT]: page(2048) }));
    const past = await search(leadingTo(rangeText(), { [REDIRECT]: page(2049) }));

    assert.equal(at.kind, 'found');
    assert.equal(past.kind, 'unparsed');
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
