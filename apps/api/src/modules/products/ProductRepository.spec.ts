import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from '../../../db/test-database.ts';
import { createDataSource } from '../../db.ts';
import { PRODUCTS_TABLE, Product } from './Product.ts';
import { PRODUCT_IMAGES_TABLE, ProductImage } from './ProductImage.ts';
import {
  ProductRepository,
  type ProductChanges,
  type ProductListCriteria,
} from './ProductRepository.ts';

/**
 * The repository against a real Postgres. Everything checked here is exactly what a stub
 * cannot answer, because the answer belongs to SQL and not to the code around it: LIKE
 * escaping, `ilike`, what decimal(12,2) gives back, the stability of LIMIT/OFFSET on a
 * tied sort column, and the second query that fetches the galleries.
 */
type ProductSeed = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'images'>>;
type ImageSeed = Partial<Omit<ProductImage, 'id' | 'productId'>>;

const BASE_CRITERIA: ProductListCriteria = {
  page: 1,
  pageSize: 20,
  sort: 'titleProm',
  direction: 'asc',
  filters: {},
};

const dataSource = createDataSource({
  url: testDatabaseUrl(),
  entities: [Product, ProductImage],
});

/**
 * One change per entry, and together they cover every field `update` accepts. Each value
 * differs from what `seedProduct` writes, so a field that was not asked about announces
 * itself by keeping the seeded value.
 */
const SINGLE_FIELD_UPDATES: readonly {
  readonly field: keyof Required<ProductChanges>;
  readonly changes: ProductChanges;
}[] = [
  { field: 'titleProm', changes: { titleProm: 'Оновлена назва для Prom' } },
  { field: 'descriptionProm', changes: { descriptionProm: 'Оновлений опис для Prom' } },
  { field: 'titleOlx', changes: { titleOlx: 'Оновлена назва для OLX' } },
  { field: 'descriptionOlx', changes: { descriptionOlx: 'Оновлений опис для OLX' } },
  { field: 'price', changes: { price: '3199.00' } },
  { field: 'seoKeywords', changes: { seoKeywords: ['клавіатура', 'keychron'] } },
  { field: 'category', changes: { category: 'Аудіотехніка' } },
  { field: 'publishedProm', changes: { publishedProm: false } },
  { field: 'publishedOlx', changes: { publishedOlx: false } },
  { field: 'condition', changes: { condition: 'new' } },
];

let products: ProductRepository;

async function seedProduct(seed: ProductSeed = {}): Promise<string> {
  const row: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'images'> = {
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова миша у відмінному стані.',
    titleOlx: 'Logitech MX Master 3 бездротова миша',
    descriptionOlx: 'Продам мишу Logitech, повний комплект.',
    price: '2499.00',
    seoKeywords: ['миша', 'logitech'],
    category: 'Комп’ютерна периферія',
    publishedProm: true,
    publishedOlx: true,
    condition: 'used',
    ...seed,
  };

  const saved = await dataSource.getRepository(Product).save(row);
  return saved.id;
}

async function seedImage(productId: string, seed: ImageSeed = {}): Promise<void> {
  const row: Omit<ProductImage, 'id'> = {
    productId,
    r2Key: `products/${productId}/original.jpg`,
    url: `https://r2.example.com/products/${productId}/original.jpg`,
    position: 0,
    isMain: false,
    ...seed,
  };

  await dataSource.getRepository(ProductImage).save(row);
}

describe('product repository (postgres)', () => {
  before(async () => {
    await prepareTestDatabase();
    await dataSource.initialize();
    products = new ProductRepository(dataSource);
  });

  after(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetTables(dataSource, [PRODUCT_IMAGES_TABLE, PRODUCTS_TABLE]);
  });

  it('treats an underscore in a filter as a character, not as a wildcard', async () => {
    await seedProduct({ titleProm: 'MX_Master', titleOlx: 'MX_Master' });
    await seedProduct({ titleProm: 'MX-Master', titleOlx: 'MX-Master' });

    const page = await products.list({ ...BASE_CRITERIA, filters: { title: 'MX_Master' } });

    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.titleProm, 'MX_Master');
  });

  it('treats a percent sign in a filter as a character, not as a wildcard', async () => {
    await seedProduct({ titleProm: 'Знижка 50% на мишу', titleOlx: 'Знижка 50% на мишу' });
    await seedProduct({ titleProm: 'Знижка 5000 гривень', titleOlx: 'Знижка 5000 гривень' });

    const page = await products.list({ ...BASE_CRITERIA, filters: { title: '50%' } });

    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.titleProm, 'Знижка 50% на мишу');
  });

  it('matches a title case-insensitively across both marketplaces at once', async () => {
    await seedProduct({ titleProm: 'Клавіатура Keychron K2', titleOlx: 'Keychron K2' });
    await seedProduct({ titleProm: 'Монітор Dell U2723', titleOlx: 'КЛАВІАТУРА механічна' });
    await seedProduct({ titleProm: 'Миша Logitech', titleOlx: 'Logitech MX' });

    const page = await products.list({ ...BASE_CRITERIA, filters: { title: 'клавіатура' } });

    assert.equal(page.total, 2);
  });

  it('compares a price as a number and not as a string', async () => {
    // Lexicographically "999.00" is greater than "1000.00": the bound is a string on the
    // way in, so this is the test that it stops being one the moment SQL sees it.
    await seedProduct({ titleProm: 'Дешевша', price: '999.00' });
    await seedProduct({ titleProm: 'Дорожча', price: '1000.00' });

    const page = await products.list({ ...BASE_CRITERIA, filters: { priceMin: '1000.00' } });

    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.price, '1000.00');
  });

  it('reads a price back from decimal(12,2) as the very string that was written', async () => {
    await seedProduct({ price: '2499.00' });

    const page = await products.list(BASE_CRITERIA);

    // Character for character: no transformer stands between the column and the caller,
    // so nothing rounds the value a second time.
    assert.equal(page.items[0]?.price, '2499.00');
  });

  it('lets the column itself pad a price to its scale', async () => {
    await seedProduct({ price: '2499.5' });

    const page = await products.list(BASE_CRITERIA);

    // The only normalisation a price goes through belongs to decimal(12,2), and it is
    // visible in the result rather than hidden inside a converter.
    assert.equal(page.items[0]?.price, '2499.50');
  });

  it('does not repeat a card across pages when the sort column ties', async () => {
    const first = await seedProduct({ titleProm: 'Однакова назва', price: '100.00' });
    const second = await seedProduct({ titleProm: 'Однакова назва', price: '200.00' });

    const pageOne = await products.list({ ...BASE_CRITERIA, page: 1, pageSize: 1 });
    const pageTwo = await products.list({ ...BASE_CRITERIA, page: 2, pageSize: 1 });

    assert.equal(pageOne.items.length, 1);
    assert.equal(pageTwo.items.length, 1);
    assert.deepEqual(
      [pageOne.items[0]?.id, pageTwo.items[0]?.id].sort(),
      [first, second].sort(),
      'the two pages must together cover both cards, each exactly once',
    );
  });

  it('attaches the gallery of every card in position order', async () => {
    const withGallery = await seedProduct({ titleProm: 'З галереєю' });
    const withoutGallery = await seedProduct({ titleProm: 'Без галереї' });
    await seedImage(withGallery, { position: 1, r2Key: 'products/second.jpg', isMain: false });
    await seedImage(withGallery, { position: 0, r2Key: 'products/first.jpg', isMain: true });

    const page = await products.list(BASE_CRITERIA);
    const byId = new Map(page.items.map((product) => [product.id, product]));

    assert.deepEqual(
      byId.get(withGallery)?.images.map((image) => image.r2Key),
      ['products/first.jpg', 'products/second.jpg'],
    );
    assert.deepEqual(byId.get(withoutGallery)?.images, []);
  });

  it('counts the rows behind the filter, not the size of the page', async () => {
    for (const index of [0, 1, 2, 3, 4]) {
      await seedProduct({ titleProm: `Товар ${String(index)}`, publishedProm: index < 3 });
    }

    const page = await products.list({
      ...BASE_CRITERIA,
      pageSize: 2,
      filters: { publishedProm: true },
    });

    assert.equal(page.total, 3);
    assert.equal(page.items.length, 2);
  });

  it('answers about one marketplace without answering about the other', async () => {
    // The card the two columns exist for: it is up on Prom and not on OLX, and a single
    // shared flag could not be true and false about it at the same time.
    await seedProduct({ titleProm: 'Лише на Prom', publishedProm: true, publishedOlx: false });
    await seedProduct({ titleProm: 'На обох', publishedProm: true, publishedOlx: true });

    const onProm = await products.list({ ...BASE_CRITERIA, filters: { publishedProm: true } });
    const notOnOlx = await products.list({ ...BASE_CRITERIA, filters: { publishedOlx: false } });

    assert.equal(onProm.total, 2);
    assert.equal(notOnOlx.total, 1);
    assert.equal(notOnOlx.items[0]?.titleProm, 'Лише на Prom');
  });
  it('creates an empty card the database fills with its own defaults', async () => {
    const created = await products.create({ category: 'Побутова техніка', condition: 'used' });

    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.equal(created.category, 'Побутова техніка');
    assert.equal(created.condition, 'used');
    // Nothing but the category and the condition was said, and the row is still complete:
    // every remaining column carries the default the migration gave it.
    assert.equal(created.titleProm, '');
    assert.equal(created.titleOlx, '');
    assert.equal(created.descriptionProm, '');
    assert.equal(created.descriptionOlx, '');
    assert.equal(created.price, '0.00');
    assert.deepEqual(created.seoKeywords, []);
    assert.equal(created.publishedProm, false);
    assert.equal(created.publishedOlx, false);
    assert.deepEqual(created.images, []);
  });

  it('gives a new card an id that is readable before anything else is written', async () => {
    // The id is what an R2 key is built from — `products/{id}/{frame}` — so it has to be
    // usable straight from `create`, not after a first save of the texts.
    const created = await products.create({ category: 'Побутова техніка', condition: 'new' });

    const found = await products.findById(created.id);
    assert.ok(found !== null);

    assert.equal(found.id, created.id);
    assert.equal(found.condition, 'new');
  });

  it('reads one card with its gallery in position order', async () => {
    const id = await seedProduct();
    await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg`, isMain: false });
    await seedImage(id, { position: 0, r2Key: `products/${id}/first.jpg`, isMain: true });

    const found = await products.findById(id);

    assert.deepEqual(
      found?.images.map((image) => image.r2Key),
      [`products/${id}/first.jpg`, `products/${id}/second.jpg`],
    );
  });

  it('answers with null about a card that does not exist', async () => {
    assert.equal(await products.findById(randomUUID()), null);
  });

  for (const { field, changes } of SINGLE_FIELD_UPDATES) {
    it(`updates ${field} and leaves every other field as it was`, async () => {
      const id = await seedProduct();
      const before = await products.findById(id);
      assert.ok(before !== null);

      const after = await products.update(id, changes);
      assert.ok(after !== null);

      assert.deepEqual(after[field], changes[field]);
      for (const other of SINGLE_FIELD_UPDATES) {
        if (other.field !== field) {
          assert.deepEqual(after[other.field], before[other.field], `${other.field} was rewritten`);
        }
      }
    });
  }

  it('reads an updated price back as the column wrote it, not as it was given', async () => {
    const id = await seedProduct();

    const updated = await products.update(id, { price: '1799.5' });

    // decimal(12,2) is the only thing that normalises money here, and its work is visible
    // in the answer rather than hidden in a converter on the way out.
    assert.equal(updated?.price, '1799.50');
  });

  it('accepts an empty set of changes and reads the card back untouched', async () => {
    const id = await seedProduct();

    const updated = await products.update(id, {});
    assert.ok(updated !== null);

    assert.equal(updated.titleProm, 'Миша Logitech MX Master 3');
    assert.equal(updated.price, '2499.00');
  });

  it('answers with null when the card to update does not exist', async () => {
    assert.equal(await products.update(randomUUID(), { titleProm: 'Байдуже' }), null);
  });

  it('deletes a card together with its frames', async () => {
    const id = await seedProduct();
    await seedImage(id, { position: 0, isMain: true });
    await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });

    const deleted = await products.delete(id);

    assert.equal(deleted, true);
    assert.equal(await products.findById(id), null);
    // Asked of the database rather than of the repository: the cascade belongs to the FK,
    // and nothing in the code removes these rows.
    const remainingImages = await dataSource.getRepository(ProductImage).countBy({ productId: id });
    assert.equal(remainingImages, 0);
  });

  it('reports that there was nothing to delete', async () => {
    assert.equal(await products.delete(randomUUID()), false);
  });
});
