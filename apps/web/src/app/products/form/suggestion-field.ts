import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { FieldSuggestion, PriceRange } from '@contracts/products.contract';
import { PriceListings, type PriceListingsData } from './price-listings';

/**
 * The right half of a paired field (mockup 2026-09-12): the model's latest suggestion beside the
 * value the admin is editing, never instead of it.
 *
 * Shown, not edited — for every field, not only the price. The admin edits on the left, after
 * «<- AI» brought the text over.
 */
@Component({
  selector: 'app-suggestion-field',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './suggestion-field.html',
  styleUrl: './suggestion-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionField {
  private readonly dialog = inject(MatDialog);

  readonly label = input.required<string>();
  readonly suggestion = input<FieldSuggestion | null>(null);
  /** Disabled while any run of this card is going: the rate limit is shared. */
  readonly busy = input(false);
  /** This field's own run is going: its launch buttons give way to a spinner. */
  readonly working = input(false);
  /** Off for an empty draft, or a price without a title; the reason belongs in `rewriteHint`. */
  readonly canRewrite = input(false);
  readonly rewriteHint = input('');
  /** The price has no «<- AI»: the admin types the number in by hand. */
  readonly acceptable = input(true);

  readonly improvable = input(true);

  readonly rewrite = output();
  readonly improve = output();
  readonly accept = output();

  /** Disabled launch buttons stay hoverable for their hint (`disabledInteractive`), so Material
   * no longer swallows the click — it is gated here. */
  protected readonly canLaunch = computed(() => this.canRewrite() && !this.busy());
  protected readonly text = computed(() => describe(this.suggestion()?.value));
  protected readonly listings = computed<PriceListingsData | null>(() => {
    const suggestion = this.suggestion();
    return suggestion !== null && isRange(suggestion.value)
      ? { range: suggestion.value, searchedAt: suggestion.createdAt }
      : null;
  });
  /** A suggestion has no decision of its own: it is offered for as long as it is the latest. */
  protected readonly canAccept = computed(
    () => this.acceptable() && this.suggestion() !== null && !this.busy(),
  );

  protected showListings(data: PriceListingsData): void {
    this.dialog.open<PriceListings, PriceListingsData>(PriceListings, { data });
  }
}

/** Polymorphic by field, the way the column is: a text, a keyword list or a price range. */
function describe(value: FieldSuggestion['value'] | undefined): string {
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (isRange(value)) {
    return `від ${value.priceFrom} до ${value.priceTo} ₴`;
  }
  return value.join(', ');
}

/** `Array.isArray` leaves a readonly array in the union, so the range is told apart by its key. */
function isRange(value: FieldSuggestion['value']): value is PriceRange {
  return typeof value === 'object' && 'priceFrom' in value;
}
