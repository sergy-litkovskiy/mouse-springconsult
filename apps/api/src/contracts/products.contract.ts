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
  publishedProm: z.boolean(),
  publishedOlx: z.boolean(),
  condition: z.enum(productConditions),
  images: z.array(productImageSchema),
  /** ISO 8601, UTC. Formatting belongs to the client. */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Product = z.infer<typeof productSchema>;

/**
 * A querystring arrives as strings, so numbers and booleans are coerced here rather than
 * in the route. The publication flags are spelled out instead of `z.coerce.boolean()` on
 * purpose: coercion runs `Boolean(value)`, and the string "false" is truthy — the filters
 * would then be incapable of ever selecting cards that are not on a marketplace.
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
  /**
   * One card, two marketplaces, two independent questions: each flag asks about its own
   * site, and a flag left out asks nothing at all.
   */
  publishedProm: booleanFlag.optional(),
  publishedOlx: booleanFlag.optional(),

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

/**
 * Write side of the catalogue. The bounds are the ones the column already declares, so a
 * value the schema lets through is a value the table can hold: what is required here is
 * exactly what `products` declares NOT NULL without a default, and what carries a default
 * here carries the same default there.
 */
const cardTitle = z.string().trim().min(1).max(productConstraints.titleMaxLength);
const cardDescription = z.string().max(productConstraints.descriptionMaxLength);
const cardCategory = z.string().trim().min(1).max(productConstraints.categoryMaxLength);

/**
 * Thirty is not a bound of this schema on purpose: AC-07 has the service keep the first
 * thirty words and discard the rest, and a schema that refused the thirty-first would
 * make that impossible — the request would never reach the service to be trimmed.
 */
const cardKeywords = z.array(z.string().trim().min(1).max(productConstraints.keywordMaxLength));

export const productCreateSchema = z.object({
  titleProm: cardTitle,
  titleOlx: cardTitle,
  category: cardCategory,
  descriptionProm: cardDescription.default(''),
  descriptionOlx: cardDescription.default(''),
  /** `NUMERIC(12,2) DEFAULT 0` gives back "0.00", and the predicate of readiness reads it as "not priced yet". */
  price: priceDecimal.default('0.00'),
  seoKeywords: cardKeywords.default([]),
  condition: z.enum(productConditions).default('used'),
});

/** What the backend works with once a creation request has been validated. */
export type ProductCreate = z.infer<typeof productCreateSchema>;

/**
 * A PATCH changes what it sends and nothing else, so every field is optional and none of
 * them has a default — a default here would silently rewrite a column the admin never
 * touched. The two publication marks are separate fields rather than one: a card lives on
 * two marketplaces, and taking it off Prom says nothing about OLX (AC-13).
 */
export const productUpdateSchema = z.object({
  titleProm: cardTitle.optional(),
  titleOlx: cardTitle.optional(),
  category: cardCategory.optional(),
  descriptionProm: cardDescription.optional(),
  descriptionOlx: cardDescription.optional(),
  price: priceDecimal.optional(),
  seoKeywords: cardKeywords.optional(),
  condition: z.enum(productConditions).optional(),
  publishedProm: z.boolean().optional(),
  publishedOlx: z.boolean().optional(),
});

export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export const productCardSchema = productSchema.extend({
  /**
   * Derived, not a column: both descriptions non-empty, a price above zero and at least
   * one frame in the gallery. It is computed on read (ADR 0009), which is why it appears
   * in the response and never in a request.
   */
  isReady: z.boolean(),
});

export type ProductCard = z.infer<typeof productCardSchema>;

export const productUpdateResponseSchema = productCardSchema.extend({
  /**
   * Derived, not a column: how many keywords past the ceiling of thirty this save threw
   * away (AC-07). Zero is the ordinary answer, and going over the ceiling is reported
   * here rather than as an error.
   */
  discardedKeywordsCount: z.int().nonnegative(),
});

export type ProductUpdateResponse = z.infer<typeof productUpdateResponseSchema>;
