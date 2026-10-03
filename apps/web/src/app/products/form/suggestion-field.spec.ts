import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
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
});
