import { promDescriptionCleanup } from './prom-description-cleanup';

/**
 * The model writes the Prom description as plain text and the editor holds HTML, so it is
 * converted the way the server's `promDescription` does (ADR 0016 №7).
 */
export function promDescriptionFromText(text: string): string {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return promDescriptionCleanup(
    escaped
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replaceAll('\n', '<br>')}</p>`)
      .join(''),
  );
}
