import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import type { FieldSuggestion } from '@contracts/products.contract';
import { SuggestionField } from './suggestion-field';

describe('SuggestionField', () => {
  it('hides the improve button when improvable is false', () => {
    TestBed.configureTestingModule({ imports: [SuggestionField] });
    const sf = TestBed.createComponent(SuggestionField);
    sf.componentRef.setInput('label', 'Ціна від моделі');
    sf.componentRef.setInput('improvable', false);
    sf.detectChanges();

    expect((sf.nativeElement as HTMLElement).querySelector('[data-testid="improve"]')).toBeNull();
  });

  it('gives the disabled improve button the same hint as the prompt button', async () => {
    TestBed.configureTestingModule({ imports: [SuggestionField] });
    const sf = TestBed.createComponent(SuggestionField);
    sf.componentRef.setInput('label', 'Назва для Prom');
    sf.componentRef.setInput('canRewrite', false);
    sf.componentRef.setInput('rewriteHint', 'Спершу напишіть текст у полі ліворуч.');
    sf.detectChanges();

    const tooltip = await TestbedHarnessEnvironment.loader(sf).getHarness(
      MatTooltipHarness.with({ selector: '[data-testid="improve"]' }),
    );
    await tooltip.show();
    expect(await tooltip.getTooltipText()).toBe('Спершу напишіть текст у полі ліворуч.');
  });

  describe('for the price', () => {
    const priceSuggestion: FieldSuggestion = {
      id: '11111111-1111-4111-8111-111111111111',
      runId: '22222222-2222-4222-8222-222222222222',
      field: 'price',
      value: {
        priceFrom: '1800.00',
        priceTo: '2400.00',
        listings: [
          { price: '1800.00', url: 'https://prom.ua/p123-myshka.html' },
          { price: '2400.00', url: 'https://shafa.ua/uk/men/aksessuary/42' },
        ],
      },
      createdAt: '2026-10-09T12:00:00.000Z',
    };

    function render(): HTMLElement {
      TestBed.configureTestingModule({
        imports: [SuggestionField],
        providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
      });
      const sf = TestBed.createComponent(SuggestionField);
      sf.componentRef.setInput('label', 'Ціна від моделі');
      sf.componentRef.setInput('suggestion', priceSuggestion);
      sf.componentRef.setInput('acceptable', false);
      sf.componentRef.setInput('improvable', false);
      sf.detectChanges();
      return sf.nativeElement as HTMLElement;
    }

    afterEach(async () => {
      TestBed.inject(MatDialog).closeAll();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await TestBed.inject(ApplicationRef).whenStable();
    });

    it('shows the range beside a button for its listings', () => {
      const host = render();

      expect(host.querySelector('[data-testid="suggestion-value"]')?.textContent.trim()).toBe(
        'від 1800.00 до 2400.00 ₴',
      );
      expect(host.querySelector('[data-testid="price-listings"]')).not.toBeNull();
    });

    it('opens the listings and the date of the search from the info button', async () => {
      const host = render();

      host.querySelector<HTMLButtonElement>('[data-testid="price-listings"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await TestBed.inject(ApplicationRef).whenStable();

      const dialog = document.querySelector('mat-dialog-container');
      expect(dialog?.querySelectorAll('[data-testid="price-listing"]')).toHaveLength(2);
      expect(dialog?.querySelector('[data-testid="price-listings-date"]')).not.toBeNull();
    });

    it('offers no way to put the range into the price field', () => {
      const host = render();

      expect(host.querySelector('[data-testid="accept"]')).toBeNull();
    });
  });

  it('has no listings button for a text', () => {
    TestBed.configureTestingModule({ imports: [SuggestionField] });
    const sf = TestBed.createComponent(SuggestionField);
    sf.componentRef.setInput('label', 'Назва для Prom');
    sf.componentRef.setInput('suggestion', {
      id: '11111111-1111-4111-8111-111111111111',
      runId: '22222222-2222-4222-8222-222222222222',
      field: 'titleProm',
      value: 'Миша Logitech MX Master 3',
      createdAt: '2026-10-09T12:00:00.000Z',
    } satisfies FieldSuggestion);
    sf.detectChanges();

    expect(
      (sf.nativeElement as HTMLElement).querySelector('[data-testid="price-listings"]'),
    ).toBeNull();
  });
});
