import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from '../../../db/test-database.ts';
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
  type RunOutcome,
} from '../products/index.ts';
import {
  AnthropicAdapter,
  ModelAnswerUnavailable,
  type FieldRewriteResult,
  type PriceResult,
  type RewritableField,
  type TextsResult,
} from './AnthropicAdapter.ts';
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
const PRICE_USAGE = { model: MODEL, inputTokens: 300, outputTokens: 50 };
const FIELD_USAGE = { model: MODEL, inputTokens: 120, outputTokens: 30 };

const TEXTS: TextsResult = {
  recognizedItem: 'бездротова миша Logitech MX Master 3',
  descriptionProm: 'Опис для Prom.',
  descriptionOlx: 'Опис для OLX.',
  seoKeywords: ['миша', 'logitech'],
  usage: TEXTS_USAGE,
};

const PRICE: PriceResult = {
  priceFrom: '1800.00',
  priceTo: '2400.00',
  sources: ['https://example.com/mx-master-3'],
  usage: PRICE_USAGE,
};

type Script = { readonly textsFailure?: Error; readonly priceFailure?: Error };

/** Never talks to Anthropic: every public method is overridden and records what it was given. */
class ScriptedAnthropicAdapter extends AnthropicAdapter {
  readonly textsCalls: (readonly Uint8Array[])[] = [];
  readonly priceQueries: string[] = [];
  readonly fieldCalls: { field: RewritableField; draftText: string }[] = [];

  constructor(private readonly script: Script) {
    super('test-key');
  }

  override async generateTexts(frames: readonly Uint8Array[]): Promise<TextsResult> {
    this.textsCalls.push(frames);
    if (this.script.textsFailure !== undefined) {
      throw this.script.textsFailure;
    }
    return TEXTS;
  }

  override async findPriceRange(query: string): Promise<PriceResult> {
    this.priceQueries.push(query);
    if (this.script.priceFailure !== undefined) {
      throw this.script.priceFailure;
    }
    return PRICE;
  }

  override async rewriteField(
    field: RewritableField,
    draftText: string,
  ): Promise<FieldRewriteResult> {
    this.fieldCalls.push({ field, draftText });
    return field === 'seoKeywords'
      ? { value: ['миша', 'logitech', 'mx master'], usage: FIELD_USAGE }
      : { value: 'Новий варіант.', usage: FIELD_USAGE };
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
): { service: PreparationService; adapter: ScriptedAnthropicAdapter; media: KeyEchoingMedia } {
  const adapter = new ScriptedAnthropicAdapter(script);
  const media = new KeyEchoingMedia();
  const service = new PreparationService(adapter, runs, new ProductRepository(dataSource), media);
  return { service, adapter, media };
}

async function textsJob(scope: 'texts' | 'both' = 'texts'): Promise<PreparationJob> {
  const productId = await seedProduct();
  await seedGallery(productId, 2);
  return { runId: await seedRun(productId, scope), productId, scope };
}

async function priceJob(seed: CardSeed = {}): Promise<PreparationJob> {
  const productId = await seedProduct(seed);
  return { runId: await seedRun(productId, 'price'), productId, scope: 'price' };
}

const TEXT_SUGGESTIONS = [
  { field: 'description_olx', value: 'Опис для OLX.' },
  { field: 'description_prom', value: 'Опис для Prom.' },
  { field: 'seo_keywords', value: ['миша', 'logitech'] },
];

const PRICE_SUGGESTION = { field: 'price', value: { priceFrom: '1800.00', priceTo: '2400.00' } };

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
    it('stores the Prom description, the keywords and the OLX description as three separate suggestions (AC-05)', async () => {
      const { service } = setup();
      const job = await textsJob();

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.errorCode, null);
    });

    it('recognizes the item from the main frame first and sends at most three frames (AC-05)', async () => {
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

    it('does not ask for a price when only the texts were requested (AC-05)', async () => {
      const { service, adapter } = setup();
      const job = await textsJob();

      await service.prepare(job);

      assert.deepEqual(adapter.priceQueries, []);
      assert.equal(
        (await suggestionsOf(job.runId)).some(({ field }) => field === 'price'),
        false,
      );
    });

    it('records the model and the tokens of the call on the run (AC-14)', async () => {
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
    it('stores the texts and the price range as four separate suggestions (AC-05, AC-08)', async () => {
      const { service } = setup();
      const job = await textsJob('both');

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), [
        TEXT_SUGGESTIONS[0],
        TEXT_SUGGESTIONS[1],
        PRICE_SUGGESTION,
        TEXT_SUGGESTIONS[2],
      ]);
      assert.equal((await loadRun(job.runId)).status, 'succeeded');
    });

    it('adds the tokens of both calls to the run (AC-14)', async () => {
      const { service } = setup();
      const job = await textsJob('both');

      await service.prepare(job);

      const run = await loadRun(job.runId);
      assert.equal(run.model, MODEL);
      assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens + PRICE_USAGE.inputTokens);
      assert.equal(run.outputTokens, TEXTS_USAGE.outputTokens + PRICE_USAGE.outputTokens);
    });

    it('keeps the texts and ends the run failed with price_unavailable when the price call fails (AC-10b)', async () => {
      const { service } = setup({ priceFailure: new ModelAnswerUnavailable('refused') });
      const job = await textsJob('both');

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), TEXT_SUGGESTIONS);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'price_unavailable');
      assert.equal(run.inputTokens, TEXTS_USAGE.inputTokens);
      assert.equal(run.outputTokens, TEXTS_USAGE.outputTokens);
    });

    it('rethrows for a retry and stores nothing when both calls fail (Checklist 6)', async () => {
      const { service } = setup({
        textsFailure: new ModelAnswerUnavailable('refused'),
        priceFailure: new ModelAnswerUnavailable('refused'),
      });
      const job = await textsJob('both');

      await assert.rejects(service.prepare(job), ModelAnswerUnavailable);

      assert.deepEqual(await suggestionsOf(job.runId), []);
      assert.notEqual((await loadRun(job.runId)).status, 'succeeded');
    });
  });

  describe('scope: price', () => {
    it('stores the range as a single price suggestion without re-running the texts (AC-08, AC-10b)', async () => {
      const { service, adapter, media } = setup();
      const job = await priceJob();

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), [PRICE_SUGGESTION]);
      assert.equal(adapter.textsCalls.length, 0);
      assert.deepEqual(media.reads, []);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'succeeded');
      assert.equal(run.inputTokens, PRICE_USAGE.inputTokens);
      assert.equal(run.outputTokens, PRICE_USAGE.outputTokens);
    });

    it('ends the run failed with price_unavailable and no suggestions when the call fails (AC-10b)', async () => {
      const { service } = setup({ priceFailure: new ModelAnswerUnavailable('refused') });
      const job = await priceJob();

      await service.prepare(job);

      assert.deepEqual(await suggestionsOf(job.runId), []);
      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'price_unavailable');
    });

    // The card's text columns are NOT NULL with '' as the default, so "absent" in the AC-27
    // formula is an empty string, not a null.
    it('queries with the Prom title and the Prom description when the card has both of each (AC-27)', async () => {
      const { service, adapter } = setup();
      const job = await priceJob();

      await service.prepare(job);

      assert.deepEqual(adapter.priceQueries, [
        'Миша Logitech MX Master 3 Бездротова, повний комплект.',
      ]);
    });

    it('falls back to the OLX title and the OLX description when the Prom ones are empty (AC-27)', async () => {
      const { service, adapter } = setup();
      const job = await priceJob({ titleProm: '', descriptionProm: '' });

      await service.prepare(job);

      assert.deepEqual(adapter.priceQueries, [
        'Logitech MX Master 3 миша Продам мишу, стан відмінний.',
      ]);
    });

    it('queries with the title alone when the card has no description at all (AC-27)', async () => {
      const { service, adapter } = setup();
      const job = await priceJob({ descriptionProm: '', descriptionOlx: '' });

      await service.prepare(job);

      assert.deepEqual(adapter.priceQueries, ['Миша Logitech MX Master 3']);
    });

    it('takes the title and the description independently of each other (AC-27)', async () => {
      const { service, adapter } = setup();
      const job = await priceJob({ titleProm: '', descriptionOlx: '' });

      await service.prepare(job);

      assert.deepEqual(adapter.priceQueries, [
        'Logitech MX Master 3 миша Бездротова, повний комплект.',
      ]);
    });
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

      assert.deepEqual(adapter.fieldCalls, [{ field: 'titleProm', draftText: 'миша лоджитек' }]);
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
  });

  describe('retry and completion', () => {
    it('adds the tokens of a retried attempt to those of the first one (DoD retry)', async () => {
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

    it('never shows a finished run without its suggestions when the finishing write fails (AC-28)', async () => {
      const { service } = setup({}, new FlakyFinishRepository(dataSource));
      const job = await textsJob();

      await assert.rejects(service.prepare(job), ConnectionLost);

      const run = await loadRun(job.runId);
      assert.notEqual(run.status, 'succeeded');
      assert.equal(run.finishedAt, null);
      assert.deepEqual(await suggestionsOf(job.runId), []);
    });

    it('does nothing when the job is redelivered after its run has finished (AC-28)', async () => {
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

    it('ends the run failed with model_unavailable once the retries are spent (AC-10)', async () => {
      const { service } = setup({ textsFailure: new ModelAnswerUnavailable('refused') });
      const job = await textsJob();

      await assert.rejects(service.prepare(job), ModelAnswerUnavailable);
      await service.abandon(job.runId);

      const run = await loadRun(job.runId);
      assert.equal(run.status, 'failed');
      assert.equal(run.errorCode, 'model_unavailable');
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
          script: { priceFailure: new ModelAnswerUnavailable('refused') },
          job: { runId: await seedRun(productId, 'both'), productId, scope: 'both' },
        },
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
});
