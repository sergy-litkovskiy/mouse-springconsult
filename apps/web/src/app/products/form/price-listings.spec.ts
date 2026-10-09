import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import type { PriceRange } from '@contracts/products.contract';
import { PriceListings, type PriceListingsData } from './price-listings';

const range: PriceRange = {
  priceFrom: '1800.00',
  priceTo: '2400.00',
  listings: [
    { price: '1800.00', url: 'https://prom.ua/p123-myshka.html' },
    { price: '2100.50', url: 'https://shafa.ua/uk/men/aksessuary/42' },
    { price: '2400.00', url: 'http://kloomba.com/item/7' },
  ],
};

describe('PriceListings', () => {
  let dialog: MatDialog;

  async function open(data: PriceListingsData): Promise<void> {
    TestBed.configureTestingModule({
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
    dialog = TestBed.inject(MatDialog);
    dialog.open<PriceListings, PriceListingsData>(PriceListings, { data });
    await settle();
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  afterEach(async () => {
    dialog.closeAll();
    await settle();
  });

  /** The dialog lives in the overlay container on the body, not inside any fixture. */
  function overlay(): HTMLElement {
    const container = document.querySelector<HTMLElement>('mat-dialog-container');
    if (container === null) {
      throw new Error('no open dialog');
    }
    return container;
  }

  function items(): HTMLElement[] {
    return [...overlay().querySelectorAll<HTMLElement>('[data-testid="price-listing"]')];
  }

  /** ICU separates thousands with a no-break space. */
  function spaced(text: string | null | undefined): string {
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  it('lists every listing with its price in hryvnias and its link', async () => {
    await open({ range, searchedAt: '2026-10-09T12:00:00.000Z' });

    expect(
      items().map((item) => spaced(item.querySelector('.listings__price')?.textContent)),
    ).toEqual(['1 800,00 ₴', '2 100,50 ₴', '2 400,00 ₴']);
    expect(items().map((item) => item.querySelector('a')?.getAttribute('href'))).toEqual(
      range.listings.map((listing) => listing.url),
    );
  });

  it('opens every link in a new tab without handing it the opener', async () => {
    await open({ range, searchedAt: '2026-10-09T12:00:00.000Z' });

    for (const link of overlay().querySelectorAll('a')) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('shows the date of the search', async () => {
    await open({ range, searchedAt: '2026-10-09T12:00:00.000Z' });

    expect(
      spaced(overlay().querySelector('[data-testid="price-listings-date"]')?.textContent),
    ).toContain('9 жовтня 2026');
  });

  it('renders no listing whose link is not http or https', async () => {
    const listings = [
      ...range.listings.slice(0, 2),
      { price: '2400.00', url: 'javascript:alert(document.cookie)' },
    ];
    await open({ range: { ...range, listings }, searchedAt: '2026-10-09T12:00:00.000Z' });

    expect(items()).toHaveLength(2);
    expect(overlay().innerHTML).not.toContain('javascript:');
  });
});
