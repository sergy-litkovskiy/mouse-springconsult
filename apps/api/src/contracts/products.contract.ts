import { z } from 'zod';
import {
  productConditions,
  productConstraints,
  productPagination,
  productSortDefaults,
  productSortDirections,
  productSortFields,
} from './products-limits.ts';

/**
 * Contracts of the products module. `ProductController.ts` validates incoming requests with
 * them; the frontend takes the types through the `@contracts/*` alias — one description
 * of the catalogue for both sides.
 */

export const productImageSchema = z.object({
  id: z.uuid(),
  /** Object key in R2. The bucket itself arrives with the media module. */
  r2Key: z.string(),
  url: z.url(),
  /** Position in the gallery, 0-based; the main frame is not required to be first. */
  position: z.int().nonnegative(),
  isMain: z.boolean(),
});

export type ProductImage = z.infer<typeof productImageSchema>;

/**
 * The price as the database hands it over: a decimal string like "2499.00". It never
 * becomes a number anywhere in the stack — that is what keeps the value the admin typed
 * identical to the value that reaches Prom, with no float and no unit to agree on.
 */
const priceDecimal = z
  .string()
  .trim()
  .regex(productConstraints.pricePattern, 'Price must be a decimal such as 2499.00');

export const productSchema = z.object({
  id: z.uuid(),
  titleProm: z.string(),
  descriptionProm: z.string(),
  titleOlx: z.string(),
  descriptionOlx: z.string(),
  price: priceDecimal,
  seoKeywords: z.array(z.string()),
  category: z.string(),
  published: z.boolean(),
  accountProm: z.string().nullable(),
  accountOlx: z.string().nullable(),
  condition: z.enum(productConditions),
  images: z.array(productImageSchema),
  /** ISO 8601, UTC. Formatting belongs to the client. */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Product = z.infer<typeof productSchema>;

/**
 * A querystring arrives as strings, so numbers and booleans are coerced here rather than
 * in the route. `published` is spelled out instead of `z.coerce.boolean()` on purpose:
 * coercion runs `Boolean(value)`, and the string "false" is truthy — the filter would
 * then be incapable of ever selecting unpublished cards.
 */
const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .or(z.boolean());

const trimmedFilter = z.string().trim().min(1).max(productConstraints.titleMaxLength);

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(productPagination.defaultPage),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(productPagination.maxPageSize)
    .default(productPagination.defaultPageSize),

  /** Substring match, case-insensitive, across both marketplace titles. */
  title: trimmedFilter.optional(),
  /** Same, across both descriptions. */
  description: trimmedFilter.optional(),
  /** Inclusive bounds, decimal strings like the price itself. Nothing is coerced. */
  priceMin: priceDecimal.optional(),
  priceMax: priceDecimal.optional(),
  category: z.string().trim().min(1).max(productConstraints.categoryMaxLength).optional(),
  published: booleanFlag.optional(),
  accountProm: z.string().trim().min(1).max(productConstraints.accountMaxLength).optional(),
  accountOlx: z.string().trim().min(1).max(productConstraints.accountMaxLength).optional(),

  sort: z.enum(productSortFields).default(productSortDefaults.field),
  direction: z.enum(productSortDirections).default(productSortDefaults.direction),
});

/** What the backend works with once the query has been validated. */
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productListSchema = z.object({
  items: z.array(productSchema),
  /** Total number of rows matching the filters, not the size of the page. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type ProductList = z.infer<typeof productListSchema>;
