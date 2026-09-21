import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { FieldSuggestion } from '@contracts/products.contract';

/**
 * The right half of a paired field (mockup 2026-09-12): the model's latest suggestion beside the
 * value the admin is editing, never instead of it (AC-11).
 *
 * Shown, not edited — for every field, not only the price. Accepting a suggestion copies what the
 * server stored (`acceptSuggestion` takes an identifier, not a value, T30), so a correction made
 * here would go nowhere. The admin edits on the left, after «<- AI» brought the text over.
 */
@Component({
  selector: 'app-suggestion-field',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './suggestion-field.html',
  styleUrl: './suggestion-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionField {
  readonly label = input.required<string>();
  readonly suggestion = input<FieldSuggestion | null>(null);
  /** Disabled while any run of this card is going: the rate limit is shared (PRD §6.1). */
  readonly busy = input(false);
  /** AC-22 for a text, AC-24 for the price — the reason belongs in `rewriteHint`. */
  readonly canRewrite = input(false);
  readonly rewriteHint = input('');
  /** The price has no «<- AI»: the admin types the number in by hand (AC-25). */
  readonly acceptable = input(true);

  readonly rewrite = output();
  readonly accept = output();

  protected readonly text = computed(() => describe(this.suggestion()?.value));
  protected readonly canAccept = computed(
    () => this.acceptable() && this.suggestion() !== null && !this.busy(),
  );
}

/** Polymorphic by field, the way the column is: a text, a keyword list or a price range. */
function describe(value: FieldSuggestion['value'] | undefined): string {
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  const range = value as { priceFrom: string; priceTo: string };
  return `від ${range.priceFrom} до ${range.priceTo} ₴`;
}
