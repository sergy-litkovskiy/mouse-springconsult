import assert from 'node:assert/strict';
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
 * Against a real Postgres, because everything checked here is what a stub cannot answer: LIKE
 * escaping, `ilike`, what decimal(12,2) gives back, the stability of LIMIT/OFFSET on a tied sort
 * column, and the second query that fetches the galleries.
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

/**
 * Every writable column with a value different from the one `seedProduct` puts there: an UPDATE
 * that quietly resets a neighbour is exactly the defect a one-field test cannot see.
 */
const REPLACEMENTS: Required<ProductChanges> = {
  titleProm: 'Миша Logitech MX Master 3S',
  descriptionProm: 'Оновлений опис для Prom.',
  titleOlx: 'Logitech MX Master 3S',
  descriptionOlx: 'Оновлений опис для OLX.',
  price: '2799.00',
  seoKeywords: ['миша', 'logitech', 'mx master'],
  category: 'Аксесуари',
  publishedProm: false,
  publishedOlx: false,
  condition: 'new',
};

function writableOf(product: Product): Required<ProductChanges> {
  return {
    titleProm: product.titleProm,
    descriptionProm: product.descriptionProm,
    titleOlx: product.titleOlx,
    descriptionOlx: product.descriptionOlx,
    price: product.price,
    seoKeywords: product.seoKeywords,
    category: product.category,
    publishedProm: product.publishedProm,
    publishedOlx: product.publishedOlx,
    condition: product.condition,
  };
}

const dataSource = createDataSource({
  url: testDatabaseUrl(),
  entities: [Product, ProductImage],
});

let products: ProductRepository;

/** A well-formed uuid that belongs to no row: the argument a lookup is supposed to miss. */
const MISSING_ID = '01931f2a-0000-7000-8000-000000000000';

function must<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`${what} was expected to exist`);
  }
  return value;
}

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

async function seedImage(productId: string, seed: ImageSeed = {}): Promise<string> {
  const row: Omit<ProductImage, 'id'> = {
    productId,
    r2Key: `products/${productId}/original.jpg`,
    url: `https://r2.example.com/products/${productId}/original.jpg`,
    position: 0,
    isMain: false,
    ...seed,
  };

  const saved = await dataSource.getRepository(ProductImage).save(row);
  return saved.id;
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

    assert.equal(page.items[0]?.price, '2499.00');
  });

  it('lets the column itself pad a price to its scale', async () => {
    await seedProduct({ price: '2499.5' });

    const page = await products.list(BASE_CRITERIA);

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

  it('creates a card the database can identify before it has texts, price or frames', async () => {
    // The three columns without a default are the whole of what a caller must supply:
    // an R2 key is products/{id}/…, so the id has to exist before a frame does.
    const created = await products.create({
      titleProm: 'Порожня картка',
      titleOlx: 'Порожня картка',
      category: 'Комп’ютерна периферія',
    });

    assert.match(created.id, /^[0-9a-f-]{36}$/u);
    assert.deepEqual(writableOf(created), {
      titleProm: 'Порожня картка',
      titleOlx: 'Порожня картка',
      category: 'Комп’ютерна периферія',
      descriptionProm: '',
      descriptionOlx: '',
      price: '0.00',
      seoKeywords: [],
      publishedProm: false,
      publishedOlx: false,
      condition: 'used',
    });
    assert.deepEqual(created.images, []);
  });

  it('returns a created price as the column stores it, not as it was passed', async () => {
    const created = await products.create({
      titleProm: 'З ціною',
      titleOlx: 'З ціною',
      category: 'Комп’ютерна периферія',
      price: '2499.5',
    });

    // Reading the row back is what shows the scale of decimal(12,2) doing the rounding;
    // returning the insert argument would have hidden it.
    assert.equal(created.price, '2499.50');
  });

  for (const [column, replacement] of Object.entries(REPLACEMENTS)) {
    it(`updates ${column} without touching any other column`, async () => {
      const id = await seedProduct();
      const before = must(await products.findById(id), 'the seeded card');

      const change: ProductChanges = {};
      Object.assign(change, { [column]: replacement });
      const updated = must(await products.update(id, change), 'the updated card');

      assert.deepEqual(writableOf(updated), { ...writableOf(before), ...change });
    });
  }

  it('leaves the card exactly as it was when the change set is empty', async () => {
    const id = await seedProduct();
    const before = must(await products.findById(id), 'the seeded card');

    const updated = must(await products.update(id, {}), 'the untouched card');

    assert.deepEqual(writableOf(updated), writableOf(before));
  });

  it('reports a missing card on update rather than creating one', async () => {
    const updated = await products.update(MISSING_ID, { titleProm: 'Немає такої' });

    assert.equal(updated, null);
  });

  it('takes the gallery rows down together with the card', async () => {
    const id = await seedProduct();
    await seedImage(id, { position: 0, isMain: true });
    await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });

    const deleted = await products.delete(id);

    // The cascade is the database's, declared on the foreign key: asking the table
    // directly is the only way to see that nothing had to delete these rows by hand.
    assert.equal(deleted, true);
    assert.equal(await dataSource.getRepository(ProductImage).countBy({ productId: id }), 0);
    assert.equal(await products.findById(id), null);
  });

  it('reports a missing card on delete instead of pretending it removed one', async () => {
    assert.equal(await products.delete(MISSING_ID), false);
  });

  it('finds one card with its gallery in position order', async () => {
    const id = await seedProduct({ titleProm: 'Шукана' });
    await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });
    await seedImage(id, { position: 0, r2Key: `products/${id}/first.jpg`, isMain: true });

    const found = must(await products.findById(id), 'the seeded card');

    assert.equal(found.titleProm, 'Шукана');
    assert.deepEqual(
      found.images.map((image) => image.r2Key),
      [`products/${id}/first.jpg`, `products/${id}/second.jpg`],
    );
  });

  it('returns null for a card that does not exist', async () => {
    assert.equal(await products.findById(MISSING_ID), null);
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

  it('adds a frame with the fields it was given, not main by default', async () => {
    const id = await seedProduct();

    const image = await products.addImage(
      id,
      `products/${id}/first.jpg`,
      'https://r2.example.com/first.jpg',
      0,
    );

    assert.equal(image.productId, id);
    assert.equal(image.r2Key, `products/${id}/first.jpg`);
    assert.equal(image.isMain, false);
  });

  it('counts only the frames of the card that was asked about', async () => {
    const counted = await seedProduct();
    const other = await seedProduct({ titleProm: 'Інша картка' });
    await seedImage(counted, { position: 0 });
    await seedImage(counted, { position: 1, r2Key: `products/${counted}/second.jpg` });
    await seedImage(other, { position: 0, r2Key: `products/${other}/first.jpg` });

    assert.equal(await products.countImages(counted), 2);
  });

  it('makes the assigned frame the only main one', async () => {
    const id = await seedProduct();
    const first = await seedImage(id, { position: 0, isMain: true });
    const second = await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });

    const changed = await products.setMainImage(id, second);

    assert.equal(changed, true);
    assert.equal((await products.findImage(id, second))?.isMain, true);
    assert.equal((await products.findImage(id, first))?.isMain, false);
  });

  it('leaves the main frame as it was when the target does not belong to the card', async () => {
    const id = await seedProduct();
    const other = await seedProduct({ titleProm: 'Інша картка' });
    const main = await seedImage(id, { position: 0, isMain: true });
    const foreignImage = await seedImage(other, {
      position: 0,
      r2Key: `products/${other}/first.jpg`,
    });

    const changed = await products.setMainImage(id, foreignImage);

    assert.equal(changed, false);
    assert.equal((await products.findImage(id, main))?.isMain, true);
  });

  it('rejects two main frames for the same card at the database itself', async () => {
    // `products.setMainImage` cannot produce this state — the point is to prove the invariant
    // is the index, not the calling code, per the story's DoD ("перевірено проти індексу").
    const id = await seedProduct();
    await seedImage(id, { position: 0, isMain: true });

    await assert.rejects(
      seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg`, isMain: true }),
    );
  });

  it('never lets another connection see the moment between clearing and setting the main frame', async () => {
    const id = await seedProduct();
    const original = await seedImage(id, { position: 0, isMain: true });
    const next = await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });

    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      // The same two statements setMainImage runs, but paused mid-way on a connection of
      // their own so a read from the pool's other connections can land between them.
      await runner.manager
        .getRepository(ProductImage)
        .update({ productId: id, isMain: true }, { isMain: false });

      const seenMidway = await dataSource
        .getRepository(ProductImage)
        .findOneBy({ productId: id, isMain: true });
      assert.equal(
        seenMidway?.id,
        original,
        'a concurrent read must still see the original main frame, never none at all',
      );

      await runner.manager
        .getRepository(ProductImage)
        .update({ id: next, productId: id }, { isMain: true });
      await runner.commitTransaction();
    } finally {
      await runner.release();
    }

    assert.equal((await products.findImage(id, next))?.isMain, true);
  });

  it('swaps two frames without tripping over the position they trade', async () => {
    const id = await seedProduct();
    const first = await seedImage(id, { position: 0, r2Key: `products/${id}/first.jpg` });
    const second = await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });

    await products.reorderImages(id, [second, first]);

    assert.equal((await products.findImage(id, second))?.position, 0);
    assert.equal((await products.findImage(id, first))?.position, 1);
  });

  it('finds a frame scoped to its own card, not by id alone', async () => {
    const id = await seedProduct();
    const other = await seedProduct({ titleProm: 'Інша картка' });
    const imageId = await seedImage(id, { position: 0 });

    assert.equal((await products.findImage(id, imageId))?.id, imageId);
    assert.equal(await products.findImage(other, imageId), null);
  });

  it('returns the r2 keys of a card gallery for the caller that has to remove the objects', async () => {
    const id = await seedProduct();
    await seedImage(id, { position: 0, r2Key: `products/${id}/first.jpg` });
    await seedImage(id, { position: 1, r2Key: `products/${id}/second.jpg` });

    const keys = await products.findImageKeys(id);

    assert.deepEqual(keys.sort(), [`products/${id}/first.jpg`, `products/${id}/second.jpg`].sort());
  });

  it('deletes a frame and reports it, unlike a missing one', async () => {
    const id = await seedProduct();
    const imageId = await seedImage(id, { position: 0 });

    assert.equal(await products.deleteImage(imageId), true);
    assert.equal(await products.findImage(id, imageId), null);
    assert.equal(await products.deleteImage(imageId), false);
  });
});
