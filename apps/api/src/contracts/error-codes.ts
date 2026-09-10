/**
 * No dependencies, deliberately: the frontend imports this at runtime to map a code onto
 * user-facing text, and next to the zod schema it would drag the whole validation library into
 * the browser bundle (measured: ~55 KB gzip) for the sake of a six-line object.
 */
export const apiErrorCodes = {
  validationFailed: 'validation_failed',
  invalidCredentials: 'invalid_credentials',
  userDeactivated: 'user_deactivated',
  notAuthenticated: 'not_authenticated',
  tooManyRequests: 'too_many_requests',
  internalError: 'internal_error',

  // The class carrying each of these lives in modules/products/ProductErrors.ts — a code
  // without its class is a string nothing throws.
  productNotFound: 'product_not_found',
  imageNotFound: 'image_not_found',
  galleryFull: 'gallery_full',
  invalidFile: 'invalid_file',
  fileTooLarge: 'file_too_large',
  storageUnavailable: 'storage_unavailable',
  invalidPrice: 'invalid_price',
} as const;

export type ApiErrorCode = (typeof apiErrorCodes)[keyof typeof apiErrorCodes];
