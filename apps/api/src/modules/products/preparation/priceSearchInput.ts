import { config } from '../../../config.ts';
import { draftPlainText } from '../description/draftPlainText.ts';

export type PriceSearchDraft = {
  readonly titleProm: string;
  readonly titleOlx: string;
  readonly descriptionProm: string;
  readonly descriptionOlx: string;
};

export type PriceSearchGap = 'title' | 'description';

export type PriceSearchInput =
  | { readonly kind: 'pair'; readonly title: string; readonly description: string }
  | { readonly kind: 'missing'; readonly missing: readonly PriceSearchGap[] };

export function priceSearchInput(draft: PriceSearchDraft): PriceSearchInput {
  const title = (draft.titleProm.trim() || draft.titleOlx.trim()).slice(
    0,
    config.ai.priceSearch.maxInputChars,
  );
  const description = (draftPlainText(draft.descriptionProm) || draft.descriptionOlx.trim()).slice(
    0,
    config.ai.priceSearch.maxInputChars,
  );
  const missing: PriceSearchGap[] = [];
  if (!title) missing.push('title');
  if (!description) missing.push('description');
  if (missing.length > 0) return { kind: 'missing', missing };

  return { kind: 'pair', title, description };
}
