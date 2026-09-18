import sanitizeHtml from 'sanitize-html';
import { promDescriptionHtml } from '../../contracts/prom-description-html.ts';

/**
 * Most descriptions were pasted from a browser and carry Google's markup along: `data-*`,
 * `jscontroller`, inline styles, comments, empty paragraphs. Only the structure an admin would
 * type by hand survives; any other tag is unwrapped and its text kept.
 */
export function cleanDescription(html: string): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [...promDescriptionHtml.allowedTags],
    allowedAttributes: { a: [...promDescriptionHtml.allowedAttributes.a] },
    nonTextTags: [...promDescriptionHtml.droppedWithContent],
  });

  return sanitized
    .replaceAll(/(?:&nbsp;|\u00a0)(?:\s|&nbsp;)+/g, ' ')
    .replaceAll(/<p>(?:\s|&nbsp;|<br \/>)*<\/p>/g, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}
