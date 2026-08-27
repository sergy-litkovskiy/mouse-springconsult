import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from '../../../db/test-database.ts';
import { createDataSource } from '../../db.ts';
import { PRODUCTS_TABLE, Product } from './Product.ts';
import { PRODUCT_IMAGES_TABLE, ProductImage } from './ProductImage.ts';
import { ProductRepository, type ProductListCriteria } from './ProductRepository.ts';

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
    published: true,
    accountProm: 'prom-main',
    accountOlx: 'olx-main',
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
      await seedProduct({ titleProm: `Товар ${String(index)}`, published: index < 3 });
    }

    const page = await products.list({
      ...BASE_CRITERIA,
      pageSize: 2,
      filters: { published: true },
    });

    assert.equal(page.total, 3);
    assert.equal(page.items.length, 2);
  });
});
