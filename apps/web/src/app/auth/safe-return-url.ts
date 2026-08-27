/** Where a signed-in admin belongs when nothing more specific was asked for. */
export const defaultLandingUrl = '/products';

/**
 * A `returnUrl` arrives from the query string, which anyone can write. Only a path inside
 * this application is worth honouring: `//evil.example` is a protocol-relative URL the
 * browser reads as another origin, and an absolute URL is not ours to navigate to. The sign-in
 * page is refused as a destination as well — landing back on it would be a loop, not a return.
 */
export function safeReturnUrl(candidate: string | null | undefined): string {
  if (candidate === null || candidate === undefined) {
    return defaultLandingUrl;
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return defaultLandingUrl;
  }
  return candidate === '/' || candidate.startsWith('/login') ? defaultLandingUrl : candidate;
}
