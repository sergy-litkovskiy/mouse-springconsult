import { z } from 'zod';

export const rewritableFieldSchema = z.enum([
  'titleProm',
  'titleOlx',
  'descriptionProm',
  'descriptionOlx',
  'seoKeywords',
]);

export type RewritableField = z.infer<typeof rewritableFieldSchema>;

export const fieldRewriteModeSchema = z.enum(['improve', 'prompt']);

export type FieldRewriteMode = z.infer<typeof fieldRewriteModeSchema>;

/** `field` rewrites one text from the draft in the form, so only it carries `field` and `draftText` (ADR 0015). */
export const preparationRunRequestSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.enum(['texts', 'price', 'both']) }),
  z.object({
    scope: z.literal('field'),
    field: rewritableFieldSchema,
    draftText: z.string(),
    mode: fieldRewriteModeSchema.default('improve'),
  }),
]);

export type PreparationRunRequest = z.infer<typeof preparationRunRequestSchema>;

export const preparationRunSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  scope: z.enum(['texts', 'price', 'both', 'field']),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  /**
   * Only on `failed`: `price_unavailable` (texts kept), `price_not_found`, `price_quota_exhausted`
   * or `preparation_failed`.
   */
  errorCode: z
    .enum(['price_unavailable', 'price_not_found', 'price_quota_exhausted', 'preparation_failed'])
    .nullable(),
  /**
   * Only on `failed`, and null on runs that failed before it was recorded: the English message of
   * the error behind `errorCode`, shown as a technical note under the Ukrainian text.
   */
  errorDetail: z.string().nullable(),
  model: z.string(),
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});

export type PreparationRunDto = z.infer<typeof preparationRunSchema>;

/** Only the failures can be listed so far: that is all the catalogue asks for. */
export const preparationRunListQuerySchema = z.object({ status: z.literal('failed') });

export type PreparationRunListQuery = z.infer<typeof preparationRunListQuerySchema>;
