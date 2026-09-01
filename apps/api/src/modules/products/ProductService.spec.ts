import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProductListQuery } from '../../contracts/products.contract.ts';
import type { ProductPage } from './Product.ts';
import { ProductRepository, type ProductListCriteria } from './ProductRepository.ts';
import { ProductService } from './ProductService.ts';

/**
 * What the service itself does is one translation: a validated flat query becomes
 * repository criteria. That is what is checked here, and nothing else — how a filter
 * behaves is SQL's answer, and it is checked against a real Postgres in
 * `ProductRepository.spec.ts`.
 */

/** The DataSource is never reached: `list` is overridden and nothing else is called. */
const NO_DATA_SOURCE = undefined as unknown as ConstructorParameters<typeof ProductRepository>[0];

class StubProductRepository extends ProductRepository {
  lastCriteria: ProductListCriteria | undefined;

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async list(criteria: ProductListCriteria): Promise<ProductPage> {
    this.lastCriteria = criteria;
    return { items: [], total: 0, page: criteria.page, pageSize: criteria.pageSize };
  }
}

const BASE_QUERY: ProductListQuery = {
  page: 1,
  pageSize: 20,
  sort: 'titleProm',
  direction: 'asc',
};

function setup(): { service: ProductService; repository: StubProductRepository } {
  const repository = new StubProductRepository();
  return { service: new ProductService(repository), repository };
}

describe('product service', () => {
  it('splits a query into pagination, ordering and filters', async () => {
    const { service, repository } = setup();

    await service.list({ ...BASE_QUERY, page: 3, pageSize: 5, sort: 'price', direction: 'desc' });

    assert.deepEqual(repository.lastCriteria, {
      page: 3,
      pageSize: 5,
      sort: 'price',
      direction: 'desc',
      filters: {},
    });
  });

  it('passes every filter of the query through to the repository', async () => {
    const { service, repository } = setup();

    await service.list({
      ...BASE_QUERY,
      title: 'миша',
      description: 'бездротова',
      priceMin: '100.00',
      priceMax: '5000.00',
      category: 'Периферія',
      publishedProm: true,
      publishedOlx: false,
    });

    assert.deepEqual(repository.lastCriteria?.filters, {
      title: 'миша',
      description: 'бездротова',
      priceMin: '100.00',
      priceMax: '5000.00',
      category: 'Периферія',
      publishedProm: true,
      publishedOlx: false,
    });
  });

  it('does not turn a filter that was not sent into a condition', async () => {
    const { service, repository } = setup();

    await service.list({ ...BASE_QUERY, title: 'миша' });

    // An absent filter must not arrive as `undefined` either: the repository asks
    // `!== undefined`, but `Object.keys` on the criteria is what a future writer reads.
    assert.deepEqual(Object.keys(repository.lastCriteria?.filters ?? {}), ['title']);
  });

  it('returns the page the repository produced', async () => {
    const { service } = setup();

    const page = await service.list({ ...BASE_QUERY, page: 2, pageSize: 5 });

    assert.deepEqual(page, { items: [], total: 0, page: 2, pageSize: 5 });
  });
});
