import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { PriceRange } from '@contracts/products.contract';

export type PriceListingsData = {
  readonly range: PriceRange;
  /** The suggestion's `createdAt`: it moves with every new search. */
  readonly searchedAt: string;
};

/**
 * A dialog rather than a tooltip: a Material tooltip holds plain text only and closes as the
 * pointer leaves for it, so its links could not be clicked (ADR 0024).
 */
@Component({
  selector: 'app-price-listings',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './price-listings.html',
  styleUrl: './price-listings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListings {
  private readonly data = inject<PriceListingsData>(MAT_DIALOG_DATA);

  /** The links come from a model's reply. The server already refuses any other scheme; this keeps
   * a `javascript:` link out of the page should that schema ever loosen. */
  protected readonly listings = this.data.range.listings
    .filter((listing) => /^https?:\/\//.test(listing.url))
    .map((listing) => ({ url: listing.url, price: priceFormat.format(Number(listing.price)) }));

  protected readonly searchedAt = dateFormat.format(new Date(this.data.searchedAt));
}

const priceFormat = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeStyle: 'short' });
