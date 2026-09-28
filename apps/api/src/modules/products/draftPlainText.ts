export function draftPlainText(draft: string): string {
  return draft
    .replaceAll(/\s*(<\/?(?:p|ul|ol|li|br)\b[^>]*>)\s*/gi, '$1')
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<li\b[^>]*>/gi, '• ')
    .replaceAll(/<\/li>/gi, '\n')
    .replaceAll(/<\/p>/gi, '\n\n')
    .replaceAll(/<\/(?:ul|ol)>/gi, '\n')
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(
      /&(amp|lt|gt|nbsp);/g,
      (_entity, name: string) =>
        ({ amp: '&', lt: '<', gt: '>', nbsp: ' ' })[name as 'amp' | 'lt' | 'gt' | 'nbsp'],
    )
    .trim();
}
