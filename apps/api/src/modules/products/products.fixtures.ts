import type { Product, ProductImage, ProductPage } from './product.ts';
import type { ProductFilters, ProductListCriteria, ProductRepository } from './products.port.ts';

/**
 * Test doubles for the ports of the products module. Used from `*.spec.ts` only — the
 * rule is pinned down in `.dependency-cruiser.cjs` so they cannot leak into runtime code.
 *
 * The in-memory repository repeats the semantics of the SQL one rather than the SQL: it
 * is the place where "what the filter means" is written down in a form a test can read.
 */

const EPOCH = new Date('2026-01-01T00:00:00.000Z');

export function makeProductImage(overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    r2Key: 'products/22222222/original.jpg',
    url: 'https://r2.example.com/products/22222222/original.jpg',
    position: 0,
    isMain: true,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова миша у відмінному стані.',
    titleOlx: 'Logitech MX Master 3 бездротова миша',
    descriptionOlx: 'Продам мишу Logitech, повний комплект.',
    priceCents: 249_900,
    seoKeywords: ['миша', 'logitech', 'бездротова'],
    category: 'Комп’ютерна периферія',
    published: true,
    accountProm: 'prom-main',
    accountOlx: 'olx-main',
    condition: 'used',
    images: [makeProductImage()],
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  };
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

function matches(product: Product, filters: ProductFilters): boolean {
  if (
    filters.title !== undefined &&
    !includesCaseInsensitive(product.titleProm, filters.title) &&
    !includesCaseInsensitive(product.titleOlx, filters.title)
  ) {
    return false;
  }
  if (
    filters.description !== undefined &&
    !includesCaseInsensitive(product.descriptionProm, filters.description) &&
    !includesCaseInsensitive(product.descriptionOlx, filters.description)
  ) {
    return false;
  }
  if (filters.priceMinCents !== undefined && product.priceCents < filters.priceMinCents) {
    return false;
  }
  if (filters.priceMaxCents !== undefined && product.priceCents > filters.priceMaxCents) {
    return false;
  }
  if (filters.category !== undefined && product.category !== filters.category) {
    return false;
  }
  if (filters.published !== undefined && product.published !== filters.published) {
    return false;
  }
  if (filters.accountProm !== undefined && product.accountProm !== filters.accountProm) {
    return false;
  }
  if (filters.accountOlx !== undefined && product.accountOlx !== filters.accountOlx) {
    return false;
  }
  return true;
}

function compare(left: Product, right: Product, criteria: ProductListCriteria): number {
  const sign = criteria.direction === 'asc' ? 1 : -1;

  if (criteria.sort === 'price') {
    return (left.priceCents - right.priceCents) * sign;
  }

  const field = criteria.sort === 'titleProm' ? 'titleProm' : 'titleOlx';
  return left[field].localeCompare(right[field], 'uk') * sign;
}

export type InMemoryProductRepository = ProductRepository & {
  /** The criteria of the last call — this is how a test checks the query mapping. */
  readonly lastCriteria: () => ProductListCriteria | null;
};

export function createInMemoryProductRepository(
  seed: readonly Product[] = [],
): InMemoryProductRepository {
  const rows = [...seed];
  let received: ProductListCriteria | null = null;

  return {
    lastCriteria: () => received,

    async list(criteria: ProductListCriteria): Promise<ProductPage> {
      received = criteria;

      const matched = rows
        .filter((product) => matches(product, criteria.filters))
        .sort((left, right) => compare(left, right, criteria));
      const offset = (criteria.page - 1) * criteria.pageSize;

      return {
        items: matched.slice(offset, offset + criteria.pageSize),
        total: matched.length,
        page: criteria.page,
        pageSize: criteria.pageSize,
      };
    },
  };
}
