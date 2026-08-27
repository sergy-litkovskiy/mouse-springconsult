import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@contracts/error.contract';

/**
 * One reading of an API failure for the whole application. It is a file at the `app/` level
 * rather than a member of a feature: `auth` and `products` both need it, and the two private
 * copies it replaces had already drifted apart — one typed the body from the contract, the
 * other restated a narrower shape inline.
 *
 * The server sends a code, never a sentence, so the wording stays with the UI: each caller
 * brings its own map and its own fallback.
 */
const NETWORK_ERROR_MESSAGE = 'Немає зв’язку із сервером. Перевірте мережу і спробуйте ще раз.';

export function apiErrorMessage(
  error: unknown,
  messages: Readonly<Record<string, string>>,
  fallback: string,
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }

  const code = errorCode(error.error);
  return code === undefined ? fallback : (messages[code] ?? fallback);
}

/**
 * The body is whatever answered: the contract shape when it was the API, an HTML page when
 * it was a proxy in front of it. Reaching for `.error.code` without checking would throw on
 * the second case — and throw from inside the code that is supposed to explain the failure.
 */
function errorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  return (body as Partial<ApiError>).error?.code;
}
