import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import type { FieldSuggestion } from '@contracts/products.contract';
import { SuggestionField } from './suggestion-field';

describe('SuggestionField', () => {
  it('hides the improve button when improvable is false (AC-68)', () => {
    TestBed.configureTestingModule({ imports: [SuggestionField] });
    const sf = TestBed.createComponent(SuggestionField);
    sf.componentRef.setInput('label', 'Ціна від моделі');
    sf.componentRef.setInput('improvable', false);
    sf.detectChanges();

    expect((sf.nativeElement as HTMLElement).querySelector('[data-testid="improve"]')).toBeNull();
  });

  it('gives the disabled improve button the same hint as the prompt button (AC-68)', async () => {
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

  function decided(resolution: 'accepted' | 'rejected'): FieldSuggestion {
    return {
      id: '55555555-5555-4555-8555-555555555555',
      runId: '44444444-4444-4444-8444-444444444444',
      field: 'descriptionOlx',
      value: 'Продам мишу Logitech MX Master 3, повний комплект.',
      resolution,
      resolvedAt: '2026-09-20T09:00:40.000Z',
      createdAt: '2026-09-20T09:00:35.000Z',
    };
  }

  function render(suggestion: FieldSuggestion): HTMLElement {
    TestBed.configureTestingModule({ imports: [SuggestionField] });
    const sf = TestBed.createComponent(SuggestionField);
    sf.componentRef.setInput('label', 'Пропозиція для OLX');
    sf.componentRef.setInput('suggestion', suggestion);
    sf.detectChanges();
    return sf.nativeElement as HTMLElement;
  }

  it('marks an accepted suggestion «застосовано» and keeps «<- AI» off (AC-69)', () => {
    const element = render(decided('accepted'));

    expect(
      element
        .querySelector('[data-testid="suggestion-resolution"]')
        ?.textContent.trim()
        .toLowerCase(),
    ).toBe('застосовано');
    expect(element.querySelector<HTMLButtonElement>('[data-testid="accept"]')?.disabled).toBe(true);
  });

  it('marks a rejected suggestion «відхилено» and keeps «<- AI» off (Checklist 3)', () => {
    const element = render(decided('rejected'));

    expect(
      element
        .querySelector('[data-testid="suggestion-resolution"]')
        ?.textContent.trim()
        .toLowerCase(),
    ).toBe('відхилено');
    expect(element.querySelector<HTMLButtonElement>('[data-testid="accept"]')?.disabled).toBe(true);
  });
});
