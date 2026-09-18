import { promDescriptionHtml } from '@contracts/prom-description-html';
import DOMPurify from 'dompurify';

export function promDescriptionCleanup(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...promDescriptionHtml.allowedTags],
    ALLOWED_ATTR: [...promDescriptionHtml.allowedAttributes.a],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_CONTENTS: [...promDescriptionHtml.droppedWithContent],
  });

  return sanitized
    .replaceAll(/<(\/?)b>/g, '<$1strong>')
    .replaceAll(/<(\/?)i>/g, '<$1em>')
    .replaceAll(/(?:&nbsp;| )(?:\s|&nbsp;)+/g, ' ')
    .replaceAll(/<p>(?:\s|&nbsp;|<br>)*<\/p>/g, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}
