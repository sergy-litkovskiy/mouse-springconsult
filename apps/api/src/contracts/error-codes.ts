/**
 * API error codes. A constant with no dependencies whatsoever — and that is deliberate.
 *
 * The frontend imports it at runtime to map a code onto user-facing text. Were it to sit
 * next to the zod schema, the whole validation library would land in the browser bundle
 * (measured: ~55 KB gzip) for the sake of a six-line object.
 */
export const apiErrorCodes = {
  validationFailed: 'validation_failed',
  invalidCredentials: 'invalid_credentials',
  userDeactivated: 'user_deactivated',
  notAuthenticated: 'not_authenticated',
  tooManyRequests: 'too_many_requests',
  internalError: 'internal_error',
} as const;

export type ApiErrorCode = (typeof apiErrorCodes)[keyof typeof apiErrorCodes];
