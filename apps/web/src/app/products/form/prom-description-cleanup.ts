import { promDescriptionHtml } from '@contracts/prom-description-html';
import DOMPurify from 'dompurify';

/**
 * Must produce byte for byte what the server's `cleanDescription` (T47) stores, or the saved
 * description drifts from the one shown. DOMPurify has neither `transformTags` nor
 * `allowedSchemes`, so the b/i renaming happens after sanitizing and the schemes live in the URI
 * pattern.
 */
export function promDescriptionCleanup(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...promDescriptionHtml.allowedTags],
    ALLOWED_ATTR: [...promDescriptionHtml.allowedAttributes.a],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    // DOMPurify's default pattern, narrowed to the server's http, https and mailto.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_CONTENTS: [...promDescriptionHtml.droppedWithContent],
  });

  return sanitized
    .replaceAll(/<(\/?)b>/g, '<$1strong>')
    .replaceAll(/<(\/?)i>/g, '<$1em>')
    .replaceAll(/(?:&nbsp;|\u00a0)(?:\s|&nbsp;)+/g, ' ')
    .replaceAll(/<p>(?:\s|&nbsp;|<br>)*<\/p>/g, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}
