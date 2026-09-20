import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from '../../../db/test-database.ts';
import { createDataSource } from '../../db.ts';
import { FieldSuggestion } from './FieldSuggestion.ts';
import { PreparationRepository } from './PreparationRepository.ts';
import { PreparationRun, type PreparationStatus } from './PreparationRun.ts';
import { PRODUCTS_TABLE, Product } from './Product.ts';
import { ProductImage } from './ProductImage.ts';

/**
 * Against a real Postgres: adding tokens instead of overwriting them and the transaction around
 * the finishing write are exactly what a stub would answer by construction.
 */

const dataSource = createDataSource({
  url: testDatabaseUrl(),
  entities: [Product, ProductImage, PreparationRun, FieldSuggestion],
});

let runs: PreparationRepository;

const MODEL = 'claude-sonnet-5';

async function seedProduct(): Promise<string> {
  const saved = await dataSource.getRepository(Product).save({
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова миша у відмінному стані.',
    titleOlx: 'Logitech MX Master 3 бездротова миша',
    descriptionOlx: 'Продам мишу Logitech, повний комплект.',
    price: '2499.00',
    seoKeywords: ['миша'],
    category: 'Периферія',
    publishedProm: false,
    publishedOlx: false,
    condition: 'used',
    promId: null,
    olxId: null,
  });
  return saved.id;
}

async function seedRun(
  productId: string,
  status: PreparationStatus = 'running',
  tokens: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 },
): Promise<string> {
  const saved = await dataSource.getRepository(PreparationRun).save({
    productId,
    scope: 'both',
    idempotencyKey: randomUUID(),
    status,
    errorCode: null,
    model: MODEL,
    ...tokens,
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

async function suggestionsOf(runId: string): Promise<FieldSuggestion[]> {
  return dataSource
    .getRepository(FieldSuggestion)
    .find({ where: { runId }, order: { field: 'ASC' } });
}

describe('preparation repository (postgres)', () => {
  before(async () => {
    await prepareTestDatabase();
    await dataSource.initialize();
    runs = new PreparationRepository(dataSource);
  });

  after(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // The run and suggestion tables go with the card: both reference it `on delete cascade`.
    await resetTables(dataSource, [PRODUCTS_TABLE]);
  });

  it('inserts a queued run with no tokens spent yet (Checklist 1)', async () => {
    const productId = await seedProduct();

    const created = await runs.createRun({
      productId,
      scope: 'texts',
      idempotencyKey: 'card:texts:v1',
      model: MODEL,
    });

    const stored = await loadRun(created.id);
    assert.equal(stored.productId, productId);
    assert.equal(stored.scope, 'texts');
    assert.equal(stored.idempotencyKey, 'card:texts:v1');
    assert.equal(stored.status, 'queued');
    assert.equal(stored.errorCode, null);
    assert.equal(stored.inputTokens, 0);
    assert.equal(stored.outputTokens, 0);
  });

  it('moves a queued run to running and stamps its start (Checklist 1)', async () => {
    const runId = await seedRun(await seedProduct(), 'queued');

    await runs.startRun(runId);

    const stored = await loadRun(runId);
    assert.equal(stored.status, 'running');
    assert.ok(stored.startedAt instanceof Date);
    assert.equal(stored.finishedAt, null);
  });

  it('refuses to restart a finished run, so a redelivered job cannot reopen it (AC-28)', async () => {
    const runId = await seedRun(await seedProduct(), 'queued');
    await runs.startRun(runId);
    await runs.finishRun(runId, { status: 'succeeded', suggestions: [] });

    const restarted = await runs.startRun(runId);

    assert.equal(restarted, false);
    assert.equal((await loadRun(runId)).status, 'succeeded');
  });

  it('adds the usage of every call to the run instead of overwriting it (AC-14, DoD retry)', async () => {
    const runId = await seedRun(await seedProduct());

    await runs.recordUsage(runId, { model: MODEL, inputTokens: 1000, outputTokens: 200 });
    await runs.recordUsage(runId, { model: MODEL, inputTokens: 300, outputTokens: 50 });

    const stored = await loadRun(runId);
    assert.equal(stored.model, MODEL);
    assert.equal(stored.inputTokens, 1300);
    assert.equal(stored.outputTokens, 250);
  });

  it('writes one row per suggestion and marks the run succeeded (AC-05, AC-28)', async () => {
    const runId = await seedRun(await seedProduct());

    await runs.finishRun(runId, {
      status: 'succeeded',
      suggestions: [
        { field: 'description_prom', value: 'Опис для Prom.' },
        { field: 'description_olx', value: 'Опис для OLX.' },
        { field: 'seo_keywords', value: ['миша', 'logitech'] },
        { field: 'price', value: { priceFrom: '1800.00', priceTo: '2400.00' } },
      ],
    });

    const stored = await loadRun(runId);
    assert.equal(stored.status, 'succeeded');
    assert.equal(stored.errorCode, null);
    assert.ok(stored.finishedAt instanceof Date);

    const suggestions = await suggestionsOf(runId);
    assert.deepEqual(
      suggestions.map(({ field, value, resolution }) => ({ field, value, resolution })),
      [
        { field: 'description_olx', value: 'Опис для OLX.', resolution: null },
        { field: 'description_prom', value: 'Опис для Prom.', resolution: null },
        {
          field: 'price',
          value: { priceFrom: '1800.00', priceTo: '2400.00' },
          resolution: null,
        },
        { field: 'seo_keywords', value: ['миша', 'logitech'], resolution: null },
      ],
    );
  });

  it('keeps the suggestions of a run that ends failed with its error code (AC-10b)', async () => {
    const runId = await seedRun(await seedProduct());

    await runs.finishRun(runId, {
      status: 'failed',
      errorCode: 'price_unavailable',
      suggestions: [{ field: 'description_prom', value: 'Опис для Prom.' }],
    });

    const stored = await loadRun(runId);
    assert.equal(stored.status, 'failed');
    assert.equal(stored.errorCode, 'price_unavailable');
    assert.ok(stored.finishedAt instanceof Date);
    assert.deepEqual(
      (await suggestionsOf(runId)).map(({ field }) => field),
      ['description_prom'],
    );
  });

  it('leaves the run unfinished and without suggestions when the finishing write fails (AC-28)', async () => {
    const runId = await seedRun(await seedProduct());

    // A second row for the same field breaks `product_field_suggestions_run_field_key`: the
    // only way to make the database itself refuse part of an otherwise valid write.
    await assert.rejects(
      runs.finishRun(runId, {
        status: 'succeeded',
        suggestions: [
          { field: 'description_prom', value: 'Перший варіант.' },
          { field: 'description_prom', value: 'Другий варіант.' },
        ],
      }),
      /product_field_suggestions_run_field_key/,
    );

    const stored = await loadRun(runId);
    assert.equal(stored.status, 'running');
    assert.equal(stored.finishedAt, null);
    assert.deepEqual(await suggestionsOf(runId), []);
  });

  it('sums the tokens of every run of a card and of that card only (Checklist 1, AC-14)', async () => {
    const productId = await seedProduct();
    const otherProductId = await seedProduct();
    await seedRun(productId, 'succeeded', { inputTokens: 1000, outputTokens: 200 });
    await seedRun(productId, 'failed', { inputTokens: 300, outputTokens: 50 });
    await seedRun(otherProductId, 'succeeded', { inputTokens: 7000, outputTokens: 900 });

    assert.deepEqual(await runs.sumTokens(productId), { inputTokens: 1300, outputTokens: 250 });
  });

  it('reports zero tokens for a card that has never been prepared (Checklist 1)', async () => {
    const productId = await seedProduct();

    assert.deepEqual(await runs.sumTokens(productId), { inputTokens: 0, outputTokens: 0 });
  });

  it('inserts a queued run for an input it has not seen and reports it as created (Checklist 6)', async () => {
    const productId = await seedProduct();

    const claim = await runs.createRunOnce({
      productId,
      scope: 'texts',
      idempotencyKey: 'card:texts:v1',
      model: MODEL,
    });

    assert.equal(claim.created, true);
    const stored = await loadRun(claim.run.id);
    assert.equal(stored.productId, productId);
    assert.equal(stored.scope, 'texts');
    assert.equal(stored.status, 'queued');
  });

  it('returns the existing run for a repeated idempotency key without a second row (DoD idempotency)', async () => {
    const productId = await seedProduct();
    const draft = {
      productId,
      scope: 'texts' as const,
      idempotencyKey: 'card:texts:v1',
      model: MODEL,
    };

    const first = await runs.createRunOnce(draft);
    const second = await runs.createRunOnce(draft);

    assert.equal(second.created, false);
    assert.equal(second.run.id, first.run.id);
    assert.equal(await dataSource.getRepository(PreparationRun).countBy({ productId }), 1);
  });

  it('leaves one row when the same input is started twice at once (DoD idempotency)', async () => {
    const productId = await seedProduct();
    const draft = {
      productId,
      scope: 'price' as const,
      idempotencyKey: 'card:price:v1',
      model: MODEL,
    };

    const claims = await Promise.all([runs.createRunOnce(draft), runs.createRunOnce(draft)]);

    assert.deepEqual(claims.map(({ created }) => created).sort(), [false, true]);
    assert.equal(claims[0].run.id, claims[1].run.id);
    assert.equal(await dataSource.getRepository(PreparationRun).countBy({ productId }), 1);
  });

  it('counts the runs of a card created inside the window, whatever their scope or status (Checklist 5)', async () => {
    const productId = await seedProduct();
    const otherProductId = await seedProduct();
    await seedRun(productId, 'queued');
    await seedRun(productId, 'succeeded');
    await seedRun(productId, 'failed');
    const oldRunId = await seedRun(productId, 'succeeded');
    await seedRun(otherProductId, 'queued');
    await dataSource.query(
      `update product_preparation_runs set created_at = now() - interval '2 hours' where id = $1`,
      [oldRunId],
    );

    assert.equal(await runs.countRecentRuns(productId, 60 * 60), 3);
  });

  it('finds a run by its idempotency key, and nothing for a key never used', async () => {
    const productId = await seedProduct();
    const draft = {
      productId,
      scope: 'price' as const,
      idempotencyKey: 'card:price:v2',
      model: MODEL,
    };
    const { run } = await runs.createRunOnce(draft);

    assert.equal((await runs.findRunByKey('card:price:v2'))?.id, run.id);
    assert.equal(await runs.findRunByKey('card:price:never'), null);
  });

  it('finds a run of the card by its id (Checklist 3)', async () => {
    const productId = await seedProduct();
    const runId = await seedRun(productId, 'queued');

    const found = await runs.findRun(productId, runId);

    assert.equal(found?.id, runId);
    assert.equal(found.status, 'queued');
  });

  it('does not find a run through another card (Checklist 3)', async () => {
    const runId = await seedRun(await seedProduct(), 'queued');
    const otherProductId = await seedProduct();

    assert.equal(await runs.findRun(otherProductId, runId), null);
  });

  it('lists every suggestion of the card, oldest first, across its runs (Checklist 2)', async () => {
    const productId = await seedProduct();
    const otherProductId = await seedProduct();
    await runs.finishRun(await seedRun(productId), {
      status: 'succeeded',
      suggestions: [{ field: 'title_prom', value: 'Назва для Prom' }],
    });
    await runs.finishRun(await seedRun(productId), {
      status: 'succeeded',
      suggestions: [{ field: 'title_olx', value: 'Назва для OLX' }],
    });
    await runs.finishRun(await seedRun(otherProductId), {
      status: 'succeeded',
      suggestions: [{ field: 'title_prom', value: 'Назва чужої картки' }],
    });

    const found = await runs.findSuggestions(productId);

    assert.deepEqual(
      found.map(({ field }) => field),
      ['title_prom', 'title_olx'],
    );
    assert.deepEqual(
      found.map(({ resolution }) => resolution),
      [null, null],
    );
  });

  it('does not find a suggestion through another card (Checklist 3)', async () => {
    const productId = await seedProduct();
    const runId = await seedRun(productId);
    await runs.finishRun(runId, {
      status: 'succeeded',
      suggestions: [{ field: 'seo_keywords', value: ['миша', 'logitech'] }],
    });
    const [suggestion] = await suggestionsOf(runId);
    assert.ok(suggestion);
    const otherProductId = await seedProduct();

    assert.equal((await runs.findSuggestion(productId, suggestion.id))?.id, suggestion.id);
    assert.equal(await runs.findSuggestion(otherProductId, suggestion.id), null);
  });

  it('records a decision once and refuses a second one (Checklist 6)', async () => {
    const runId = await seedRun(await seedProduct());
    await runs.finishRun(runId, {
      status: 'succeeded',
      suggestions: [{ field: 'title_olx', value: 'Назва від моделі' }],
    });
    const [suggestion] = await suggestionsOf(runId);
    assert.ok(suggestion);

    assert.equal(await runs.resolveSuggestion(suggestion.id, 'accepted'), true);
    assert.equal(await runs.resolveSuggestion(suggestion.id, 'rejected'), false);

    const stored = await dataSource.getRepository(FieldSuggestion).findOneBy({ id: suggestion.id });
    assert.equal(stored?.resolution, 'accepted');
    assert.ok(stored.resolvedAt instanceof Date);
  });
});
