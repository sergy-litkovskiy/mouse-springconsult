import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from '../../../db/test-database.ts';
import { config } from '../../config.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { createDataSource } from '../../db.ts';
import { MediaService, type ImageStorage } from '../media/index.ts';
import {
  FieldSuggestion,
  PreparationRepository,
  PreparationRun,
  Product,
  ProductImage,
  ProductRepository,
  PRODUCTS_TABLE,
  type CallUsage,
  type RunOutcome,
} from '../products/index.ts';
import {
  AnthropicAdapter,
  ModelAnswerUnavailable,
  type FieldRewriteResult,
  type RewritableField,
  type TextsResult,
} from './AnthropicAdapter.ts';
import {
  GeminiAdapter,
  type PriceSearchCall,
  type PriceSearchQuery,
  type PriceSearchResult,
} from './GeminiAdapter.ts';
import { PreparationService, type PreparationJob } from './PreparationService.ts';

/**
 * The model is the only thing doubled: runs, suggestions and the card live in a real Postgres,
 * because "the card is untouched" and "the tokens add up" are claims about rows, not about calls.
 */

const dataSource = createDataSource({
  url: testDatabaseUrl(),
  entities: [Product, ProductImage, PreparationRun, FieldSuggestion],
});

const MODEL = 'claude-sonnet-5';
const TEXTS_USAGE = { model: MODEL, inputTokens: 1000, outputTokens: 200 };
const FIELD_USAGE = { model: MODEL, inputTokens: 120, outputTokens: 30 };

const TEXTS: TextsResult = {
  recognizedItem: 'бездротова миша Logitech MX Master 3',
  titleProm: 'Бездротова миша Logitech MX Master 3',
  titleOlx: 'Миша Logitech MX Master 3, бездротова',
  descriptionProm: 'Опис для Prom.',
  descriptionOlx: 'Опис для OLX.',
  seoKeywords: ['миша', 'logitech'],
  usage: TEXTS_USAGE,
};

type Script = {
  readonly textsFailure?: Error;
  readonly texts?: TextsResult;
  readonly fieldValue?: string;
};

/** Never talks to Anthropic: every public method is overridden and records what it was given. */
class ScriptedAnthropicAdapter extends AnthropicAdapter {
  readonly textsCalls: (readonly Uint8Array[])[] = [];
  readonly fieldCalls: { field: RewritableField; draftText: string; mode: 'improve' | 'prompt' }[] =
    [];

  constructor(private readonly script: Script) {
    super('test-key');
  }

  override async generateTexts(frames: readonly Uint8Array[]): Promise<TextsResult> {
    this.textsCalls.push(frames);
    if (this.script.textsFailure !== undefined) {
      throw this.script.textsFailure;
    }
    return this.script.texts ?? TEXTS;
  }

  override async rewriteField(
    field: RewritableField,
    draftText: string,
    mode: 'improve' | 'prompt',
  ): Promise<FieldRewriteResult> {
    this.fieldCalls.push({ field, draftText, mode });
    if (this.script.fieldValue !== undefined) {
      return { value: this.script.fieldValue, usage: FIELD_USAGE };
    }
    return field === 'seoKeywords'
      ? { value: ['миша', 'logitech', 'mx master'], usage: FIELD_USAGE }
      : { value: 'Новий варіант.', usage: FIELD_USAGE };
  }
}

/** Never talks to Google: answers every search with the one result it was given. */
class ScriptedGeminiAdapter extends GeminiAdapter {
  readonly queries: PriceSearchQuery[] = [];

  constructor(private readonly result: PriceSearchResult) {
    super('test-gemini-key');
  }

  override async findPriceRange(query: PriceSearchQuery): Promise<PriceSearchResult> {
    this.queries.push(query);
    return this.result;
  }
}

/** Writes each model call into a timeline it shares with the other model double. */
class TimedAnthropicAdapter extends ScriptedAnthropicAdapter {
  constructor(
    script: Script,
    private readonly timeline: string[],
  ) {
    super(script);
  }

  override async generateTexts(frames: readonly Uint8Array[]): Promise<TextsResult> {
    this.timeline.push('claude');
    return super.generateTexts(frames);
  }
}

class TimedGeminiAdapter extends ScriptedGeminiAdapter {
  constructor(
    result: PriceSearchResult,
    private readonly timeline: string[],
  ) {
    super(result);
  }

  override async findPriceRange(query: PriceSearchQuery): Promise<PriceSearchResult> {
    this.timeline.push('gemini');
    return super.findPriceRange(query);
  }
}

/** The storage is never reached: `read` is overridden. */
const NO_STORAGE = undefined as unknown as ImageStorage;

/** Answers every key with the key's own bytes, so a frame handed to the model names its source. */
class KeyEchoingMedia extends MediaService {
  readonly reads: string[] = [];

  constructor() {
    super(NO_STORAGE);
  }

  override async read(key: string): Promise<Uint8Array> {
    this.reads.push(key);
    return new TextEncoder().encode(key);
  }
}

class ConnectionLost extends Error {}

/** Fails the first finishing write, as a dropped connection would, and behaves normally after. */
class FlakyFinishRepository extends PreparationRepository {
  private failuresLeft = 1;

  override async finishRun(runId: string, outcome: RunOutcome): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new ConnectionLost('connection terminated unexpectedly');
    }
    return super.finishRun(runId, outcome);
  }
}

class UsageRecordingRepository extends PreparationRepository {
  readonly usages: CallUsage[] = [];

  override async recordUsage(runId: string, usage: CallUsage): Promise<void> {
    this.usages.push(usage);
    return super.recordUsage(runId, usage);
  }
}

type CardSeed = Partial<
  Pick<Product, 'titleProm' | 'titleOlx' | 'descriptionProm' | 'descriptionOlx'>
>;

async function seedProduct(seed: CardSeed = {}): Promise<string> {
  const saved = await dataSource.getRepository(Product).save({
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова, повний комплект.',
    titleOlx: 'Logitech MX Master 3 миша',
    descriptionOlx: 'Продам мишу, стан відмінний.',
    price: '2499.00',
    seoKeywords: ['миша'],
    category: 'Периферія',
    publishedProm: false,
    publishedOlx: false,
    condition: 'used',
    promId: null,
    olxId: null,
    ...seed,
  });
  return saved.id;
}

/** Returns the keys in gallery order; `mainAt` picks which position holds the main frame. */
async function seedGallery(productId: string, count: number, mainAt = 0): Promise<string[]> {
  const keys = Array.from({ length: count }, () => `products/${productId}/${randomUUID()}`);
  for (const [position, r2Key] of keys.entries()) {
    await dataSource
      .getRepository(ProductImage)
      .save({ productId, r2Key, position, isMain: position === mainAt });
  }
  return keys;
}

async function seedRun(productId: string, scope: PreparationRun['scope']): Promise<string> {
  const saved = await dataSource.getRepository(PreparationRun).save({
    productId,
    scope,
    idempotencyKey: randomUUID(),
    status: 'queued',
    errorCode: null,
    model: MODEL,
    inputTokens: 0,
    outputTokens: 0,
    startedAt: null,
    finishedAt: null,
  });
  return saved.id;
}

/** `created_at` is a `@CreateDateColumn`, which an ORM update leaves alone — hence raw SQL. */
async function ageRun(runId: string, ageSeconds: number): Promise<void> {
  await dataSource.query(
    `update product_preparation_runs set created_at = now() - make_interval(secs => $2) where id = $1`,
    [runId, ageSeconds],
  );
}

async function loadRun(runId: string): Promise<PreparationRun> {
  const run = await dataSource.getRepository(PreparationRun).findOneBy({ id: runId });
  assert.ok(run, `run ${runId} was expected to exist`);
  return run;
}

async function loadCard(productId: string): Promise<Product> {
  const card = await dataSource.getRepository(Product).findOneBy({ id: productId });
  assert.ok(card, `card ${productId} was expected to exist`);
  return card;
}

async function suggestionsOf(runId: string): Promise<{ field: string; value: unknown }[]> {
  const rows = await dataSource
    .getRepository(FieldSuggestion)
    .find({ where: { runId }, order: { field: 'ASC' } });
  return rows.map(({ field, value }) => ({ field, value }));
}

function setup(
  script: Script = {},
  runs: PreparationRepository = new PreparationRepository(dataSource),
  gemini: GeminiAdapter | null = null,
): { service: PreparationService; adapter: ScriptedAnthropicAdapter; media: KeyEchoingMedia } {
  const adapter = new ScriptedAnthropicAdapter(script);
  const media = new KeyEchoingMedia();
  const service = new PreparationService(
    adapter,
    gemini,
    runs,
    new ProductRepository(dataSource),
    media,
  );
  return { service, adapter, media };
}

function setupWithGemini(result: PriceSearchResult): {
  service: PreparationService;
  gemini: ScriptedGeminiAdapter;
  media: KeyEchoingMedia;
} {
  const gemini = new ScriptedGeminiAdapter(result);
  const { service, media } = setup({}, new PreparationRepository(dataSource), gemini);
  return { service, gemini, media };
}

async function textsJob(scope: 'texts' | 'both' = 'texts'): Promise<PreparationJob> {
  const productId = await seedProduct();
  await seedGallery(productId, 2);
  return { runId: await seedRun(productId, scope), productId, scope };
}

async function priceJob(): Promise<PreparationJob> {
  const productId = await seedProduct();
  await seedGallery(productId, 2);
  return { runId: await seedRun(productId, 'price'), productId, scope: 'price' };
}

/** A price suggestion left by an earlier run, as the card would carry it before this one. */
async function seedPriceSuggestion(productId: string): Promise<void> {
  await dataSource.getRepository(FieldSuggestion).save({
    productId,
    runId: await seedRun(productId, 'price'),
    field: 'price',
    value: { priceFrom: '1800.00', priceTo: '2400.00' },
  });
}

async function priceSuggestionOf(productId: string): Promise<FieldSuggestion | null> {
  return dataSource.getRepository(FieldSuggestion).findOneBy({ productId, field: 'price' });
}

/** The pair the api picked from the draft; it differs from the saved card on purpose. */
const SEARCH_PAIR = {
  title: 'Миша Logitech MX Master 3S графітова',
  description: 'Бездротова, Bluetooth і приймач, коробка й кабель у комплекті.',
};

async function pairedPriceJob(): Promise<Extract<PreparationJob, { title: string }>> {
  const productId = await seedProduct();
  await seedGallery(productId, 2);
  return { runId: await seedRun(productId, 'price'), productId, scope: 'price', ...SEARCH_PAIR };
}

const GEMINI_CALL: PriceSearchCall = {
  model: 'gemini-3.5-flash-lite',
  webSearchQueries: ['Logitech MX Master 3S ціна OLX'],
  groundingUris: [],
  inputTokens: 900,
  outputTokens: 300,
};

const LISTINGS = [
  { price: '1800.00', url: 'https://www.olx.ua/d/uk/obyavlenie/mysha-logitech-mx-master-3s.html' },
  { price: '2400.00', url: 'https://prom.ua/ua/p123456-mysha-logitech-mx-master.html' },
];

function found(priceFrom: string, priceTo: string): PriceSearchResult {
  return { kind: 'found', priceFrom, priceTo, listings: LISTINGS, call: GEMINI_CALL };
}

const PRICE_NOT_CONFIGURED = 'price search is not configured';

const TEXT_SUGGESTIONS = [
  { field: 'description_olx', value: 'Опис для OLX.' },
  { field: 'description_prom', value: 'Опис для Prom.' },
  { field: 'seo_keywords', value: ['миша', 'logitech'] },
  { field: 'title_olx', value: 'Миша Logitech MX Master 3, бездротова' },
  { field: 'title_prom', value: 'Бездротова миша Logitech MX Master 3' },
];

function setupBoth(
  result: PriceSearchResult,
  script: Script = {},
): {
  service: PreparationService;
  gemini: TimedGeminiAdapter;
  runs: UsageRecordingRepository;
  timeline: string[];
} {
  const timeline: string[] = [];
  const gemini = new TimedGeminiAdapter(result, timeline);
  const runs = new UsageRecordingRepository(dataSource);
  const service = new PreparationService(
    new TimedAnthropicAdapter(script, timeline),
    gemini,
    runs,
    new ProductRepository(dataSource),
    new KeyEchoingMedia(),
  );
  return { service, gemini, runs, timeline };
}

/** A card nobody has filled in yet: the search can only lean on what the model writes. */
async function emptyCardBothJob(): Promise<PreparationJob> {
  const productId = await seedProduct({
    titleProm: '',
    titleOlx: '',
    descriptionProm: '',
    descriptionOlx: '',
  });
  await seedGallery(productId, 2);
  return { runId: await seedRun(productId, 'both'), productId, scope: 'both' };
}

/** 239 characters, and the 200th falls inside a word: 33 whole words (197 characters) fit. */
const OVERLONG_TITLE = Array.from({ length: 40 }, () => 'мишка').join(' ');
const OVERLONG_TITLE_CUT = Array.from({ length: 33 }, () => 'мишка').join(' ');

describe('preparation service (postgres)', () => {
  before(async () => {
    await prepareTestDatabase();
    await dataSource.initialize();
  });

  after(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Frames, runs and suggestions all go with the card through `on delete cascade`.
    await resetTables(dataSource, [PRODUCTS_TABLE]);
  });

  describe('scope: texts', () => {
    it('stores both titles, the Prom description, the keywords and the OLX description as five separate suggestions', async () => {
      const { service } = setup();
      const job = await textsJob();

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.errorCode, null);
    });

    it('puts each title on one line and cuts an overlong one at a word boundary, leaving the descriptions as written', async () => {
      const multiLineDescription = `Перший рядок опису.\n${OVERLONG_TITLE}`;
      const { service } = setup({
        texts: {
          ...TEXTS,
          titleProm: '  Бездротова миша\nLogitech MX Master 3 ',
          titleOlx: OVERLONG_TITLE,
          descriptionOlx: multiLineDescription,
        },
      });
      const job = await textsJob();

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), [
        { field: 'description_olx', value: multiLineDescription },
        { field: 'description_prom', value: 'Опис для Prom.' },
        { field: 'seo_keywords', value: ['миша', 'logitech'] },
        { field: 'title_olx', value: OVERLONG_TITLE_CUT },
        { field: 'title_prom', value: 'Бездротова миша Logitech MX Master 3' },
      ]);
      assert.ok(OVERLONG_TITLE_CUT.length <= productConstraints.titleMaxLength);
    });

    it('recognizes the item from the main frame first and sends at most three frames', async () => {
      const { service, adapter } = setup();
      const productId = await seedProduct();
      const keys = await seedGallery(productId, 4, 2);
      const runId = await seedRun(productId, 'texts');

      await service.prepare({ runId, productId, scope: 'texts' });

      const [frames] = adapter.textsCalls;
      assert.ok(frames, 'expected the texts call to have been made');
      const decoder = new TextDecoder();
      assert.deepEqual(
        frames.map((frame) => decoder.decode(frame)),
        [keys[2], keys[0], keys[1]],
      );
    });

    it('does not ask for a price when only the texts were requested', async () => {
      const { service } = setup();
      const job = await textsJob();

      await service.prepare(job);

      assert.equal(
        (await suggestionsOf(job.runId)).some(({ field }) => field === 'price'),
        false,
      );
    });

    it('records the model and the tokens of the call on the run', async () => {
      const { service } = setup();
      const job = await textsJob();

      await service.prepare(job);

      const run = await loadRun(job.runId);
      assert.equal(run.model, MODEL);
      assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens);
      assert.equal(run.outputTokens, TEXTS_USAGE.outputTokens);
    });
  });

  describe('scope: both', () => {
    it('keeps the five text suggestions and ends the run price_unavailable without a price suggestion', async () => {
      const { service } = setup();
      const job = await textsJob('both');

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'price_unavailable');
      assert.equal(run.errorDetail, PRICE_NOT_CONFIGURED);
      assert.notEqual(run.finishedAt, null);
      assert.equal(run.model, MODEL);
      assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens);
      assert.equal(run.outputTokens, TEXTS_USAGE.outputTokens);
    });

    it('rethrows for a retry and stores nothing when the texts call fails', async () => {
      const { service } = setup({ textsFailure: new ModelAnswerUnavailable('refused') });
      const job = await textsJob('both');

      await assert.rejects(service.prepare(job), ModelAnswerUnavailable);

      assert.deepEqual(await suggestionsOf(job.runId), []);
      assert.notEqual((await loadRun(job.runId)).status, 'succeeded');
    });
  });

  describe('scope: both through Gemini', () => {
    it('searches by the title and the description the model has just written, not by the saved card', async () => {
      const { service, gemini } = setupBoth(found('1800.00', '2400.00'), {
        texts: { ...TEXTS, titleProm: '  Бездротова миша\nLogitech MX Master 3 ' },
      });
      const job = await emptyCardBothJob();

      await service.prepare(job);

      assert.equal(gemini.queries.length, 1);
      const [query] = gemini.queries;
      assert.equal(query?.title, 'Бездротова миша Logitech MX Master 3');
      assert.equal(query.description, TEXTS.descriptionProm);
    });

    it('searches by the OLX title and description when the model left the Prom ones empty', async () => {
      const { service, gemini } = setupBoth(found('1800.00', '2400.00'), {
        texts: { ...TEXTS, titleProm: '', descriptionProm: '' },
      });
      const job = await emptyCardBothJob();

      await service.prepare(job);

      assert.equal(gemini.queries.length, 1);
      const [query] = gemini.queries;
      assert.equal(query?.title, TEXTS.titleOlx);
      assert.equal(query.description, TEXTS.descriptionOlx);
    });

    it('asks Gemini only after Claude has prepared the texts', async () => {
      const { service, timeline } = setupBoth(found('1800.00', '2400.00'));
      const job = await textsJob('both');

      await service.prepare(job);

      assert.deepEqual(timeline, ['claude', 'gemini']);
    });

    it('stores the texts and the range in one succeeded run that carries only the Claude tokens', async () => {
      const { service, runs } = setupBoth(found('1800.00', '2400.00'));
      const job = await textsJob('both');
      await seedPriceSuggestion(job.productId);

      await service.prepare(job);

      const run = await loadRun(job.runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.errorCode, null);
      assert.notEqual(run.finishedAt, null);
      assert.equal(run.model, MODEL);
      assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens);
      assert.equal(run.outputTokens, TEXTS_USAGE.outputTokens);
      assert.deepEqual(runs.usages, [TEXTS_USAGE]);
      assert.deepEqual(await suggestionsOf(job.runId), [
        ...TEXT_SUGGESTIONS.slice(0, 2),
        { field: 'price', value: { priceFrom: '1800.00', priceTo: '2400.00', listings: LISTINGS } },
        ...TEXT_SUGGESTIONS.slice(2),
      ]);
      assert.equal((await priceSuggestionOf(job.productId))?.runId, job.runId);
    });

    const failures: { name: string; result: PriceSearchResult; errorCode: string }[] = [
      {
        name: 'Gemini is unavailable',
        result: { kind: 'unavailable', reason: 'HTTP 500: Internal error encountered.' },
        errorCode: 'price_unavailable',
      },
      {
        name: 'the daily quota is spent',
        result: {
          kind: 'quotaExhausted',
          reason: 'HTTP 429: GenerateRequestsPerDayPerProjectPerModel',
        },
        errorCode: 'price_quota_exhausted',
      },
      {
        name: 'the answer does not parse as a range',
        result: { kind: 'unparsed', call: GEMINI_CALL },
        errorCode: 'price_not_found',
      },
      {
        name: 'the lower bound is above the upper one',
        result: found('2400.00', '1800.00'),
        errorCode: 'price_not_found',
      },
    ];

    for (const { name, result, errorCode } of failures) {
      it(`keeps the five text suggestions and ends the run ${errorCode} without a price when ${name}`, async () => {
        const { service, gemini, runs } = setupBoth(result);
        const job = await textsJob('both');
        await seedPriceSuggestion(job.productId);
        const previous = await priceSuggestionOf(job.productId);
        assert.ok(previous, 'expected the earlier price suggestion to be seeded');

        await assert.doesNotReject(service.prepare(job));

        assert.equal(gemini.queries.length, 1);
        const run = await loadRun(job.runId);
        assert.equal(run.status, 'failed');
        assert.equal(run.errorCode, errorCode);
        assert.notEqual(run.finishedAt, null);
        assert.equal(run.model, MODEL);
        assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens);
        assert.equal(run.outputTokens, TEXTS_USAGE.outputTokens);
        assert.deepEqual(runs.usages, [TEXTS_USAGE]);
        assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
        assert.deepEqual(await priceSuggestionOf(job.productId), previous);
      });
    }

    it('keeps the texts and ends the run price_not_found without searching when the model wrote neither a title nor a description', async () => {
      const { service, gemini } = setupBoth(found('1800.00', '2400.00'), {
        texts: { ...TEXTS, titleProm: '', titleOlx: '', descriptionProm: '', descriptionOlx: '' },
      });
      const job = await emptyCardBothJob();

      await assert.doesNotReject(service.prepare(job));

      assert.equal(gemini.queries.length, 0);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'price_not_found');
      assert.deepEqual(await suggestionsOf(job.runId), [
        { field: 'description_olx', value: '' },
        { field: 'description_prom', value: '' },
        { field: 'seo_keywords', value: TEXTS.seoKeywords },
        { field: 'title_olx', value: '' },
        { field: 'title_prom', value: '' },
      ]);
    });
  });

  describe('scope: price', () => {
    it('keeps the card and the previous price suggestion and ends the run price_unavailable without throwing', async () => {
      const { service } = setup();
      const job = await priceJob();
      await seedPriceSuggestion(job.productId);
      const previous = await priceSuggestionOf(job.productId);
      assert.ok(previous, 'expected the earlier price suggestion to be seeded');
      const cardBefore = await loadCard(job.productId);

      await service.prepare(job);

      assert.deepEqual(await loadCard(job.productId), cardBefore);
      assert.deepEqual(await priceSuggestionOf(job.productId), previous);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'price_unavailable');
      assert.equal(run.errorDetail, PRICE_NOT_CONFIGURED);
      assert.notEqual(run.finishedAt, null);
    });

    it('closes the run with neither suggestions nor tokens and without preparing the texts', async () => {
      const { service, adapter, media } = setup();
      const job = await priceJob();

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), []);
      assert.equal(adapter.textsCalls.length, 0);
      assert.deepEqual(media.reads, []);
      const run = await loadRun(job.runId);
      assert.equal(run.errorCode, 'price_unavailable');
      assert.equal(run.errorDetail, PRICE_NOT_CONFIGURED);
      assert.equal(run.inputTokens, 0);
      assert.equal(run.outputTokens, 0);
    });
  });

  describe('scope: price through Gemini', () => {
    it('stores the range with its listings and succeeds without recording tokens', async () => {
      const { service, gemini } = setupWithGemini(found('1800.00', '2400.00'));
      const job = await pairedPriceJob();
      await seedPriceSuggestion(job.productId);

      await service.prepare(job);

      assert.equal(gemini.queries.length, 1);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.errorCode, null);
      assert.equal(run.inputTokens, 0);
      assert.equal(run.outputTokens, 0);
      assert.deepEqual(await suggestionsOf(job.runId), [
        { field: 'price', value: { priceFrom: '1800.00', priceTo: '2400.00', listings: LISTINGS } },
      ]);
      assert.equal((await priceSuggestionOf(job.productId))?.runId, job.runId);
    });

    it('searches by the pair from the payload, not by the saved card, and sends no frames', async () => {
      const { service, gemini, media } = setupWithGemini(found('1800.00', '2400.00'));
      const job = await pairedPriceJob();

      await service.prepare(job);

      assert.equal(gemini.queries.length, 1);
      const [query] = gemini.queries;
      assert.equal(query?.title, SEARCH_PAIR.title);
      assert.equal(query.description, SEARCH_PAIR.description);
      assert.deepEqual(query.frames ?? [], []);
      assert.deepEqual(media.reads, []);
    });

    it('accepts a range whose bounds are equal', async () => {
      const { service } = setupWithGemini(found('2000.00', '2000.00'));
      const job = await pairedPriceJob();

      await service.prepare(job);

      assert.equal((await loadRun(job.runId)).status, 'succeeded');
      assert.deepEqual(await suggestionsOf(job.runId), [
        { field: 'price', value: { priceFrom: '2000.00', priceTo: '2000.00', listings: LISTINGS } },
      ]);
    });

    it('compares the bounds as numbers, not as strings', async () => {
      const { service } = setupWithGemini(found('950.00', '1200.00'));
      const job = await pairedPriceJob();

      await service.prepare(job);

      assert.equal((await loadRun(job.runId)).status, 'succeeded');
      assert.deepEqual(await suggestionsOf(job.runId), [
        { field: 'price', value: { priceFrom: '950.00', priceTo: '1200.00', listings: LISTINGS } },
      ]);
    });

    const failures: { name: string; result: PriceSearchResult; errorCode: string }[] = [
      {
        name: 'the network fails',
        result: { kind: 'unavailable', reason: 'TypeError: fetch failed' },
        errorCode: 'price_unavailable',
      },
      {
        name: 'Gemini answers 500',
        result: { kind: 'unavailable', reason: 'HTTP 500: Internal error encountered.' },
        errorCode: 'price_unavailable',
      },
      {
        name: 'Gemini does not answer within the timeout',
        result: {
          kind: 'unavailable',
          reason: 'TimeoutError: The operation was aborted due to timeout',
        },
        errorCode: 'price_unavailable',
      },
      {
        name: 'Gemini answers 429 without a daily quota',
        result: {
          kind: 'unavailable',
          reason: 'HTTP 429: GenerateRequestsPerMinutePerProjectPerModel',
        },
        errorCode: 'price_unavailable',
      },
      {
        name: 'Gemini answers 429 for the daily quota',
        result: {
          kind: 'quotaExhausted',
          reason: 'HTTP 429: GenerateRequestsPerDayPerProjectPerModel',
        },
        errorCode: 'price_quota_exhausted',
      },
      {
        name: 'the answer does not parse as a range',
        result: { kind: 'unparsed', call: GEMINI_CALL },
        errorCode: 'price_not_found',
      },
      {
        name: 'the lower bound is above the upper one',
        result: found('2400.00', '1800.00'),
        errorCode: 'price_not_found',
      },
      {
        name: 'a bound is zero',
        result: found('0.00', '2400.00'),
        errorCode: 'price_not_found',
      },
    ];

    for (const { name, result, errorCode } of failures) {
      it(`ends the run ${errorCode} after one search, without throwing, when ${name}`, async () => {
        const { service, gemini } = setupWithGemini(result);
        const job = await pairedPriceJob();
        await seedPriceSuggestion(job.productId);
        const previous = await priceSuggestionOf(job.productId);
        assert.ok(previous, 'expected the earlier price suggestion to be seeded');
        const cardBefore = await loadCard(job.productId);

        await assert.doesNotReject(service.prepare(job));

        assert.equal(gemini.queries.length, 1);
        const run = await loadRun(job.runId);
        assert.equal(run.status, 'failed');
        assert.equal(run.errorCode, errorCode);
        assert.notEqual(run.finishedAt, null);
        assert.equal(run.inputTokens, 0);
        assert.equal(run.outputTokens, 0);
        assert.deepEqual(await suggestionsOf(job.runId), []);
        assert.deepEqual(await priceSuggestionOf(job.productId), previous);
        assert.deepEqual(await loadCard(job.productId), cardBefore);
      });
    }
  });

  describe('scope: field', () => {
    it('rewrites one field from its draft without reading a single frame (ADR 0015)', async () => {
      const { service, adapter, media } = setup();
      const productId = await seedProduct();
      await seedGallery(productId, 2);
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'titleProm',
        draftText: 'миша лоджитек',
      });

      assert.deepEqual(adapter.fieldCalls, [
        { field: 'titleProm', draftText: 'миша лоджитек', mode: 'improve' },
      ]);
      assert.deepEqual(media.reads, []);
      assert.equal(adapter.textsCalls.length, 0);
      assert.deepEqual(await suggestionsOf(runId), [
        { field: 'title_prom', value: 'Новий варіант.' },
      ]);
      const run = await loadRun(runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.inputTokens, FIELD_USAGE.inputTokens);
      assert.equal(run.outputTokens, FIELD_USAGE.outputTokens);
    });

    it('puts a rewritten title on one line', async () => {
      const { service } = setup({ fieldValue: ' Миша Logitech\nMX Master 3  ' });
      const productId = await seedProduct();
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'titleOlx',
        draftText: 'миша лоджитек',
      });

      assert.deepEqual(await suggestionsOf(runId), [
        { field: 'title_olx', value: 'Миша Logitech MX Master 3' },
      ]);
    });

    it('cuts an overlong rewritten title at a word boundary within the column limit', async () => {
      const { service } = setup({ fieldValue: OVERLONG_TITLE });
      const productId = await seedProduct();
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'titleProm',
        draftText: 'миша лоджитек',
      });

      assert.deepEqual(await suggestionsOf(runId), [
        { field: 'title_prom', value: OVERLONG_TITLE_CUT },
      ]);
    });

    it('stores a rewritten keyword list as a list (ADR 0015)', async () => {
      const { service } = setup();
      const productId = await seedProduct();
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'seoKeywords',
        draftText: 'миша, logitech',
      });

      assert.deepEqual(await suggestionsOf(runId), [
        { field: 'seo_keywords', value: ['миша', 'logitech', 'mx master'] },
      ]);
    });

    it('passes improve to the adapter when job has no mode (backward compat)', async () => {
      const { service, adapter } = setup();
      const productId = await seedProduct();
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'titleProm',
        draftText: 'миша лоджитек',
        // mode absent — simulates an old queue job
      });

      assert.deepEqual(adapter.fieldCalls[0]?.mode, 'improve');
    });

    it('passes prompt to the adapter when job has mode prompt', async () => {
      const { service, adapter } = setup();
      const productId = await seedProduct();
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'descriptionProm',
        draftText: 'скатертина льон, 140x120, нова',
        mode: 'prompt',
      });

      assert.deepEqual(adapter.fieldCalls[0]?.mode, 'prompt');
    });

    it('normalizes a rewritten title in prompt mode too', async () => {
      const { service } = setup({ fieldValue: '  Миша Logitech\nMX Master  ' });
      const productId = await seedProduct();
      const runId = await seedRun(productId, 'field');

      await service.prepare({
        runId,
        productId,
        scope: 'field',
        field: 'titleOlx',
        draftText: 'інструкція',
        mode: 'prompt',
      });

      assert.deepEqual(await suggestionsOf(runId), [
        { field: 'title_olx', value: 'Миша Logitech MX Master' },
      ]);
    });
  });

  describe('retry and completion', () => {
    it('adds the tokens of a retried attempt to those of the first one', async () => {
      const { service } = setup({}, new FlakyFinishRepository(dataSource));
      const job = await textsJob();

      await assert.rejects(service.prepare(job), ConnectionLost);
      await service.prepare(job);

      const run = await loadRun(job.runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.inputTokens, 2 * TEXTS_USAGE.inputTokens);
      assert.equal(run.outputTokens, 2 * TEXTS_USAGE.outputTokens);
      assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
    });

    it('never shows a finished run without its suggestions when the finishing write fails', async () => {
      const { service } = setup({}, new FlakyFinishRepository(dataSource));
      const job = await textsJob();

      await assert.rejects(service.prepare(job), ConnectionLost);

      const run = await loadRun(job.runId);
      assert.notEqual(run.status, 'succeeded');
      assert.equal(run.finishedAt, null);
      assert.deepEqual(await suggestionsOf(job.runId), []);
    });

    it('does nothing when the job is redelivered after its run has finished', async () => {
      const { service, adapter } = setup();
      const job = await textsJob();
      await service.prepare(job);

      await service.prepare(job);

      const run = await loadRun(job.runId);
      assert.equal(adapter.textsCalls.length, 1);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens);
      assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
    });

    it('ends the run failed with preparation_failed once the retries are spent', async () => {
      const { service } = setup({ textsFailure: new ModelAnswerUnavailable('refused') });
      const job = await textsJob();

      await assert.rejects(service.prepare(job), ModelAnswerUnavailable);
      await service.abandon(job.runId, new ModelAnswerUnavailable('refused'));

      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'preparation_failed');
      assert.equal(run.errorDetail, 'refused');
      assert.notEqual(run.finishedAt, null);
      assert.equal(run.inputTokens, 0);
      assert.deepEqual(await suggestionsOf(job.runId), []);
    });

    it('never writes into the card in any scope or outcome (ADR 0006)', async () => {
      const productId = await seedProduct();
      await seedGallery(productId, 2);
      const before = await loadCard(productId);

      const attempts: { script: Script; job: PreparationJob }[] = [
        {
          script: {},
          job: { runId: await seedRun(productId, 'texts'), productId, scope: 'texts' },
        },
        {
          script: {},
          job: { runId: await seedRun(productId, 'price'), productId, scope: 'price' },
        },
        { script: {}, job: { runId: await seedRun(productId, 'both'), productId, scope: 'both' } },
        {
          script: {},
          job: {
            runId: await seedRun(productId, 'field'),
            productId,
            scope: 'field',
            field: 'descriptionOlx',
            draftText: 'чернетка опису',
          },
        },
      ];

      for (const { script, job } of attempts) {
        await setup(script).service.prepare(job);
      }

      assert.deepEqual(await loadCard(productId), before);
    });
  });

  describe('the sweep of stuck runs', () => {
    it('closes a run whose last attempt died without closing it', async () => {
      const { service } = setup();
      const job = await textsJob();
      await ageRun(job.runId, config.queue.preparation.stuckAfterSeconds + 60);

      assert.equal(await service.closeStuckRuns(), 1);

      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'preparation_failed');
      assert.deepEqual(await suggestionsOf(job.runId), []);
    });

    it('leaves a run alone while its own series of attempts could still be running', async () => {
      const { service } = setup();
      const job = await textsJob();
      // Older than a single attempt, younger than the whole series: the threshold has to cover
      // every retry, or the sweep would close a run pg-boss is about to hand over again.
      await ageRun(job.runId, config.queue.preparation.expireInSeconds + 60);

      assert.equal(await service.closeStuckRuns(), 0);
      assert.equal((await loadRun(job.runId)).status, 'queued');
    });
  });
});
