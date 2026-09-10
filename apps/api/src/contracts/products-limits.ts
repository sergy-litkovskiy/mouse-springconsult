/**
 * No dependencies on purpose: the frontend imports these values at runtime, and a runtime import
 * from the zod file next door would drag the whole validation library into the browser bundle.
 */
export const productConstraints = {
  titleMaxLength: 200,
  descriptionMaxLength: 8_000,
  categoryMaxLength: 120,
  keywordMaxLength: 60,
  maxKeywords: 30,
  maxImagesPerProduct: 10,
  /**
   * Two more places carry this number and none of them can see this one — `config.http` (the
   * media route's own `bodyLimitBytes`, not the 256 KB default) and `infra/caddy/Caddyfile`
   * (`request_body max_size`). They drift silently: a proxy rejecting at 8 MB answers with its
   * own 413, and the domain error never runs.
   */
  maxImageBytes: 10 * 1024 * 1024,
  /**
   * Ten integer digits and at most two decimals are `decimal(12,2)`'s own limits; a leading minus
   * is refused here as well as by `products_price_non_negative_check`.
   */
  pricePattern: /^\d{1,10}(\.\d{1,2})?$/,
} as const;

export const productPagination = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 50,
} as const;

/**
 * The service matches the content signature against this list — the extension and the
 * browser-supplied MIME type are both hints, not evidence.
 */
export const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof allowedImageTypes)[number];

export const productConditions = ['new', 'used'] as const;
export type ProductCondition = (typeof productConditions)[number];

/** A closed list rather than a free-form string: the value goes into an ORDER BY. */
export const productSortFields = ['titleProm', 'titleOlx', 'price'] as const;
export type ProductSortField = (typeof productSortFields)[number];

export const productSortDirections = ['asc', 'desc'] as const;
export type ProductSortDirection = (typeof productSortDirections)[number];

export const productSortDefaults = {
  field: 'titleProm',
  direction: 'asc',
} as const satisfies { field: ProductSortField; direction: ProductSortDirection };
