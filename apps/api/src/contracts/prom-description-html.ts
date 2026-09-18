/**
 * The markup a Prom description may keep (ADR 0016). No dependencies on purpose: the browser
 * cleans with the same list at runtime, and a runtime import from a zod file would drag the
 * validation library into its bundle.
 */
export const promDescriptionHtml = {
  allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'h4', 'a'],
  allowedAttributes: { a: ['href'] },
  /** Dropped together with everything inside them, not unwrapped. */
  droppedWithContent: ['style', 'script', 'textarea', 'option', 'noscript', 'title'],
} as const;
