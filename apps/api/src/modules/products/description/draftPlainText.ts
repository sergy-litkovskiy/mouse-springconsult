import sanitizeHtml from 'sanitize-html';

/**
 * sanitize-html escapes the text it writes out; the model reads plain text, so the entities go
 * back to characters. `&amp;` is last, or `&amp;lt;` would turn into `<`.
 */
const TEXT_ENTITIES: readonly (readonly [string, string])[] = [
  ['&nbsp;', ' '],
  [' ', ' '],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&amp;', '&'],
];

/**
 * Follows `toPlainText` in `db/prom-xlsx.ts`, which a module may not import. Tiptap wraps a list
 * item's text in a paragraph, so that paragraph is unwrapped first to keep the item on one line.
 */
export function draftPlainText(draft: string): string {
  const withBreaks = draft
    .replaceAll(/<li>\s*<p>/g, '<li>')
    .replaceAll(/<\/p>\s*<\/li>/g, '</li>')
    .replaceAll(/<br(?: \/)?>\s*/g, '\n')
    .replaceAll('<li>', '• ')
    .replaceAll(/<\/li>\s*/g, '\n')
    .replaceAll(/<\/(?:p|ul|ol|h2|h3|h4)>/g, '\n\n');
  const text = TEXT_ENTITIES.reduce(
    (result, [entity, character]) => result.replaceAll(entity, character),
    sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} }),
  );

  return text
    .replaceAll(/[ \t]+\n/g, '\n')
    .replaceAll(/\n[ \t]+/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}
