import type { Router, UrlTree } from '@angular/router';

/**
 * Where a navigation that was interrupted should resume, and when it is worth remembering at
 * all. It is a file at the `app/` level, not inside `auth`: the rule names a route of the
 * `products` feature, and a guard, an interceptor and the sign-in form all ask it the same
 * question. Left in `auth`, renaming the landing page would mean editing the auth feature —
 * exactly the coupling rule 12 exists to prevent, and one ESLint cannot see because it is a
 * string rather than an import.
 */
export const defaultLandingUrl = '/products';

/** What an unreadable URL collapses to once the serialiser is done with it. */
const ROOT_URL = '/';

/**
 * The root redirects onwards and the form is where the admin already is, so neither is
 * somewhere to send them back to.
 */
export function isWorthReturningTo(url: string): boolean {
  return url !== '/' && !url.startsWith('/login');
}

/**
 * A `returnUrl` arrives from the query string, which anyone can write. Only a path inside
 * this application is worth honouring: `//evil.example` is a protocol-relative URL the
 * browser reads as another origin, and an absolute URL is not ours to navigate to.
 */
export function safeReturnUrl(candidate: string | null | undefined): string {
  if (candidate === null || candidate === undefined) {
    return defaultLandingUrl;
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return defaultLandingUrl;
  }
  return isWorthReturningTo(candidate) ? candidate : defaultLandingUrl;
}

/**
 * The parse belongs with the check: the shape of a `returnUrl` can be right while its contents
 * are unreadable. `/products?q=100%` is such a URL — a lone `%` is not an escape sequence — and
 * Angular's serialiser does not reject it, it returns the empty tree. Navigating there would
 * discard the destination the admin asked for without anything having gone visibly wrong.
 *
 * The `catch` is not dead weight: it covers a serialiser that raises instead of collapsing,
 * which is what `decodeURIComponent` does on its own.
 */
export function returnUrlTree(router: Router, candidate: string | null | undefined): UrlTree {
  const target = safeReturnUrl(candidate);
  if (target === defaultLandingUrl) {
    return router.parseUrl(defaultLandingUrl);
  }

  try {
    const tree = router.parseUrl(target);
    return String(tree) === ROOT_URL ? router.parseUrl(defaultLandingUrl) : tree;
  } catch {
    return router.parseUrl(defaultLandingUrl);
  }
}
