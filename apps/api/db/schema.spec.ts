import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createDataSource } from '../src/db.ts';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from './test-database.ts';

/**
 * The `migrations` job in CI runs up → down → up, which proves a migration applies and reverts.
 * What it cannot prove is that the constraints behave as claimed — that the deferred unique lets
 * a reorder through, that the partial unique allows exactly one main frame, that the CHECK really
 * closes the list of conditions. Those are checked here in raw SQL, with no ORM in the way.
 */
const dataSource = createDataSource({ url: testDatabaseUrl() });

async function insertProduct(condition = 'used'): Promise<string> {
  const rows = await dataSource.query<{ id: string }[]>(
    `insert into "products" ("title_prom", "title_olx", "category", "condition", "price")
     values ('Миша', 'Миша', 'Периферія', $1, 2499.00)
     returning "id"`,
    [condition],
  );

  const id = rows[0]?.id;
  assert.ok(id !== undefined, 'insert into products returned no row');
  return id;
}

async function insertImage(
  productId: string,
  r2Key: string,
  position: number,
  isMain = false,
): Promise<void> {
  await dataSource.query(
    `insert into "product_images" ("product_id", "r2_key", "position", "is_main")
     values ($1, $2, $3, $4)`,
    [productId, r2Key, position, isMain],
  );
}

async function insertRun(
  productId: string,
  idempotencyKey: string,
  scope = 'both',
  status = 'queued',
): Promise<string> {
  const rows = await dataSource.query<{ id: string }[]>(
    `insert into "product_preparation_runs" ("product_id", "scope", "idempotency_key", "status", "model")
     values ($1, $2, $3, $4, 'claude-sonnet-5')
     returning "id"`,
    [productId, scope, idempotencyKey, status],
  );

  const id = rows[0]?.id;
  assert.ok(id !== undefined, 'insert into product_preparation_runs returned no row');
  return id;
}

async function insertSuggestion(
  productId: string,
  runId: string,
  field: string,
  value: unknown,
): Promise<void> {
  await dataSource.query(
    `insert into "product_field_suggestions" ("product_id", "run_id", "field", "value")
     values ($1, $2, $3, $4::jsonb)`,
    [productId, runId, field, JSON.stringify(value)],
  );
}

describe('database schema constraints', () => {
  before(async () => {
    await prepareTestDatabase();
    await dataSource.initialize();
  });

  after(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetTables(dataSource, [
      'product_field_suggestions',
      'product_preparation_runs',
      'product_images',
      'products',
    ]);
  });

  it('lets two frames swap positions inside one transaction', async () => {
    const productId = await insertProduct();
    await insertImage(productId, 'first.jpg', 0);
    await insertImage(productId, 'second.jpg', 1);

    // Halfway through the swap both rows hold position 1. An immediate unique constraint
    // would reject the first UPDATE; `deferrable initially deferred` checks at COMMIT.
    await assert.doesNotReject(
      dataSource.transaction(async (manager) => {
        await manager.query(`update "product_images" set "position" = 1 where "r2_key" = $1`, [
          'first.jpg',
        ]);
        await manager.query(`update "product_images" set "position" = 0 where "r2_key" = $1`, [
          'second.jpg',
        ]);
      }),
    );

    const rows = await dataSource.query<{ r2_key: string; position: number }[]>(
      `select "r2_key", "position" from "product_images" order by "position"`,
    );
    assert.deepEqual(
      rows.map((row) => row.r2_key),
      ['second.jpg', 'first.jpg'],
    );
  });

  it('still rejects two frames left on the same position', async () => {
    const productId = await insertProduct();
    await insertImage(productId, 'first.jpg', 0);

    await assert.rejects(insertImage(productId, 'second.jpg', 0), /product_images_position_key/);
  });

  it('allows exactly one main frame per card', async () => {
    const productId = await insertProduct();
    await insertImage(productId, 'first.jpg', 0, true);

    await assert.rejects(
      insertImage(productId, 'second.jpg', 1, true),
      /product_images_main_key/,
      'the partial unique index must not let a card have two main frames',
    );
  });

  it('counts the main frames per card and not across the table', async () => {
    const one = await insertProduct();
    const another = await insertProduct();
    await insertImage(one, 'one-main.jpg', 0, true);

    await assert.doesNotReject(insertImage(another, 'another-main.jpg', 0, true));
  });

  it('rejects a condition outside new/used', async () => {
    await assert.rejects(insertProduct('broken'), /products_condition_check/);
  });

  it('rejects a negative price', async () => {
    await assert.rejects(
      dataSource.query(
        `insert into "products" ("title_prom", "title_olx", "category", "price")
         values ('Миша', 'Миша', 'Периферія', -1.00)`,
      ),
      /products_price_non_negative_check/,
    );
  });

  it('lets one Prom id belong to a single card, while any number of cards have none', async () => {
    const first = await insertProduct();
    const second = await insertProduct();
    await insertProduct();
    await dataSource.query(`update "products" set "prom_id" = '1519870367' where "id" = $1`, [
      first,
    ]);

    await assert.rejects(
      dataSource.query(`update "products" set "prom_id" = '1519870367' where "id" = $1`, [second]),
      /products_prom_id_key/,
    );
  });

  it('finds the run still going instead of letting the same input start a second one', async () => {
    const productId = await insertProduct();
    await insertRun(productId, 'card:both:frames-hash');

    await assert.rejects(
      insertRun(productId, 'card:both:frames-hash'),
      /product_preparation_runs_idempotency_key_key/,
    );
  });

  it('lets the same input succeed twice, since a finished run guards nothing', async () => {
    const productId = await insertProduct();
    await insertRun(productId, 'card:both:frames-hash', 'both', 'succeeded');

    await assert.doesNotReject(insertRun(productId, 'card:both:frames-hash', 'both', 'succeeded'));
  });

  it('rejects a scope and a status outside the listed ones', async () => {
    const productId = await insertProduct();

    await assert.rejects(insertRun(productId, 'k1', 'all'), /product_preparation_runs_scope_check/);
    await assert.rejects(
      dataSource.query(
        `insert into "product_preparation_runs" ("product_id", "scope", "idempotency_key", "status", "model")
         values ($1, 'texts', 'k2', 'dlq', 'claude-sonnet-5')`,
        [productId],
      ),
      /product_preparation_runs_status_check/,
    );
  });

  it('keeps at most one suggestion per field of a card, across its runs', async () => {
    const productId = await insertProduct();
    await insertSuggestion(productId, await insertRun(productId, 'k1'), 'description_olx', 'Опис');

    await assert.rejects(
      insertSuggestion(
        productId,
        await insertRun(productId, 'k2'),
        'description_olx',
        'Інший опис',
      ),
      /product_field_suggestions_product_field_key/,
    );
  });

  it('rejects a suggestion field outside the listed ones', async () => {
    const productId = await insertProduct();
    const runId = await insertRun(productId, 'k');

    await assert.doesNotReject(
      insertSuggestion(productId, runId, 'price', { priceFrom: '100.00', priceTo: '200.00' }),
    );
    await assert.rejects(
      insertSuggestion(productId, runId, 'category', 'Периферія'),
      /product_field_suggestions_field_check/,
    );
  });

  it('removes the runs and their suggestions together with the card', async () => {
    const productId = await insertProduct();
    await insertSuggestion(productId, await insertRun(productId, 'k'), 'title_prom', 'Миша');

    await dataSource.query(`delete from "products" where "id" = $1`, [productId]);

    const [counts] = await dataSource.query<{ runs: number; suggestions: number }[]>(
      `select (select count(*)::int from "product_preparation_runs") as "runs",
              (select count(*)::int from "product_field_suggestions") as "suggestions"`,
    );
    assert.deepEqual(counts, { runs: 0, suggestions: 0 });
  });
});
