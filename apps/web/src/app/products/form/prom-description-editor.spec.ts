import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { PromDescriptionEditor } from './prom-description-editor';

@Component({
  imports: [ReactiveFormsModule, PromDescriptionEditor],
  template: `<app-prom-description-editor [formControl]="control" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true });
}

describe('PromDescriptionEditor', () => {
  let fixture: ComponentFixture<Host>;
  let element: HTMLElement;
  let control: FormControl<string>;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Tiptap is fetched with import(), so the editor appears a few ticks after the first render. */
  async function open(value: string, options: { disabled?: boolean } = {}): Promise<void> {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    element = fixture.nativeElement as HTMLElement;
    control = fixture.componentInstance.control;
    control.setValue(value);
    if (options.disabled === true) {
      control.disable();
    }
    fixture.detectChanges();
    for (let attempt = 0; attempt < 50 && visual() === null; attempt += 1) {
      await settle();
    }
    if (visual() === null) {
      throw new Error('the editor never loaded');
    }
    await settle();
  }

  function visual(): HTMLElement | null {
    return element.querySelector<HTMLElement>('.ProseMirror');
  }

  function htmlArea(): HTMLTextAreaElement | null {
    return element.querySelector<HTMLTextAreaElement>('textarea');
  }

  function cleanupButton(): HTMLButtonElement {
    const button = element.querySelector<HTMLButtonElement>('button[aria-label="Почистити html"]');
    if (button === null) {
      throw new Error('no cleanup button');
    }
    return button;
  }

  function tool(id: string): HTMLButtonElement {
    const button = element.querySelector<HTMLButtonElement>(`[data-action="${id}"]`);
    if (button === null) {
      throw new Error(`no toolbar button ${id}`);
    }
    return button;
  }

  async function switchTo(label: 'Перегляд' | 'HTML'): Promise<void> {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    await (await loader.getHarness(MatButtonToggleHarness.with({ text: label }))).check();
    await settle();
  }

  function typeHtml(html: string): void {
    const area = htmlArea();
    if (area === null) {
      throw new Error('not in HTML mode');
    }
    area.value = html;
    area.dispatchEvent(new Event('input'));
  }

  /**
   * Selects the first word, as a double click would. ProseMirror reads the DOM selection only
   * while it has focus, so the editor is focused first.
   */
  function selectFirstWord(): void {
    visual()?.focus();
    const text = visual()?.querySelector('p')?.firstChild;
    if (text === null || text === undefined) {
      throw new Error('no text to select');
    }
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, (text.textContent ?? '').indexOf(' '));
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  }

  it('shows the stored HTML formatted and leaves the form untouched', async () => {
    await open('<p><strong>Стан</strong> ідеальний</p><ul><li>Пункт</li></ul>');

    expect(visual()?.querySelector('strong')?.textContent).toBe('Стан');
    expect(visual()?.querySelector('ul li')?.textContent).toBe('Пункт');
    expect(control.dirty).toBe(false);
    expect(control.value).toBe('<p><strong>Стан</strong> ідеальний</p><ul><li>Пункт</li></ul>');
  });

  it('wraps the selected word in <strong> and shows it in HTML mode (AC-47)', async () => {
    await open('<p>Миша бездротова</p>');

    selectFirstWord();
    await settle();
    tool('bold').click();
    await settle();

    expect(control.value).toBe('<p><strong>Миша</strong> бездротова</p>');
    expect(control.dirty).toBe(true);

    await switchTo('HTML');
    expect(htmlArea()?.value).toBe('<p><strong>Миша</strong> бездротова</p>');
  });

  it('shows a list typed in HTML mode as a list, and the form as changed (AC-47)', async () => {
    await open('<p>Опис</p>');

    await switchTo('HTML');
    typeHtml('<p>Опис</p><ul><li>Пункт</li></ul>');
    await settle();
    await switchTo('Перегляд');

    expect(visual()?.querySelector('ul li')?.textContent).toBe('Пункт');
    expect(control.value).toBe('<p>Опис</p><ul><li>Пункт</li></ul>');
    expect(control.dirty).toBe(true);
  });

  it('keeps an edit across both mode switches', async () => {
    await open('<p>Опис</p>');

    await switchTo('HTML');
    typeHtml('<p>Новий опис</p>');
    await settle();
    await switchTo('Перегляд');
    await switchTo('HTML');

    expect(htmlArea()?.value).toBe('<p>Новий опис</p>');
  });

  it('follows a value written after it has loaded, without marking the form changed', async () => {
    await open('');

    control.setValue('<p>Відповідь сервера</p>');
    await settle();

    expect(visual()?.textContent).toBe('Відповідь сервера');
    expect(control.dirty).toBe(false);
  });

  it('turns an emptied editor into an empty string rather than <p></p>', async () => {
    await open('');
    await switchTo('HTML');
    typeHtml('<p>Опис</p>');
    await settle();
    await switchTo('Перегляд');

    tool('undo').click();
    await settle();

    expect(visual()?.textContent).toBe('');
    expect(control.value).toBe('');
  });

  describe('the "Почистити html" button', () => {
    const PASTED = '<div><span style="color:red">Червоний</span> колір</div><p>&nbsp;</p>';

    it('replaces the description with its cleaned version and marks the form changed (AC-48)', async () => {
      await open(PASTED);

      cleanupButton().click();
      await settle();

      expect(control.value).toBe('Червоний колір');
      expect(control.dirty).toBe(true);
      expect(visual()?.textContent).toBe('Червоний колір');
      expect(visual()?.querySelector('span, div')).toBeNull();
    });

    it('cleans the description in the HTML mode as well (AC-48)', async () => {
      await open('<p>Опис</p>');
      await switchTo('HTML');
      typeHtml(PASTED);
      await settle();

      cleanupButton().click();
      await settle();

      expect(control.value).toBe('Червоний колір');
      expect(htmlArea()?.value).toBe('Червоний колір');
    });

    it('leaves a clean description as it is and the form untouched (AC-48)', async () => {
      const clean = '<p><strong>Стан</strong> ідеальний</p><ul><li>Пункт</li></ul>';
      await open(clean);

      cleanupButton().click();
      await settle();

      expect(control.value).toBe(clean);
      expect(control.dirty).toBe(false);
    });

    it('shows the cleaning icon with a tooltip and an aria-label of the same text (AC-48)', async () => {
      await open('<p>Опис</p>');

      expect(cleanupButton().querySelector('mat-icon')?.textContent.trim()).toBe(
        'cleaning_services',
      );
      const tooltip = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatTooltipHarness.with({ selector: 'button[aria-label="Почистити html"]' }),
      );
      await tooltip.show();
      expect(await tooltip.getTooltipText()).toBe('Почистити html');
    });

    it('is unavailable in a disabled form (AC-48)', async () => {
      await open(PASTED, { disabled: true });

      expect(cleanupButton().disabled).toBe(true);
    });
  });

  describe('in a disabled form (AC-20)', () => {
    it('cannot be edited in the visual mode', async () => {
      await open('<p>Опис</p>', { disabled: true });

      expect(visual()?.getAttribute('contenteditable')).toBe('false');
      expect(tool('bold').disabled).toBe(true);
      const loader = TestbedHarnessEnvironment.loader(fixture);
      const html = await loader.getHarness(MatButtonToggleHarness.with({ text: 'HTML' }));
      expect(await html.isDisabled()).toBe(true);
    });

    it('cannot be edited in the HTML mode either', async () => {
      await open('<p>Опис</p>');
      await switchTo('HTML');

      control.disable();
      await settle();

      expect(htmlArea()?.disabled).toBe(true);
      expect(visual()?.getAttribute('contenteditable')).toBe('false');
    });

    it('becomes editable again once the form is enabled', async () => {
      await open('<p>Опис</p>', { disabled: true });

      control.enable();
      await settle();

      expect(visual()?.getAttribute('contenteditable')).toBe('true');
      expect(tool('bold').disabled).toBe(false);
    });
  });
});
