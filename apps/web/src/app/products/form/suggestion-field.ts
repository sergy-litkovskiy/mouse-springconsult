import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { FieldSuggestion } from '@contracts/products.contract';

/**
 * The right half of a paired field (mockup 2026-09-12): the model's latest suggestion beside the
 * value the admin is editing, never instead of it (AC-11).
 *
 * Shown, not edited — for every field, not only the price. The admin edits on the left, after
 * «<- AI» brought the text over (AC-81).
 */
@Component({
  selector: 'app-suggestion-field',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './suggestion-field.html',
  styleUrl: './suggestion-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionField {
  readonly label = input.required<string>();
  readonly suggestion = input<FieldSuggestion | null>(null);
  /** Disabled while any run of this card is going: the rate limit is shared (PRD §6.1). */
  readonly busy = input(false);
  /** This field's own run is going: its launch buttons give way to a spinner (AC-60). */
  readonly working = input(false);
  /** AC-22 for a text, AC-24 for the price — the reason belongs in `rewriteHint`. */
  readonly canRewrite = input(false);
  readonly rewriteHint = input('');
  /** The price has no «<- AI»: the admin types the number in by hand (AC-25). */
  readonly acceptable = input(true);

  readonly improvable = input(true);

  readonly rewrite = output();
  readonly improve = output();
  readonly accept = output();

  /** Disabled launch buttons stay hoverable for their hint (`disabledInteractive`), so Material
   * no longer swallows the click — it is gated here. */
  protected readonly canLaunch = computed(() => this.canRewrite() && !this.busy());
  protected readonly text = computed(() => describe(this.suggestion()?.value));
  /** A suggestion has no decision of its own: it is offered for as long as it is the latest (AC-69). */
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
