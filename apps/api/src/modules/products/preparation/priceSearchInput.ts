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
  throw new Error('Not implemented');
}
