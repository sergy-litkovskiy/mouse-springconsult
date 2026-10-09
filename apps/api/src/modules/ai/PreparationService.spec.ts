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
  type RunOutcome,
} from '../products/index.ts';
import {
  AnthropicAdapter,
  ModelAnswerUnavailable,
  type FieldRewriteResult,
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

const TEXT_SUGGESTIONS = [
  { field: 'description_olx', value: 'Опис для OLX.' },
  { field: 'description_prom', value: 'Опис для Prom.' },
  { field: 'seo_keywords', value: ['миша', 'logitech'] },
  { field: 'title_olx', value: 'Миша Logitech MX Master 3, бездротова' },
  { field: 'title_prom', value: 'Бездротова миша Logitech MX Master 3' },
];

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
    it('rethrows for a retry and stores nothing when the texts call fails', async () => {
      const { service } = setup({ textsFailure: new ModelAnswerUnavailable('refused') });
      const job = await textsJob('both');

      await assert.rejects(service.prepare(job), ModelAnswerUnavailable);

      assert.deepEqual(await suggestionsOf(job.runId), []);
      assert.notEqual((await loadRun(job.runId)).status, 'succeeded');
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
