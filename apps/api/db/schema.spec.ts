import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createDataSource } from '../src/db.ts';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from './test-database.ts';

/**
 * Constraints that exist in SQL and nowhere else.
 *
 * The `migrations` job in CI runs up → down → up, which proves a migration applies and
 * reverts. What it cannot prove is that the constraints behave the way the comments in
 * the migration claim — that the deferred unique lets a reorder through, that the partial
 * unique allows exactly one main frame, that the CHECK really closes the list of
 * conditions. Those are checked here, with raw SQL: the ORM has no say in any of it.
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
    `insert into "product_images" ("product_id", "r2_key", "url", "position", "is_main")
     values ($1, $2, $3, $4, $5)`,
    [productId, r2Key, `https://r2.example.com/${r2Key}`, position, isMain],
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
    await resetTables(dataSource, ['product_images', 'products']);
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
});
