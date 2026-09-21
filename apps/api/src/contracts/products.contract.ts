import { z } from 'zod';
import {
  productConditions,
  productConstraints,
  productPagination,
  productSortDefaults,
  productSortDirections,
  productSortFields,
} from './products-limits.ts';

export const productImageSchema = z.object({
  id: z.uuid(),
  r2Key: z.string(),
  /**
   * Derived, not a column: composed from `r2Key` and the bucket's public domain when the frame is
   * mapped into this DTO (ADR 0007), so moving the bucket rewrites no rows.
   */
  url: z.url(),
  /** Position in the gallery, 0-based; the main frame is not required to be first. */
  position: z.int().nonnegative(),
  isMain: z.boolean(),
});

export type ProductImage = z.infer<typeof productImageSchema>;

/**
 * A decimal string like "2499.00" that never becomes a number anywhere in the stack: that
 * is what keeps the value the admin typed identical to the value that reaches Prom.
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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Product = z.infer<typeof productSchema>;

/**
 * Spelled out instead of `z.coerce.boolean()`: coercion runs `Boolean(value)`, and the
 * string "false" is truthy — the filters could then never select cards that are off a
 * marketplace.
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
  publishedProm: booleanFlag.optional(),
  publishedOlx: booleanFlag.optional(),
  /** The derived readiness of the card, the same predicate as `isReady` (ADR 0009). */
  ready: booleanFlag.optional(),

  sort: z.enum(productSortFields).default(productSortDefaults.field),
  direction: z.enum(productSortDirections).default(productSortDefaults.direction),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/**
 * The bounds are the ones the column already declares, so a value the schema lets through
 * is a value the table can hold, and a default here is the same default there. A default skips
 * the bounds, so an absent title stays empty while a blank one sent on purpose is refused.
 */
const cardTitle = z.string().trim().min(1).max(productConstraints.titleMaxLength);
/**
 * Unbounded on purpose (ADR 0016, №6): markup makes a character count a poor measure of how much
 * text there is, and Fastify's `bodyLimit` still caps the request.
 */
const cardDescription = z.string();
const cardCategory = z.string().trim().min(1).max(productConstraints.categoryMaxLength);

/**
 * Thirty is not a bound of this schema on purpose: AC-07 has the service keep the first
 * thirty words and discard the rest, and a schema that refused the thirty-first would
 * make that impossible — the request would never reach the service to be trimmed.
 */
const cardKeywords = z.array(z.string().trim().min(1).max(productConstraints.keywordMaxLength));

export const productCreateSchema = z.object({
  titleProm: cardTitle.default(''),
  titleOlx: cardTitle.default(''),
  category: cardCategory.default(''),
  descriptionProm: cardDescription.default(''),
  descriptionOlx: cardDescription.default(''),
  /** `NUMERIC(12,2) DEFAULT 0` gives back "0.00", and the predicate of readiness reads it as "not priced yet". */
  price: priceDecimal.default('0.00'),
  seoKeywords: cardKeywords.default([]),
  condition: z.enum(productConditions).default('used'),
});

export type ProductCreate = z.infer<typeof productCreateSchema>;

/** What a caller may send: every field has a default, so the body of a new card can be `{}`. */
export type ProductCreateRequest = z.input<typeof productCreateSchema>;

/**
 * No field here carries a default, unlike the create schema: a default on a PATCH would
 * silently rewrite a column the admin never touched.
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
   * Derived, not a column: both titles and both descriptions non-empty, a price above zero and at
   * least one frame in the gallery, computed on read (ADR 0009).
   */
  isReady: z.boolean(),
});

export type ProductCard = z.infer<typeof productCardSchema>;

/**
 * `field` is spelled the way the contract spells the card's own fields, while the column holds
 * `title_olx`: the card controller maps between the two.
 */
export const fieldSuggestionSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  field: z.enum([
    'titleProm',
    'titleOlx',
    'descriptionProm',
    'descriptionOlx',
    'seoKeywords',
    'price',
  ]),
  /** Polymorphic by `field`, the way the JSONB column is: a text, a keyword list or a range. */
  value: z.union([
    z.string(),
    z.array(z.string()).readonly(),
    z.object({ priceFrom: priceDecimal, priceTo: priceDecimal }),
  ]),
  resolution: z.enum(['accepted', 'rejected']).nullable().optional(),
  resolvedAt: z.iso.datetime().nullable().optional(),
  createdAt: z.iso.datetime(),
});

export type FieldSuggestion = z.infer<typeof fieldSuggestionSchema>;

/**
 * The cost of a card rides with the card itself and not with a list: it is a sum over the
 * preparation runs of one card (ADR 0006), and a page of cards would take that sum per row.
 * The suggestions still waiting for a decision ride along for the same reason: they are counted
 * by the very read that reconciles them (AC-11), and a page of cards would count them per row.
 */
export const productCardReadSchema = productCardSchema.extend({
  pendingSuggestions: z.array(fieldSuggestionSchema),
  totalInputTokens: z.int().nonnegative(),
  totalOutputTokens: z.int().nonnegative(),
});

export type ProductCardRead = z.infer<typeof productCardReadSchema>;

export const productListItemSchema = productCardSchema.extend({
  /** Every `failed` preparation run of the card, counted by the same query as the page (T50). */
  failedRuns: z.int().nonnegative(),
});

export type ProductListItem = z.infer<typeof productListItemSchema>;

export const productListSchema = z.object({
  items: z.array(productListItemSchema),
  /** Total number of rows matching the filters, not the size of the page. */
  total: z.int().nonnegative(),
  page: z.int().positive(),
  pageSize: z.int().positive(),
});

export type ProductList = z.infer<typeof productListSchema>;

export const productUpdateResponseSchema = productCardSchema.extend({
  /**
   * How many keywords past the ceiling of thirty this save threw away (AC-07): going over
   * the ceiling is reported here rather than as an error.
   */
  discardedKeywordsCount: z.int().nonnegative(),
});

export type ProductUpdateResponse = z.infer<typeof productUpdateResponseSchema>;
