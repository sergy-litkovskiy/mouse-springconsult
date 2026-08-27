import type { ProductSortDirection, ProductSortField } from '../../contracts/products-limits.ts';
import type { ProductPage } from './product.ts';

/**
 * Ports of the products module. No I/O here — the implementation lives in
 * `product.repository.ts`, and the composition root wires it in.
 */

/**
 * Every filter is optional and they combine with AND. `title` and `description` are
 * substring matches over both marketplaces at once: the admin looks for a card, not for
 * a Prom field or an OLX field.
 */
export type ProductFilters = {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly priceMinCents?: number | undefined;
  readonly priceMaxCents?: number | undefined;
  readonly category?: string | undefined;
  readonly published?: boolean | undefined;
  readonly accountProm?: string | undefined;
  readonly accountOlx?: string | undefined;
};

export type ProductListCriteria = {
  /** 1-based: what the paginator shows is what the API takes. */
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ProductSortField;
  readonly direction: ProductSortDirection;
  readonly filters: ProductFilters;
};

export type ProductRepository = {
  /** One page plus the total count behind it — both come from a single query. */
  list(criteria: ProductListCriteria): Promise<ProductPage>;
};
