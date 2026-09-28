const ENTITY_CHARACTERS = { amp: '&', lt: '<', gt: '>', nbsp: ' ' } as const;

export function draftPlainText(draft: string): string {
  return (
    draft
      // Whitespace around block tags is source formatting; the line breaks come from the tags alone.
      .replaceAll(/\s*(<\/?(?:p|ul|ol|li|br)\b[^>]*>)\s*/gi, '$1')
      .replaceAll(/<br\s*\/?>/gi, '\n')
      .replaceAll(/<li\b[^>]*>/gi, '• ')
      .replaceAll(/<\/li>/gi, '\n')
      .replaceAll(/<\/p>/gi, '\n\n')
      .replaceAll(/<\/(?:ul|ol)>/gi, '\n')
      .replaceAll(/<[^>]*>/g, '')
      .replaceAll(
        /&(amp|lt|gt|nbsp);/g,
        (_entity, name: keyof typeof ENTITY_CHARACTERS) => ENTITY_CHARACTERS[name],
      )
      .trim()
  );
}
