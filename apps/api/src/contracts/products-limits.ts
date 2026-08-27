/**
 * Constraints of the product catalogue. No dependencies on purpose: the zod schema next
 * door reads its bounds from here, and the frontend imports the same values at runtime —
 * paginator page sizes, sort columns, the condition labels — without dragging zod into
 * the browser bundle.
 */
export const productConstraints = {
  titleMaxLength: 200,
  descriptionMaxLength: 8_000,
  categoryMaxLength: 120,
  accountMaxLength: 120,
  keywordMaxLength: 60,
  maxKeywords: 30,
  /** A card carries a gallery, not an archive: ten frames is the agreed ceiling. */
  maxImagesPerProduct: 10,
  /** Prices are whole kopiykas everywhere in the code; numeric(12,2) is the storage form. */
  maxPriceCents: 99_999_999_999,
} as const;

export const productPagination = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 50,
} as const;

/** Condition of the item, as Prom and OLX both name it. */
export const productConditions = ['new', 'used'] as const;
export type ProductCondition = (typeof productConditions)[number];

/**
 * Sortable columns. A closed list rather than a free-form string: the value goes into an
 * ORDER BY, so anything not enumerated here has no business reaching the repository.
 */
export const productSortFields = ['titleProm', 'titleOlx', 'price'] as const;
export type ProductSortField = (typeof productSortFields)[number];

export const productSortDirections = ['asc', 'desc'] as const;
export type ProductSortDirection = (typeof productSortDirections)[number];

export const productSortDefaults = {
  field: 'titleProm',
  direction: 'asc',
} as const satisfies { field: ProductSortField; direction: ProductSortDirection };
