import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProductListQuery } from '../../contracts/products.contract.ts';
import { createListProducts } from './list-products.use-case.ts';
import { createInMemoryProductRepository, makeProduct } from './products.fixtures.ts';
import type { Product } from './product.ts';

const BASE_QUERY: ProductListQuery = {
  page: 1,
  pageSize: 20,
  sort: 'titleProm',
  direction: 'asc',
};

function setup(products: readonly Product[]) {
  const repository = createInMemoryProductRepository(products);
  return { listProducts: createListProducts({ products: repository }), repository };
}

describe('list products use-case', () => {
  it('passes pagination and ordering through to the repository', async () => {
    const { listProducts, repository } = setup([]);

    const page = await listProducts({
      ...BASE_QUERY,
      page: 3,
      pageSize: 10,
      sort: 'price',
      direction: 'desc',
    });

    const criteria = repository.lastCriteria();
    assert.ok(criteria !== null);
    assert.equal(criteria.page, 3);
    assert.equal(criteria.pageSize, 10);
    assert.equal(criteria.sort, 'price');
    assert.equal(criteria.direction, 'desc');
    assert.equal(page.page, 3);
    assert.equal(page.pageSize, 10);
  });

  it('carries every filter over into the criteria', async () => {
    const { listProducts, repository } = setup([]);

    await listProducts({
      ...BASE_QUERY,
      title: 'миша',
      description: 'комплект',
      priceMinCents: 100_000,
      priceMaxCents: 500_000,
      category: 'Комп’ютерна периферія',
      published: true,
      accountProm: 'prom-main',
      accountOlx: 'olx-main',
    });

    assert.deepEqual(repository.lastCriteria()?.filters, {
      title: 'миша',
      description: 'комплект',
      priceMinCents: 100_000,
      priceMaxCents: 500_000,
      category: 'Комп’ютерна периферія',
      published: true,
      accountProm: 'prom-main',
      accountOlx: 'olx-main',
    });
  });

  it('does not turn an unsent filter into a condition', async () => {
    const { listProducts, repository } = setup([]);

    await listProducts(BASE_QUERY);

    assert.deepEqual(repository.lastCriteria()?.filters, {});
  });

  it('tells published=false apart from "published not asked about"', async () => {
    const { listProducts } = setup([
      makeProduct({ id: '11111111-1111-4111-8111-111111111111', published: true }),
      makeProduct({ id: '33333333-3333-4333-8333-333333333333', published: false }),
    ]);

    const drafts = await listProducts({ ...BASE_QUERY, published: false });
    const everything = await listProducts(BASE_QUERY);

    assert.equal(drafts.total, 1);
    assert.equal(drafts.items[0]?.published, false);
    assert.equal(everything.total, 2);
  });

  it('searches a title across both marketplaces at once', async () => {
    const { listProducts } = setup([
      makeProduct({ id: '11111111-1111-4111-8111-111111111111', titleProm: 'Клавіатура Keychron' }),
      makeProduct({
        id: '33333333-3333-4333-8333-333333333333',
        titleProm: 'Монітор Dell',
        titleOlx: 'Клавіатура механічна',
      }),
    ]);

    const found = await listProducts({ ...BASE_QUERY, title: 'клавіатура' });

    assert.equal(found.total, 2);
  });

  it('returns the requested page and the total behind it', async () => {
    const products = Array.from({ length: 5 }, (_, index) =>
      makeProduct({
        id: `4444444${String(index)}-4444-4444-8444-444444444444`,
        titleProm: `Товар ${String(index)}`,
        priceCents: (index + 1) * 10_000,
      }),
    );
    const { listProducts } = setup(products);

    const page = await listProducts({ ...BASE_QUERY, page: 2, pageSize: 2, sort: 'price' });

    assert.equal(page.total, 5);
    assert.equal(page.items.length, 2);
    assert.deepEqual(
      page.items.map((product) => product.priceCents),
      [30_000, 40_000],
    );
  });

  it('gives an empty page rather than an error beyond the last one', async () => {
    const { listProducts } = setup([makeProduct()]);

    const page = await listProducts({ ...BASE_QUERY, page: 9 });

    assert.deepEqual(page.items, []);
    assert.equal(page.total, 1);
  });
});
