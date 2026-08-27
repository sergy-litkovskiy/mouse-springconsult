import type { ProductListQuery } from '../../contracts/products.contract.ts';
import type { ProductPage } from './product.ts';
import type { ProductFilters, ProductListCriteria, ProductRepository } from './products.port.ts';

/**
 * Reading the catalogue. Depends on the port only — Postgres is supplied by the
 * composition root, and the test supplies an in-memory double.
 *
 * The work here is the translation of a validated request into domain criteria: the flat
 * query is split into pagination, ordering and filters, and a filter that was not sent
 * does not become a condition. Silence in a request is not the same as an empty string.
 */
export type ListProductsDependencies = {
  readonly products: ProductRepository;
};

export type ListProducts = (query: ProductListQuery) => Promise<ProductPage>;

function toFilters(query: ProductListQuery): ProductFilters {
  const filters: {
    -readonly [Key in keyof ProductFilters]: ProductFilters[Key];
  } = {};

  if (query.title !== undefined) {
    filters.title = query.title;
  }
  if (query.description !== undefined) {
    filters.description = query.description;
  }
  if (query.priceMinCents !== undefined) {
    filters.priceMinCents = query.priceMinCents;
  }
  if (query.priceMaxCents !== undefined) {
    filters.priceMaxCents = query.priceMaxCents;
  }
  if (query.category !== undefined) {
    filters.category = query.category;
  }
  if (query.published !== undefined) {
    filters.published = query.published;
  }
  if (query.accountProm !== undefined) {
    filters.accountProm = query.accountProm;
  }
  if (query.accountOlx !== undefined) {
    filters.accountOlx = query.accountOlx;
  }

  return filters;
}

export function createListProducts(dependencies: ListProductsDependencies): ListProducts {
  const { products } = dependencies;

  return async function listProducts(query: ProductListQuery): Promise<ProductPage> {
    const criteria: ProductListCriteria = {
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      direction: query.direction,
      filters: toFilters(query),
    };

    return products.list(criteria);
  };
}
