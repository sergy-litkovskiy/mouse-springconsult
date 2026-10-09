import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Clipboard } from '@angular/cdk/clipboard';
import { TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  MatChipGridHarness,
  MatChipInputHarness,
  type MatChipRowHarness,
} from '@angular/material/chips/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { firstValueFrom, type Observable, Subject } from 'rxjs';
import type { PreparationRunDto } from '@contracts/ai.contract';
import type { ApiError } from '@contracts/error.contract';
import type {
  FieldSuggestion,
  Product,
  ProductCard,
  ProductCardRead,
  ProductImage,
  ProductUpdateResponse,
} from '@contracts/products.contract';
import { ConfirmDialog } from '../../confirm-dialog';
import { PreparationRunPoller } from '../preparation-run-poller';
import { ProductForm, type ProductFormData } from './product-form';

const CARD_ID = '11111111-1111-4111-8111-111111111111';

const FRAME: ProductImage = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  r2Key: `products/${CARD_ID}/front.jpg`,
  url: `https://r2.example.com/products/${CARD_ID}/front.jpg`,
  position: 0,
  isMain: true,
};

/** A card the way `POST /products` with `{}` leaves it, plus one frame. */
const EMPTY_WITH_FRAME: ProductCard = {
  id: CARD_ID,
  titleProm: '',
  descriptionProm: '',
  titleOlx: '',
  descriptionOlx: '',
  price: '0.00',
  seoKeywords: [],
  category: '',
  publishedProm: false,
  publishedOlx: false,
  condition: 'used',
  images: [FRAME],
  isReady: false,
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:00.000Z',
};

const PUBLISHED_ON_PROM: ProductCard = {
  ...EMPTY_WITH_FRAME,
  titleProm: 'Миша Logitech MX Master 3',
  titleOlx: 'Logitech MX Master 3 бездротова',
  descriptionProm: 'Бездротова миша у відмінному стані.',
  descriptionOlx: 'Продам мишу, повний комплект.',
  price: '2499.00',
  seoKeywords: ['миша', 'logitech'],
  category: 'Периферія',
  publishedProm: true,
  isReady: true,
};

const WITHOUT_FRAMES: ProductCard = { ...EMPTY_WITH_FRAME, images: [] };

const WITHOUT_OLX_DESCRIPTION_AND_PRICE: ProductCard = {
  ...PUBLISHED_ON_PROM,
  descriptionOlx: '',
  price: '0.00',
  isReady: false,
};

type DialogRefDouble = {
  close: ReturnType<typeof vi.fn>;
  disableClose: boolean | undefined;
  keydownEvents: () => Observable<KeyboardEvent>;
  backdropClick: () => Observable<MouseEvent>;
};

function answer(card: ProductCard, discardedKeywordsCount = 0): ProductUpdateResponse {
  return { ...card, discardedKeywordsCount };
}

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let close: ReturnType<typeof vi.fn>;
  let dialogRef: DialogRefDouble;
  let keydown: Subject<KeyboardEvent>;
  let backdrop: Subject<MouseEvent>;

  /** What the catalogue's dialog hands the form: Esc and a click past it arrive as events. */
  function dialogRefDouble(): DialogRefDouble {
    close = vi.fn();
    keydown = new Subject<KeyboardEvent>();
    backdrop = new Subject<MouseEvent>();
    dialogRef = {
      close,
      disableClose: false,
      keydownEvents: () => keydown.asObservable(),
      backdropClick: () => backdrop.asObservable(),
    };
    return dialogRef;
  }

  /**
   * The dialog is handed an identifier and reads the card itself, so a test that opens an existing
   * card answers that read before anything else can happen.
   */
  function open(
    product: ProductCard | null,
    options: { readAfterFirstRender?: boolean } = {},
  ): void {
    const data: ProductFormData = { productId: product?.id ?? null };
    TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefDouble() },
      ],
    });
    fixture = TestBed.createComponent(ProductForm);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    if (options.readAfterFirstRender === true) {
      fixture.detectChanges();
    }
    if (product !== null) {
      const read = http.expectOne(`/api/products/${product.id}`);
      expect(read.request.method).toBe('GET');
      read.flush(asRead(product));
    }
  }

  /** The four fields a read carries and a row of the list does not. */
  function asRead(
    card: ProductCard,
    overrides: { estimatedCostUsd?: string | null } = {},
  ): ProductCardRead {
    return {
      ...card,
      latestSuggestions: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCostUsd:
        'estimatedCostUsd' in overrides ? (overrides.estimatedCostUsd ?? null) : '0.0000',
    };
  }

  /**
   * Saving is asynchronous, so one whenStable() is not enough: the microtask queue has to drain
   * before the DOM shows the result.
   */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function field(name: string): HTMLInputElement | HTMLTextAreaElement {
    const found = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[formcontrolname="${name}"]`,
    );
    if (found === null) {
      throw new Error(`no field named ${name}`);
    }
    return found;
  }

  /** Filled through the DOM, not through the instance: the test sees what the user sees. */
  function type(name: string, value: string): void {
    const target = field(name);
    target.value = value;
    target.dispatchEvent(new Event('input'));
  }

  function saveButton(): HTMLButtonElement {
    const button = [...element.ownerDocument.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent.trim() === 'Зберегти',
    );
    if (button === undefined) {
      throw new Error('no save button');
    }
    return button;
  }

  function submit(): void {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
  }

  /**
   * The Prom description is an HTML editor (ADR 0016), not a textarea: the test writes the way an
   * admin pasting markup would, through its HTML mode.
   */
  async function typePromDescription(html: string): Promise<void> {
    promHtmlMode().click();
    await settle();
    const area = element.querySelector<HTMLTextAreaElement>('app-prom-description-editor textarea');
    if (area === null) {
      throw new Error('the Prom description editor has no HTML mode');
    }
    area.value = html;
    area.dispatchEvent(new Event('input'));
  }

  function promHtmlMode(): HTMLButtonElement {
    const button = element.querySelector<HTMLButtonElement>(
      'app-prom-description-editor [data-action="html-mode"]',
    );
    if (button === null) {
      throw new Error('the Prom description editor has no HTML button');
    }
    return button;
  }

  async function keywordGrid(): Promise<MatChipGridHarness> {
    return TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipGridHarness);
  }

  async function keywords(): Promise<string[]> {
    const rows = await (await keywordGrid()).getRows();
    return Promise.all(rows.map((row) => row.getText()));
  }

  function keywordInput(): HTMLInputElement {
    const found = element.querySelector<HTMLInputElement>('.mat-mdc-chip-input');
    if (found === null) {
      throw new Error('the keywords have no chip input');
    }
    return found;
  }

  /**
   * The comma goes in by hand: the harness has no key for it and types a character with the code
   * of the character itself, never the 188 a browser reports.
   */
  async function addKeyword(text: string, separator: 'Enter' | ',' = 'Enter'): Promise<void> {
    const input = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipInputHarness);
    await input.setValue(text);
    if (separator === 'Enter') {
      await input.sendSeparatorKey(TestKey.ENTER);
    } else {
      keywordInput().dispatchEvent(
        new KeyboardEvent('keydown', { key: ',', keyCode: 188, bubbles: true, cancelable: true }),
      );
    }
    await settle();
  }

  /**
   * jsdom has no clipboard, so the event carries the text itself. A field that does not take the
   * paste gets the text the way a browser would insert it, and Enter ends it.
   */
  async function pasteKeywords(text: string): Promise<void> {
    const input = keywordInput();
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => text } });
    input.dispatchEvent(paste);
    if (!paste.defaultPrevented) {
      input.value += text;
      input.dispatchEvent(new Event('input'));
    }
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }),
    );
    await settle();
  }

  async function keywordRow(index: number): Promise<MatChipRowHarness> {
    const row = (await (await keywordGrid()).getRows())[index];
    if (row === undefined) {
      throw new Error(`no keyword chip #${String(index)}`);
    }
    return row;
  }

  async function editKeyword(index: number, text: string): Promise<void> {
    const row = await keywordRow(index);
    await row.startEditing();
    await settle();
    await (await row.getEditInput()).setValue(text);
    await row.finishEditing();
    await settle();
  }

  async function removeKeyword(index: number): Promise<void> {
    await (await (await keywordRow(index)).getRemoveButton()).click();
    await settle();
  }

  async function toggle(label: string): Promise<MatSlideToggleHarness> {
    const loader = TestbedHarnessEnvironment.loader(fixture);
    return loader.getHarness(MatSlideToggleHarness.with({ label }));
  }

  async function readinessHint(): Promise<string> {
    const tooltip = await TestbedHarnessEnvironment.loader(fixture).getHarnessOrNull(
      MatTooltipHarness.with({ selector: '[data-testid="readiness"]' }),
    );
    expect(tooltip, 'the readiness badge carries no tooltip').not.toBeNull();
    if (tooltip === null) {
      return '';
    }
    await tooltip.show();
    const text = await tooltip.getTooltipText();
    await tooltip.hide();
    return text;
  }

  /** The snack bar lives in the overlay, outside the dialog's own element. */
  function successNotice(): Element | null {
    return document.querySelector('.snack-bar--success');
  }

  function actionsAlert(): string {
    return element.querySelector('mat-dialog-actions [role="alert"]')?.textContent.trim() ?? '';
  }

  function readiness(): string {
    return element.querySelector('[data-testid="readiness"]')?.textContent ?? '';
  }

  afterEach(() => {
    http.verify();
  });

  describe('without a single frame', () => {
    it('keeps every field and the save button unavailable', async () => {
      open(WITHOUT_FRAMES);
      await settle();

      for (const name of ['titleProm', 'titleOlx', 'descriptionOlx', 'price', 'category']) {
        expect(field(name).disabled, name).toBe(true);
      }
      expect(promHtmlMode().disabled).toBe(true);
      expect(await (await toggle('Опубліковано на Prom')).isDisabled()).toBe(true);
      expect(await (await toggle('Опубліковано на OLX')).isDisabled()).toBe(true);
      expect(saveButton().disabled).toBe(true);
      expect(element.textContent).toContain('Спершу додайте хоча б одне фото');
    });

    it('opens the fields as soon as the first frame arrives', async () => {
      open(WITHOUT_FRAMES);
      await settle();

      fixture.componentInstance.imagesChanged([FRAME]);
      await settle();

      expect(field('titleProm').disabled).toBe(false);
      expect(field('price').disabled).toBe(false);
      expect(await (await toggle('Опубліковано на OLX')).isDisabled()).toBe(false);
      expect(saveButton().disabled).toBe(false);
      expect(element.textContent).not.toContain('Спершу додайте хоча б одне фото');
    });
  });

  describe('a new card', () => {
    it('is created empty the first time a frame needs a card to go into', async () => {
      open(null);
      await settle();

      const created = firstValueFrom(fixture.componentInstance.ensureProduct());
      const request = http.expectOne('/api/products');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      const product: Product = { ...WITHOUT_FRAMES };
      request.flush(product);

      expect(await created).toBe(CARD_ID);
    });

    it('is not created twice', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      expect(await firstValueFrom(fixture.componentInstance.ensureProduct())).toBe(CARD_ID);
      http.expectNone('/api/products');
    });
  });

  describe('the card id under the title', () => {
    const COPY_LABEL = 'Скопіювати ID товару';

    function idLine(): HTMLElement | null {
      return element.querySelector<HTMLElement>('[data-testid="product-id"]');
    }

    function copyButton(): HTMLButtonElement | null {
      return element.querySelector<HTMLButtonElement>(`button[aria-label="${COPY_LABEL}"]`);
    }

    /** jsdom has no clipboard to read back, so the copy itself is what the test watches. */
    function watchClipboard() {
      return vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    }

    it('shows the id of an existing card right under the title, before the gallery', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      const line = idLine();
      expect(line, 'no id line').not.toBeNull();
      expect(line?.textContent).toContain(CARD_ID);
      const title = element.querySelector('h2');
      const gallery = element.querySelector('app-product-gallery');
      if (line === null || title === null || gallery === null) {
        return;
      }
      expect(title.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(line.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('copies the card id with one click and confirms it with «ID скопійовано»', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();
      const copy = watchClipboard();

      copyButton()?.click();
      await settle();

      expect(copy).toHaveBeenCalledTimes(1);
      expect(copy).toHaveBeenCalledWith(CARD_ID);
      expect(document.querySelector('.cdk-overlay-container')?.textContent).toContain(
        'ID скопійовано',
      );
    });

    it('shows no id line for a new card until the first frame has created it', async () => {
      open(null);
      await settle();

      expect(idLine()).toBeNull();
      expect(copyButton()).toBeNull();

      const created = firstValueFrom(fixture.componentInstance.ensureProduct());
      http.expectOne('/api/products').flush({ ...WITHOUT_FRAMES });
      await created;
      fixture.componentInstance.imagesChanged([FRAME]);
      await settle();

      expect(idLine(), 'no id line once the card exists').not.toBeNull();
      expect(idLine()?.textContent).toContain(CARD_ID);
      const copy = watchClipboard();
      copyButton()?.click();
      await settle();
      expect(copy).toHaveBeenCalledWith(CARD_ID);
    });

    it('labels the copy button «Скопіювати ID товару» and shows the same tooltip', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      expect(copyButton(), 'no copy button with the aria-label').not.toBeNull();
      const tooltip = await TestbedHarnessEnvironment.loader(fixture).getHarnessOrNull(
        MatTooltipHarness.with({ selector: `button[aria-label="${COPY_LABEL}"]` }),
      );
      expect(tooltip, 'the copy button carries no tooltip').not.toBeNull();
      if (tooltip === null) {
        return;
      }
      await tooltip.show();
      expect(await tooltip.getTooltipText()).toBe(COPY_LABEL);
      await tooltip.hide();
    });
  });

  it('saves a hand-written card with the same PATCH a suggestion uses', async () => {
    open(EMPTY_WITH_FRAME);
    await settle();

    type('titleProm', 'Миша Logitech MX Master 3');
    type('titleOlx', 'Logitech MX Master 3 бездротова');
    await typePromDescription('Бездротова миша у відмінному стані.');
    type('descriptionOlx', 'Продам мишу, повний комплект.');
    await addKeyword('миша');
    await addKeyword('logitech');
    type('price', '2499.00');
    type('category', 'Периферія');
    await settle();
    submit();
    await settle();

    const request = http.expectOne(`/api/products/${CARD_ID}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      titleProm: 'Миша Logitech MX Master 3',
      titleOlx: 'Logitech MX Master 3 бездротова',
      descriptionProm: 'Бездротова миша у відмінному стані.',
      descriptionOlx: 'Продам мишу, повний комплект.',
      seoKeywords: ['миша', 'logitech'],
      price: '2499.00',
      category: 'Периферія',
      condition: 'used',
      publishedProm: false,
      publishedOlx: false,
    });
    request.flush(answer({ ...PUBLISHED_ON_PROM, publishedProm: false }));
    await settle();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows the stored Prom description and saves it unchanged when the card arrives before its editor', async () => {
    const stored: ProductCard = {
      ...PUBLISHED_ON_PROM,
      descriptionProm: '<p><strong>Стан</strong> ідеальний</p>',
    };
    open(stored, { readAfterFirstRender: true });
    const visual = (): HTMLElement | null =>
      element.querySelector<HTMLElement>('app-prom-description-editor .ProseMirror');
    // Bounded by time, not ticks: under load a cold import() of Tiptap outlasts 50 ticks (~0.5 s).
    const deadline = Date.now() + 3000;
    while (visual() === null && Date.now() < deadline) {
      await settle();
    }
    await settle();

    expect(visual()?.textContent).toBe('Стан ідеальний');
    expect(visual()?.getAttribute('contenteditable')).toBe('true');

    submit();
    await settle();

    const request = http.expectOne(`/api/products/${CARD_ID}`);
    expect(request.request.method).toBe('PATCH');
    expect((request.request.body as Record<string, unknown>)['descriptionProm']).toBe(
      stored.descriptionProm,
    );
    request.flush(answer(stored));
    await settle();
  });

  it('leaves blank titles and category out, since a PATCH refuses them', async () => {
    open(EMPTY_WITH_FRAME);
    await settle();

    await typePromDescription('Опис');
    await settle();
    submit();
    await settle();

    const request = http.expectOne(`/api/products/${CARD_ID}`);
    const body = request.request.body as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('titleProm');
    expect(Object.keys(body)).not.toContain('titleOlx');
    expect(Object.keys(body)).not.toContain('category');
    expect(body['price']).toBe('0.00');
    request.flush(answer(EMPTY_WITH_FRAME));
    await settle();
  });

  describe('the price', () => {
    it('explains the format, keeps what was typed and sends nothing', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      type('price', '2499.999');
      field('price').dispatchEvent(new Event('blur'));
      await settle();

      expect(element.textContent).toContain('Ціна виглядає як 2499, 2499.00 або 2499,00.');
      expect(field('price').value).toBe('2499.999');
      expect(saveButton().disabled).toBe(true);
      submit();
      await settle();
      http.expectNone(`/api/products/${CARD_ID}`);
    });

    it('saves a price typed with a decimal comma with a dot', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      type('price', '235,50');
      await settle();
      submit();
      await settle();

      const request = http.expectOne(`/api/products/${CARD_ID}`);
      expect(request.request.method).toBe('PATCH');
      expect((request.request.body as Record<string, unknown>)['price']).toBe('235.50');
      request.flush(answer({ ...PUBLISHED_ON_PROM, price: '235.50' }));
      await settle();

      expect(close).toHaveBeenCalledWith(true);
    });

    for (const invalid of ['1,000.50', '2,5,0', '235,505']) {
      it(`explains the format for ${invalid} and sends nothing`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();

        type('price', invalid);
        field('price').dispatchEvent(new Event('blur'));
        await settle();

        expect(element.textContent).toContain('Ціна виглядає як 2499, 2499.00 або 2499,00.');
        expect(field('price').value).toBe(invalid);
        submit();
        await settle();
        http.expectNone(`/api/products/${CARD_ID}`);
      });
    }

    it('keeps what was typed when the server refuses it', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      type('price', '3100');
      type('descriptionOlx', 'Новий опис');
      await settle();
      submit();
      await settle();

      const refusal: ApiError = {
        error: { code: 'validation_failed', message: 'Request body is invalid' },
      };
      http
        .expectOne(`/api/products/${CARD_ID}`)
        .flush(refusal, { status: 400, statusText: 'Bad Request' });
      await settle();

      expect(element.textContent).toContain('Сервер не прийняв значення');
      expect(field('price').value).toBe('3100');
      expect(field('descriptionOlx').value).toBe('Новий опис');
    });
  });

  describe('the two marketplace marks', () => {
    const combinations = [
      { flip: 'Опубліковано на OLX', expected: { publishedProm: true, publishedOlx: true } },
      { flip: 'Опубліковано на Prom', expected: { publishedProm: false, publishedOlx: false } },
    ];

    for (const { flip, expected } of combinations) {
      it(`changes only one mark when «${flip}» is switched`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();

        await (await toggle(flip)).toggle();
        await settle();
        submit();
        await settle();

        const request = http.expectOne(`/api/products/${CARD_ID}`);
        const body = request.request.body as Record<string, unknown>;
        expect({
          publishedProm: body['publishedProm'],
          publishedOlx: body['publishedOlx'],
        }).toEqual(expected);
        request.flush(answer({ ...PUBLISHED_ON_PROM, ...expected }));
        await settle();
      });
    }
  });

  it('reports the keywords past the ceiling that the server threw away in the notice', async () => {
    open(PUBLISHED_ON_PROM);
    await settle();

    type('seoKeywords', 'миша, logitech, бездротова');
    await settle();
    submit();
    await settle();

    http.expectOne(`/api/products/${CARD_ID}`).flush(answer(PUBLISHED_ON_PROM, 2));
    await settle();

    expect(close).toHaveBeenCalledWith(true);
    expect(successNotice()?.textContent).toContain(
      'Картку збережено. Понад ліміт відкинуто ключових слів: 2.',
    );
  });

  describe('a successful save', () => {
    async function saveAccepted(): Promise<void> {
      open(PUBLISHED_ON_PROM);
      await settle();

      type('descriptionOlx', 'Новий опис');
      await settle();
      submit();
      await settle();

      http.expectOne(`/api/products/${CARD_ID}`).flush(answer(PUBLISHED_ON_PROM));
      await settle();
    }

    it('closes the dialog with true so the catalogue re-reads its page', async () => {
      await saveAccepted();

      expect(close).toHaveBeenCalledWith(true);
    });

    it('confirms the save with a green notice', async () => {
      await saveAccepted();

      const notice = successNotice();
      expect(notice, 'no success notice').not.toBeNull();
      expect(notice?.textContent).toContain('Картку збережено');
      expect(notice?.textContent).not.toContain('Понад ліміт');
    });

    it('lets the notice go away by itself within a few seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        await saveAccepted();
        expect(successNotice(), 'no success notice').not.toBeNull();

        await vi.advanceTimersByTimeAsync(10_000);
        await settle();

        expect(successNotice()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('a failed save', () => {
    const failures: readonly {
      readonly name: string;
      readonly fail: (request: TestRequest) => void;
      readonly message: string;
    }[] = [
      {
        name: 'a known code',
        fail: (request) => {
          const body: ApiError = {
            error: { code: 'invalid_price', message: 'Price has an invalid format' },
          };
          request.flush(body, { status: 400, statusText: 'Bad Request' });
        },
        message: 'Ціна виглядає як 2499, 2499.00 або 2499,00.',
      },
      {
        name: 'a missing card',
        fail: (request) => {
          const body: ApiError = {
            error: { code: 'product_not_found', message: 'Product not found' },
          };
          request.flush(body, { status: 404, statusText: 'Not Found' });
        },
        message: 'Картку вже видалено.',
      },
      {
        name: 'an unknown code',
        fail: (request) => {
          const body: ApiError = {
            error: { code: 'something_new', message: 'Something went wrong' },
          };
          request.flush(body, { status: 500, statusText: 'Internal Server Error' });
        },
        message: 'Не вдалося зберегти картку. Спробуйте ще раз.',
      },
      {
        name: 'no network',
        fail: (request) => {
          request.error(new ProgressEvent('error'), { status: 0 });
        },
        message: 'Немає зв’язку із сервером. Перевірте мережу і спробуйте ще раз.',
      },
    ];

    for (const { name, fail, message } of failures) {
      it(`keeps the dialog open and shows the message next to the buttons on ${name}`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();

        type('price', '3100');
        type('descriptionOlx', 'Новий опис');
        await settle();
        submit();
        await settle();

        fail(http.expectOne(`/api/products/${CARD_ID}`));
        await settle();

        expect(close).not.toHaveBeenCalled();
        expect(actionsAlert()).toContain(message);
        expect(field('price').value).toBe('3100');
        expect(field('descriptionOlx').value).toBe('Новий опис');
        expect(successNotice()).toBeNull();
      });
    }
  });

  it('shows readiness as a derived mark with nothing to switch it', async () => {
    open(EMPTY_WITH_FRAME);
    await settle();

    expect(element.querySelector('[data-testid="readiness"]')?.textContent).toContain('Неготово');
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const toggles = await loader.getAllHarnesses(MatSlideToggleHarness);
    const labels = await Promise.all(toggles.map((harness) => harness.getLabelText()));
    expect(labels).toEqual(['Опубліковано на Prom', 'Опубліковано на OLX']);
  });

  it('turns the save button off through a signal while a field is invalid', async () => {
    open(PUBLISHED_ON_PROM);
    await settle();
    expect(saveButton().disabled).toBe(false);

    await addKeyword('x'.repeat(61));
    expect(saveButton().disabled).toBe(true);

    await removeKeyword(2);
    expect(saveButton().disabled).toBe(false);
  });

  describe('the keywords as chips', () => {
    it('shows every keyword of the card as a chip of its own', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      expect(await keywords()).toEqual(['миша', 'logitech']);
    });

    it('adds a keyword on Enter and another on a comma, emptying the input each time', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await addKeyword('бездротова');
      expect(keywordInput().value).toBe('');
      await addKeyword('mx master 3', ',');
      expect(keywordInput().value).toBe('');

      expect(await keywords()).toEqual(['миша', 'logitech', 'бездротова', 'mx master 3']);
    });

    it('edits a keyword in place on a double click', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      expect(await (await keywordRow(1)).isEditable()).toBe(true);
      await editKeyword(1, 'logitech mx');

      expect(await keywords()).toEqual(['миша', 'logitech mx']);
    });

    it('removes a keyword with its cross', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await removeKeyword(0);

      expect(await keywords()).toEqual(['logitech']);
    });

    it('saves the keywords as an array in the order shown on screen', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await addKeyword('бездротова');
      await editKeyword(1, 'logitech mx master 3');
      await removeKeyword(0);
      expect(await keywords()).toEqual(['logitech mx master 3', 'бездротова']);
      submit();
      await settle();

      const request = http.expectOne(`/api/products/${CARD_ID}`);
      expect(request.request.method).toBe('PATCH');
      expect((request.request.body as Record<string, unknown>)['seoKeywords']).toEqual([
        'logitech mx master 3',
        'бездротова',
      ]);
      request.flush(answer(PUBLISHED_ON_PROM));
      await settle();
    });

    it('splits a pasted line on commas and adds no blank or repeated keyword', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      await pasteKeywords('миша, миша, , logitech');

      expect(await keywords()).toEqual(['миша', 'logitech']);
      expect(keywordInput().value).toBe('');
    });

    it('adds neither a blank keyword nor one already on the list', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await addKeyword('   ');
      await addKeyword('миша', ',');
      await addKeyword(' logitech ');

      expect(await keywords()).toEqual(['миша', 'logitech']);
    });

    it('drops a keyword edited down to nothing', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await editKeyword(1, '   ');

      expect(await keywords()).toEqual(['миша']);
    });

    it('trims an edited keyword and drops it when it repeats another', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await editKeyword(0, ' мишка ');
      expect(await keywords()).toEqual(['мишка', 'logitech']);
      await editKeyword(1, 'мишка');

      expect(await keywords()).toEqual(['мишка']);
    });

    it('turns the text left in the input into chips when the field is left', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      const input = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatChipInputHarness);
      await input.setValue('бездротова, миша');
      await input.blur();
      await settle();

      expect(await keywords()).toEqual(['миша', 'logitech', 'бездротова']);
      expect(keywordInput().value).toBe('');
    });

    it('shows the length error for a keyword over 60 characters and sends nothing', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await addKeyword('x'.repeat(61));
      keywordInput().dispatchEvent(new Event('blur'));
      await settle();

      expect(element.textContent).toContain('Кожне слово — до 60 символів.');
      expect(saveButton().disabled).toBe(true);
      submit();
      await settle();
      http.expectNone(`/api/products/${CARD_ID}`);
    });

    it('keeps the chips and their input unavailable until the first frame', async () => {
      open(WITHOUT_FRAMES);
      await settle();

      const loader = TestbedHarnessEnvironment.loader(fixture);
      expect(await (await keywordGrid()).isDisabled()).toBe(true);
      expect(await (await loader.getHarness(MatChipInputHarness)).isDisabled()).toBe(true);
    });
  });

  describe('the two titles', () => {
    const TITLES = ['titleProm', 'titleOlx'] as const;
    const LONG_TITLE =
      'Миша Logitech MX Master 3 бездротова, графітова, з зарядним кабелем USB-C, ' +
      'коробкою та приймачем Unifying, у відмінному стані після одного року використання';

    for (const name of TITLES) {
      it(`shows the whole ${name} in a field that grows with the text`, async () => {
        open({ ...PUBLISHED_ON_PROM, [name]: LONG_TITLE });
        await settle();

        const title = field(name);
        expect(title).toBeInstanceOf(HTMLTextAreaElement);
        expect(title.value).toBe(LONG_TITLE);
        const autosize = fixture.debugElement
          .query(By.css(`[formcontrolname="${name}"]`))
          .injector.get(CdkTextareaAutosize, null);
        expect(autosize, `${name} does not grow with its text`).not.toBeNull();
        expect(autosize?.minRows).toBe(1);
      });

      it(`turns a pasted line break in ${name} into a space and saves one line`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();

        type(name, 'a\nb');
        await settle();

        expect(field(name).value).toBe('a b');
        submit();
        await settle();
        const request = http.expectOne(`/api/products/${CARD_ID}`);
        expect((request.request.body as Record<string, unknown>)[name]).toBe('a b');
        request.flush(answer(PUBLISHED_ON_PROM));
        await settle();
      });

      it(`adds nothing to ${name} on Enter`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();
        const before = field(name).value;

        const enter = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        });
        field(name).dispatchEvent(enter);
        await settle();

        // jsdom never inserts the line break itself, so the prevented default is what a browser
        // would have turned into one.
        expect(enter.defaultPrevented).toBe(true);
        expect(field(name).value).toBe(before);
      });
    }

    it('still refuses a title of 201 characters in the multi-line field', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      expect(field('titleOlx')).toBeInstanceOf(HTMLTextAreaElement);
      type('titleOlx', 'x'.repeat(201));
      field('titleOlx').dispatchEvent(new Event('blur'));
      await settle();

      expect(element.textContent).toContain('Довше за 200 символів.');
      expect(saveButton().disabled).toBe(true);
    });
  });

  describe('the gaps behind the readiness badge', () => {
    it('names what the open card lacks in the words and order of the catalogue', async () => {
      open(WITHOUT_OLX_DESCRIPTION_AND_PRICE);
      await settle();

      expect(readiness()).toContain('Неготово');
      expect(await readinessHint()).toBe('Бракує: опис OLX, ціна');
    });

    // The dialog closes on save, so the fresh readiness is the catalogue's to show.
    it('leaves the readiness of a card that came back ready to the catalogue', async () => {
      open(WITHOUT_OLX_DESCRIPTION_AND_PRICE);
      await settle();

      type('descriptionOlx', 'Продам мишу, повний комплект.');
      type('price', '2499.00');
      await settle();
      submit();
      await settle();

      http.expectOne(`/api/products/${CARD_ID}`).flush(answer(PUBLISHED_ON_PROM));
      await settle();

      expect(close).toHaveBeenCalledWith(true);
    });

    it('lists the gaps of the last server answer, not of unsaved fields', async () => {
      open(WITHOUT_OLX_DESCRIPTION_AND_PRICE);
      await settle();

      type('descriptionOlx', 'Продам мишу, повний комплект.');
      await settle();
      expect(await readinessHint()).toBe('Бракує: опис OLX, ціна');

      submit();
      await settle();
      const refusal: ApiError = {
        error: { code: 'validation_failed', message: 'Request body is invalid' },
      };
      http
        .expectOne(`/api/products/${CARD_ID}`)
        .flush(refusal, { status: 400, statusText: 'Bad Request' });
      await settle();

      expect(close).not.toHaveBeenCalled();
      expect(readiness()).toContain('Неготово');
      expect(await readinessHint()).toBe('Бракує: опис OLX, ціна');
    });
  });
  describe('closing a card with unsaved edits', () => {
    const SECOND_FRAME: ProductImage = {
      ...FRAME,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      r2Key: `products/${CARD_ID}/back.jpg`,
      url: `https://r2.example.com/products/${CARD_ID}/back.jpg`,
      position: 1,
      isMain: false,
    };

    const TWO_FRAMES: ProductCard = { ...PUBLISHED_ON_PROM, images: [FRAME, SECOND_FRAME] };

    const WAYS_OUT: readonly (readonly [string, () => void])[] = [
      ['Esc', pressEscape],
      [
        'a click past the dialog',
        () => {
          backdrop.next(new MouseEvent('click'));
        },
      ],
      [
        '«Скасувати»',
        () => {
          cancelButton().click();
        },
      ],
    ];

    const EDITS: readonly (readonly [string, () => Promise<void>])[] = [
      ['the Prom title', () => typeIn('titleProm', 'Миша Logitech MX Master 3S')],
      ['the OLX title', () => typeIn('titleOlx', 'Logitech MX Master 3S')],
      ['the Prom description', () => typePromDescription('<p>Інший опис.</p>')],
      ['the OLX description', () => typeIn('descriptionOlx', 'Продам мишу без коробки.')],
      ['the keywords', () => removeKeyword(0)],
      ['the price', () => typeIn('price', '2600.00')],
      ['the category', () => typeIn('category', 'Миші')],
      ['the condition', () => pickCondition('Новий')],
      ['the Prom mark', () => flip('Опубліковано на Prom')],
      ['the OLX mark', () => flip('Опубліковано на OLX')],
    ];

    beforeEach(() => {
      // The question closes only once its exit animation is over; settle() does not wait it out.
      TestBed.configureTestingModule({
        providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
      });
    });

    afterEach(async () => {
      TestBed.inject(MatDialog).closeAll();
      await settle();
    });

    function typeIn(name: string, value: string): Promise<void> {
      type(name, value);
      return settle();
    }

    function pressEscape(): void {
      keydown.next(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
    }

    function cancelButton(): HTMLButtonElement {
      const button = [
        ...element.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'),
      ].find((candidate) => candidate.textContent.trim() === 'Скасувати');
      if (button === undefined) {
        throw new Error('no cancel button');
      }
      return button;
    }

    async function pickCondition(label: string): Promise<void> {
      const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness.with({ selector: '[formcontrolname="condition"]' }),
      );
      await select.clickOptions({ text: label });
      await settle();
    }

    async function flip(label: string): Promise<void> {
      await (await toggle(label)).toggle();
      await settle();
    }

    function dialogs() {
      return TestBed.inject(MatDialog).openDialogs;
    }

    /** The question opens in the overlay on the body, outside the form's own element. */
    function question(): HTMLElement | null {
      return document.querySelector<HTMLElement>('app-confirm-dialog');
    }

    function questionButton(label: string): HTMLButtonElement | undefined {
      const buttons = question()?.querySelectorAll<HTMLButtonElement>('button') ?? [];
      return [...buttons].find((candidate) => candidate.textContent.trim() === label);
    }

    function expectQuestion(): void {
      expect(dialogs().length).toBe(1);
      expect(dialogs()[0]?.componentInstance).toBeInstanceOf(ConfirmDialog);
      expect(question()?.textContent).toContain('Закрити без збереження?');
      expect(question()?.textContent).toContain('Правки в полях картки буде втрачено.');
      expect(questionButton('Закрити без збереження')).toBeDefined();
      expect(questionButton('Скасувати')).toBeDefined();
    }

    async function answerQuestion(label: 'Скасувати' | 'Закрити без збереження'): Promise<void> {
      const button = questionButton(label);
      if (button === undefined) {
        throw new Error(`no question with «${label}» is open`);
      }
      button.click();
      await settle();
      await settle();
    }

    function expectNoPatch(): void {
      http.expectNone((request) => request.method === 'PATCH');
    }

    it('keeps the dialog from closing by itself on Esc or a click past it', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      expect(dialogRef.disableClose).toBe(true);
    });

    for (const [way, leave] of WAYS_OUT) {
      it(`asks «Закрити без збереження?» on ${way} and keeps the edited card open`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();
        type('titleOlx', 'Logitech MX Master 3S');
        await settle();

        leave();
        await settle();

        expect(close).not.toHaveBeenCalled();
        expectQuestion();
        expect(field('titleOlx').value).toBe('Logitech MX Master 3S');
        expectNoPatch();
      });
    }

    for (const [name, edit] of EDITS) {
      it(`asks before discarding an edit of ${name}`, async () => {
        open(PUBLISHED_ON_PROM);
        await settle();
        await edit();
        await settle();

        pressEscape();
        await settle();

        expect(close).not.toHaveBeenCalled();
        expectQuestion();
      });
    }

    it('asks before discarding what was typed into a new card', async () => {
      open(null);
      await settle();
      const created = firstValueFrom(fixture.componentInstance.ensureProduct());
      http.expectOne('/api/products').flush({ ...WITHOUT_FRAMES });
      await created;
      fixture.componentInstance.imagesChanged([FRAME]);
      await settle();
      type('titleProm', 'Миша Logitech MX Master 3');
      await settle();

      pressEscape();
      await settle();

      expect(close).not.toHaveBeenCalled();
      expectQuestion();
    });

    it('goes back to the card with its edits when the question is cancelled', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();
      type('titleOlx', 'Logitech MX Master 3S');
      await settle();
      pressEscape();
      await settle();

      await answerQuestion('Скасувати');

      expect(close).not.toHaveBeenCalled();
      expect(dialogs().length).toBe(0);
      expect(field('titleOlx').value).toBe('Logitech MX Master 3S');
      expectNoPatch();
    });

    it('closes the card without a PATCH once discarding is confirmed', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();
      type('titleOlx', 'Logitech MX Master 3S');
      await settle();
      pressEscape();
      await settle();

      await answerQuestion('Закрити без збереження');

      expect(close).toHaveBeenCalledTimes(1);
      expect(dialogs().length).toBe(0);
      expectNoPatch();
    });

    it('closes at once on Esc, a click past it and «Скасувати» when the card was only opened', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      for (const [way, leave] of WAYS_OUT) {
        const before = close.mock.calls.length;
        leave();
        await settle();

        expect(close.mock.calls.length, way).toBe(before + 1);
        expect(close, way).toHaveBeenLastCalledWith(false);
        expect(dialogs().length, way).toBe(0);
      }
    });

    it('reads the empty price field of an unpriced card as "0.00", not as an edit', async () => {
      open(WITHOUT_OLX_DESCRIPTION_AND_PRICE);
      await settle();
      expect(field('price').value).toBe('');

      pressEscape();
      await settle();

      expect(close).toHaveBeenCalledWith(false);
      expect(dialogs().length).toBe(0);
    });

    it('closes at once after the keywords were only passed through', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();
      keywordInput().dispatchEvent(new Event('focus'));
      keywordInput().dispatchEvent(new Event('blur'));
      await settle();

      pressEscape();
      await settle();

      expect(close).toHaveBeenCalledWith(false);
      expect(dialogs().length).toBe(0);
    });

    it('closes at once when an edited field was typed back to what the card holds', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();
      type('titleOlx', 'Logitech MX Master 3S');
      await settle();
      type('titleOlx', PUBLISHED_ON_PROM.titleOlx);
      await settle();

      pressEscape();
      await settle();

      expect(close).toHaveBeenCalledWith(false);
      expect(dialogs().length).toBe(0);
    });

    for (const [change, card, frames] of [
      ['added', PUBLISHED_ON_PROM, [FRAME, SECOND_FRAME]],
      ['removed', TWO_FRAMES, [FRAME]],
    ] as const) {
      it(`closes at once after a frame was ${change}, telling the catalogue to re-read`, async () => {
        open(card);
        await settle();
        fixture.componentInstance.imagesChanged(frames);
        await settle();

        pressEscape();
        await settle();

        expect(close).toHaveBeenCalledWith(true);
        expect(dialogs().length).toBe(0);
      });
    }

    it('closes a new card at once after its first frame, telling the catalogue to re-read', async () => {
      open(null);
      await settle();
      const created = firstValueFrom(fixture.componentInstance.ensureProduct());
      http.expectOne('/api/products').flush({ ...WITHOUT_FRAMES });
      await created;
      fixture.componentInstance.imagesChanged([FRAME]);
      await settle();

      pressEscape();
      await settle();

      expect(close).toHaveBeenCalledWith(true);
      expect(dialogs().length).toBe(0);
    });
  });

  describe('the preparation panel', () => {
    const RUN_ID = '44444444-4444-4444-8444-444444444444';

    const SUGGESTED_OLX_DESCRIPTION: FieldSuggestion = {
      id: '55555555-5555-4555-8555-555555555555',
      runId: RUN_ID,
      field: 'descriptionOlx',
      value: 'Продам мишу Logitech MX Master 3, повний комплект.',
      createdAt: '2026-09-20T09:00:35.000Z',
    };

    const SUGGESTED_PRICE_RANGE = {
      priceFrom: '2100.00',
      priceTo: '2600.00',
      listings: [{ price: '2100.00', url: 'https://prom.ua/ua/p2100-logitech-mx-master-3.html' }],
    };

    const SUGGESTED_PRICE: FieldSuggestion = {
      ...SUGGESTED_OLX_DESCRIPTION,
      id: '66666666-6666-4666-8666-666666666666',
      field: 'price',
      value: SUGGESTED_PRICE_RANGE,
    };

    /** A card read that carries the latest suggestion of every field, decided or not. */
    function withLatest(card: ProductCard, latest: readonly FieldSuggestion[]): ProductCardRead {
      return { ...asRead(card), latestSuggestions: [...latest] };
    }

    function openWithLatest(card: ProductCard, latest: readonly FieldSuggestion[]): void {
      const data: ProductFormData = { productId: card.id };
      TestBed.configureTestingModule({
        imports: [ProductForm],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: MAT_DIALOG_DATA, useValue: data },
          { provide: MatDialogRef, useValue: dialogRefDouble() },
        ],
      });
      fixture = TestBed.createComponent(ProductForm);
      http = TestBed.inject(HttpTestingController);
      element = fixture.nativeElement as HTMLElement;
      http.expectOne(`/api/products/${card.id}`).flush(withLatest(card, latest));
    }

    function half(field: string): HTMLElement {
      const found = element.querySelector<HTMLElement>(
        `app-suggestion-field[data-field="${field}"]`,
      );
      if (found === null) {
        throw new Error(`no paired half for ${field}`);
      }
      return found;
    }

    function button(field: string, action: 'rewrite' | 'accept'): HTMLButtonElement | null {
      return half(field).querySelector<HTMLButtonElement>(`[data-testid="${action}"]`);
    }

    function suggestionText(field: string): string {
      return (
        half(field).querySelector('[data-testid="suggestion-value"]')?.textContent.trim() ?? ''
      );
    }

    it('keeps «? -> AI» unavailable while the field is empty', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      expect(button('titleOlx', 'rewrite')?.getAttribute('aria-disabled')).toBe('true');

      type('titleOlx', 'Logitech MX Master 3 бездротова');
      await settle();

      expect(button('titleOlx', 'rewrite')?.getAttribute('aria-disabled')).toBeNull();
    });

    it('rewrites the one field from its draft with mode:prompt', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      type('descriptionOlx', 'Продам мишу.');
      await settle();
      button('descriptionOlx', 'rewrite')?.click();
      await settle();

      const request = http.expectOne(`/api/products/${CARD_ID}/preparation-runs`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        scope: 'field',
        field: 'descriptionOlx',
        draftText: 'Продам мишу.',
        mode: 'prompt',
      });
      request.flush(run('running'));
      await settle();

      http.expectOne(`/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`).flush(run('failed'));
      await settle();
      http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(EMPTY_WITH_FRAME));
      await settle();
    });

    it('keeps the price button unavailable until the card has a title', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      type('descriptionOlx', 'Продам мишу, повний комплект.');
      await settle();
      // A description alone does not enable it: the server gates on a title.
      expect(button('price', 'rewrite')?.getAttribute('aria-disabled')).toBe('true');

      type('titleOlx', 'Logitech MX Master 3 бездротова');
      await settle();

      expect(button('price', 'rewrite')?.getAttribute('aria-disabled')).toBeNull();
    });

    it('shows the price range as text and never accepts it for the admin', async () => {
      openWithLatest(EMPTY_WITH_FRAME, [SUGGESTED_PRICE]);
      await settle();

      expect(suggestionText('price')).toBe('від 2100.00 до 2600.00 ₴');
      // No «<- AI» beside the price at all: the admin types the number in by hand.
      expect(button('price', 'accept')).toBeNull();
      expect(field('price').value).toBe('');
    });

    it('shows a suggestion beside the field the admin wrote, not instead of it', async () => {
      openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
      await settle();

      type('descriptionOlx', 'Мій власний текст.');
      await settle();

      expect(field('descriptionOlx').value).toBe('Мій власний текст.');
      expect(suggestionText('descriptionOlx')).toBe(SUGGESTED_OLX_DESCRIPTION.value);
    });

    it('keeps «? -> AI» for the keywords unavailable until there is a chip', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      expect(button('seoKeywords', 'rewrite')?.getAttribute('aria-disabled')).toBe('true');

      await addKeyword('миша');

      expect(button('seoKeywords', 'rewrite')?.getAttribute('aria-disabled')).toBeNull();
    });

    it('rewrites the keywords from their chips joined with commas', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      await addKeyword('бездротова');
      button('seoKeywords', 'rewrite')?.click();
      await settle();

      const request = http.expectOne(`/api/products/${CARD_ID}/preparation-runs`);
      expect(request.request.body).toEqual({
        scope: 'field',
        field: 'seoKeywords',
        draftText: 'миша, logitech, бездротова',
        mode: 'prompt',
      });
      request.flush(run('running'));
      await settle();

      http.expectOne(`/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`).flush(run('failed'));
      await settle();
      http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(PUBLISHED_ON_PROM));
      await settle();
    });

    it('shows the suggestions of a card opened without a run of its own', async () => {
      openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION, SUGGESTED_PRICE]);
      await settle();

      expect(suggestionText('descriptionOlx')).toBe(SUGGESTED_OLX_DESCRIPTION.value);
    });

    describe('the latest suggestion of every field', () => {
      const SUGGESTED_OLX_TITLE: FieldSuggestion = {
        ...SUGGESTED_OLX_DESCRIPTION,
        id: '88888888-8888-4888-8888-888888888888',
        field: 'titleOlx',
        value: 'Logitech MX Master 3 — нова назва від моделі',
        createdAt: '2026-09-21T09:00:35.000Z',
      };

      it('offers the latest suggestion ready to apply', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
        await settle();

        expect(suggestionText('descriptionOlx')).toBe(SUGGESTED_OLX_DESCRIPTION.value);
        expect(button('descriptionOlx', 'accept')?.disabled).toBe(false);
      });

      it('keeps the field edited by hand and offers the new suggestion beside it', async () => {
        openWithLatest({ ...PUBLISHED_ON_PROM, titleOlx: 'Моя власна назва' }, [
          SUGGESTED_OLX_TITLE,
        ]);
        await settle();

        expect(field('titleOlx').value).toBe('Моя власна назва');
        expect(suggestionText('titleOlx')).toBe(SUGGESTED_OLX_TITLE.value);
        expect(button('titleOlx', 'accept')?.disabled).toBe(false);
      });
    });

    describe('«<- AI» copies the suggestion into the form', () => {
      const SUGGESTED_PROM_DESCRIPTION: FieldSuggestion = {
        ...SUGGESTED_OLX_DESCRIPTION,
        id: '99999999-9999-4999-8999-999999999999',
        field: 'descriptionProm',
        value: 'Миша Logitech MX Master 3.\nПовний комплект.\n\nСтан ідеальний.',
      };

      const THIRTY_TWO_KEYWORDS = Array.from(
        { length: 32 },
        (_, at) => `ключове слово ${String(at + 1)}`,
      );

      const SUGGESTED_MANY_KEYWORDS: FieldSuggestion = {
        ...SUGGESTED_OLX_DESCRIPTION,
        id: '77777777-7777-4777-8777-777777777777',
        field: 'seoKeywords',
        value: THIRTY_TWO_KEYWORDS,
      };

      beforeEach(() => {
        // The question closes only once its exit animation is over; settle() does not wait it out.
        TestBed.configureTestingModule({
          providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
        });
      });

      afterEach(async () => {
        TestBed.inject(MatDialog).closeAll();
        await settle();
      });

      /**
       * Soft, and through match() rather than expectNone(): a stray request left open would fail
       * the shared verify() and stop TestBed from resetting for every test after this one.
       */
      async function copy(field: string): Promise<void> {
        button(field, 'accept')?.click();
        await settle();
        const sent = http.match(() => true).map((r) => `${r.request.method} ${r.request.url}`);
        expect.soft(sent, 'the arrow asks the api nothing').toEqual([]);
      }

      async function saved(): Promise<Record<string, unknown>> {
        submit();
        await settle();
        const request = http.expectOne(`/api/products/${CARD_ID}`);
        expect(request.request.method).toBe('PATCH');
        const body = request.request.body as Record<string, unknown>;
        request.flush(answer(PUBLISHED_ON_PROM));
        await settle();
        return body;
      }

      it('puts the OLX description suggestion into the field on the left without a request', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
        await settle();

        await copy('descriptionOlx');
        expect(field('descriptionOlx').value).toBe(SUGGESTED_OLX_DESCRIPTION.value);
        expect(field('titleProm').value).toBe(PUBLISHED_ON_PROM.titleProm);
      });

      it('writes the copied suggestion to the card only on «Зберегти»', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
        await settle();

        await copy('descriptionOlx');

        expect((await saved())['descriptionOlx']).toBe(SUGGESTED_OLX_DESCRIPTION.value);
      });

      it('asks before closing a card whose field took a suggestion, and writes nothing', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
        await settle();

        await copy('descriptionOlx');
        keydown.next(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
        await settle();

        const dialogs = TestBed.inject(MatDialog).openDialogs;
        expect(dialogs.length).toBe(1);
        expect(dialogs[0]?.componentInstance).toBeInstanceOf(ConfirmDialog);
        expect(close).not.toHaveBeenCalled();
        http.expectNone(() => true);
      });

      it('turns the Prom description into a <p> per paragraph and <br> per single break', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_PROM_DESCRIPTION]);
        await settle();

        await copy('descriptionProm');

        expect((await saved())['descriptionProm']).toBe(
          '<p>Миша Logitech MX Master 3.<br>Повний комплект.</p><p>Стан ідеальний.</p>',
        );
      });

      it('escapes the markup in the Prom description suggestion instead of keeping it', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [
          { ...SUGGESTED_PROM_DESCRIPTION, value: 'Кабель <script>alert(1)</script> & чохол.' },
        ]);
        await settle();

        await copy('descriptionProm');

        expect((await saved())['descriptionProm']).toBe(
          '<p>Кабель &lt;script&gt;alert(1)&lt;/script&gt; &amp; чохол.</p>',
        );
      });

      it('puts no more than thirty keywords of a longer suggestion into the chips', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_MANY_KEYWORDS]);
        await settle();

        await copy('seoKeywords');
        expect(await keywords()).toEqual(THIRTY_TWO_KEYWORDS.slice(0, 30));
        expect((await saved())['seoKeywords']).toEqual(THIRTY_TWO_KEYWORDS.slice(0, 30));
      });

      it('leaves every field as it was when a run finishes', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        element.querySelector<HTMLButtonElement>('[data-testid="generate-all"]')?.click();
        await settle();
        http
          .expectOne(`/api/products/${CARD_ID}/preparation-runs`)
          .flush({ ...run('running'), scope: 'texts', errorCode: null });
        await settle();
        http
          .expectOne(`/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`)
          .flush({ ...run('succeeded'), scope: 'texts', errorCode: null });
        await settle();
        // Even a read whose columns came back filled leaves the fields the admin sees alone.
        http.expectOne(`/api/products/${CARD_ID}`).flush(
          withLatest(
            {
              ...EMPTY_WITH_FRAME,
              titleOlx: 'Logitech MX Master 3 бездротова',
              descriptionOlx: SUGGESTED_OLX_DESCRIPTION.value as string,
              seoKeywords: ['миша', 'logitech'],
            },
            [SUGGESTED_OLX_DESCRIPTION],
          ),
        );
        await settle();

        expect(suggestionText('descriptionOlx')).toBe(SUGGESTED_OLX_DESCRIPTION.value);
        expect(field('titleOlx').value).toBe('');
        expect(field('descriptionOlx').value).toBe('');
        expect(await keywords()).toEqual([]);
      });
    });

    describe('AI action buttons', () => {
      function improveButton(field: string): HTMLButtonElement | null {
        return half(field).querySelector<HTMLButtonElement>('[data-testid="improve"]');
      }

      it('sends mode:improve when the auto_fix_high button is clicked', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        type('titleOlx', 'Logitech MX Master 3 бездротова');
        await settle();
        improveButton('titleOlx')?.click();
        await settle();

        const request = http.expectOne(`/api/products/${CARD_ID}/preparation-runs`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
          scope: 'field',
          field: 'titleOlx',
          draftText: 'Logitech MX Master 3 бездротова',
          mode: 'improve',
        });
        request.flush(run('running'));
        await settle();

        http.expectOne(`/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`).flush(run('failed'));
        await settle();
        http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(EMPTY_WITH_FRAME));
        await settle();
      });

      it('sends nothing when a launch button is clicked while the field is empty', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        button('titleOlx', 'rewrite')?.click();
        improveButton('titleOlx')?.click();
        await settle();

        http.expectNone(`/api/products/${CARD_ID}/preparation-runs`);
      });

      it('shows three AI buttons with correct aria-labels', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        const promptBtn = button('titleOlx', 'rewrite');
        const improveBtn = improveButton('titleOlx');
        const acceptBtn = button('titleOlx', 'accept');

        expect(promptBtn?.getAttribute('aria-label')).toBe(
          'Застосувати як промпт: Пропозиція для OLX',
        );
        expect(improveBtn?.getAttribute('aria-label')).toBe(
          'Покращити через AI: Пропозиція для OLX',
        );
        expect(acceptBtn?.getAttribute('aria-label')).toBe(
          'Застосувати для поля ліворуч: Пропозиція для OLX',
        );
      });
    });

    describe('the spinner beside the control that started the run', () => {
      const TEXT_FIELDS = [
        'titleProm',
        'titleOlx',
        'descriptionProm',
        'descriptionOlx',
        'seoKeywords',
      ] as const;
      const RUN_URL = `/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`;
      /** Wider than the poll interval on purpose: what matters is that the next ask happens. */
      const NEXT_POLL_MS = 30_000;

      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      function generateAllButton(): HTMLButtonElement {
        const found = element.querySelector<HTMLButtonElement>('[data-testid="generate-all"]');
        if (found === null) {
          throw new Error('no «Згенерувати все» button');
        }
        return found;
      }

      function launch(field: string, action: 'rewrite' | 'improve'): HTMLButtonElement | null {
        return half(field).querySelector<HTMLButtonElement>(`[data-testid="${action}"]`);
      }

      function spinnerIn(scope: Element): Element | null {
        return scope.querySelector('mat-progress-spinner');
      }

      function notice(): string {
        return element.querySelector('.card-prepare [role="status"]')?.textContent.trim() ?? '';
      }

      async function nextPoll(answer: PreparationRunDto): Promise<void> {
        await vi.advanceTimersByTimeAsync(NEXT_POLL_MS);
        await settle();
        http.expectOne(RUN_URL).flush(answer);
        await settle();
      }

      async function startFieldRun(action: 'rewrite' | 'improve'): Promise<void> {
        launch('descriptionOlx', action)?.click();
        await settle();
        http.expectOne(`/api/products/${CARD_ID}/preparation-runs`).flush(run('running'));
        await settle();
        http.expectOne(RUN_URL).flush(run('running'));
        await settle();
      }

      async function finishTextsRun(card: ProductCard): Promise<void> {
        await nextPoll({ ...run('succeeded'), scope: 'texts' });
        http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(card));
        await settle();
      }

      // Mid-run checks are soft: a hard failure would leave the poll open, and the shared verify()
      // would then fail every test after this one as well.
      it('spins in «Згенерувати все» while a texts run is queued or running, with the field buttons off and still, then gives them back', async () => {
        open(PUBLISHED_ON_PROM);
        await settle();
        type('descriptionOlx', 'Продам мишу.');
        await settle();

        generateAllButton().click();
        await settle();
        http
          .expectOne(`/api/products/${CARD_ID}/preparation-runs`)
          .flush({ ...run('running'), scope: 'texts' });
        await settle();
        http.expectOne(RUN_URL).flush({ ...run('queued'), scope: 'texts' });
        await settle();

        expect.soft(spinnerIn(generateAllButton()), 'spinner while queued').not.toBeNull();
        for (const field of TEXT_FIELDS) {
          expect.soft(spinnerIn(half(field)), `spinner beside ${field}`).toBeNull();
          expect.soft(launch(field, 'rewrite')?.getAttribute('aria-disabled')).toBe('true');
          expect.soft(launch(field, 'improve')?.getAttribute('aria-disabled')).toBe('true');
        }

        await nextPoll({ ...run('running'), scope: 'texts' });
        expect.soft(spinnerIn(generateAllButton()), 'spinner while running').not.toBeNull();

        await finishTextsRun(PUBLISHED_ON_PROM);

        expect(spinnerIn(generateAllButton())).toBeNull();
        expect(generateAllButton().disabled).toBe(false);
        for (const field of TEXT_FIELDS) {
          expect(launch(field, 'rewrite')?.getAttribute('aria-disabled')).toBeNull();
          expect(launch(field, 'improve')?.getAttribute('aria-disabled')).toBeNull();
        }
      });

      for (const [action, name] of [
        ['improve', 'Покращити через AI'],
        ['rewrite', 'Застосувати як промпт'],
      ] as const) {
        it(`replaces both launch buttons of the field with a spinner after «${name}» until the result arrives`, async () => {
          openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
          await settle();
          type('descriptionOlx', 'Продам мишу.');
          await settle();

          await startFieldRun(action);

          const working = half('descriptionOlx');
          expect
            .soft(spinnerIn(working)?.getAttribute('aria-label'), 'spinner beside the field')
            .toBe('Модель готує варіант');
          expect.soft(launch('descriptionOlx', 'rewrite'), '«Застосувати як промпт»').toBeNull();
          expect.soft(launch('descriptionOlx', 'improve'), '«Покращити через AI»').toBeNull();
          expect.soft(button('descriptionOlx', 'accept')?.disabled, '«<- AI»').toBe(true);
          expect.soft(spinnerIn(generateAllButton()), 'spinner in «Згенерувати все»').toBeNull();
          for (const field of TEXT_FIELDS.filter((other) => other !== 'descriptionOlx')) {
            expect.soft(spinnerIn(half(field)), `spinner beside ${field}`).toBeNull();
            expect.soft(launch(field, 'rewrite'), `prompt button of ${field}`).not.toBeNull();
          }
          expect.soft(notice(), 'the general notice').toBe('Модель готує тексти…');

          await nextPoll(run('succeeded'));
          http
            .expectOne(`/api/products/${CARD_ID}`)
            .flush(withLatest(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]));
          await settle();

          expect(spinnerIn(half('descriptionOlx'))).toBeNull();
          expect(launch('descriptionOlx', 'rewrite')?.getAttribute('aria-disabled')).toBeNull();
          expect(launch('descriptionOlx', 'improve')?.getAttribute('aria-disabled')).toBeNull();
          expect(button('descriptionOlx', 'accept')?.disabled).toBe(false);
        });
      }

      it('drops the field spinner, shows the failure and gives the buttons back when the run fails', async () => {
        open(PUBLISHED_ON_PROM);
        await settle();
        type('descriptionOlx', 'Продам мишу.');
        await settle();

        await startFieldRun('improve');
        expect.soft(spinnerIn(half('descriptionOlx')), 'spinner while running').not.toBeNull();

        await nextPoll(run('failed'));
        http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(PUBLISHED_ON_PROM));
        await settle();

        expect(spinnerIn(half('descriptionOlx'))).toBeNull();
        expect(actionsAlert()).toBe('Підготовка не вдалася. Спробуйте ще раз.');
        expect(launch('descriptionOlx', 'rewrite')?.getAttribute('aria-disabled')).toBeNull();
        expect(launch('descriptionOlx', 'improve')?.getAttribute('aria-disabled')).toBeNull();
      });

      const refusals: readonly { status: number; statusText: string; refusal: ApiError }[] = [
        {
          status: 409,
          statusText: 'Conflict',
          refusal: {
            error: {
              code: 'preparation_input_incomplete',
              message: 'The card lacks the input this preparation needs',
              details: { missing: ['draft'] },
            },
          },
        },
        {
          status: 429,
          statusText: 'Too Many Requests',
          refusal: {
            error: {
              code: 'preparation_rate_limited',
              message: 'Too many preparation runs for this card, try again later',
            },
          },
        },
      ];
      for (const { status, statusText, refusal } of refusals) {
        // The texts run afterwards is what shows a refused field is not left marked as working.
        it(`leaves no spinner beside the field whose POST got ${String(status)}, not even during the next run`, async () => {
          open(PUBLISHED_ON_PROM);
          await settle();
          type('descriptionOlx', 'Продам мишу.');
          await settle();

          launch('descriptionOlx', 'improve')?.click();
          await settle();
          http
            .expectOne(`/api/products/${CARD_ID}/preparation-runs`)
            .flush(refusal, { status, statusText });
          await settle();

          expect.soft(actionsAlert(), 'the refusal is shown').not.toBe('');
          expect.soft(spinnerIn(half('descriptionOlx')), 'spinner after the refusal').toBeNull();
          expect
            .soft(launch('descriptionOlx', 'improve')?.getAttribute('aria-disabled'))
            .toBeNull();

          generateAllButton().click();
          await settle();
          http
            .expectOne(`/api/products/${CARD_ID}/preparation-runs`)
            .flush({ ...run('running'), scope: 'texts' });
          await settle();
          http.expectOne(RUN_URL).flush({ ...run('running'), scope: 'texts' });
          await settle();

          expect
            .soft(spinnerIn(generateAllButton()), 'spinner in «Згенерувати все»')
            .not.toBeNull();
          expect.soft(spinnerIn(half('descriptionOlx')), 'spinner beside the field').toBeNull();
          expect.soft(launch('descriptionOlx', 'improve'), '«Покращити через AI»').not.toBeNull();

          await finishTextsRun(PUBLISHED_ON_PROM);
        });
      }

      // The form learns the field from its own request only; a run it merely watches names none.
      it('shows no field spinner for a run the form did not start, and one for the run it starts next', async () => {
        open(PUBLISHED_ON_PROM);
        await settle();
        type('descriptionOlx', 'Продам мишу.');
        await settle();

        const foreignRunId = '33333333-3333-4333-8333-333333333333';
        const foreignRunUrl = `/api/products/${CARD_ID}/preparation-runs/${foreignRunId}`;
        fixture.debugElement.injector.get(PreparationRunPoller).watch(CARD_ID, foreignRunId);
        http.expectOne(foreignRunUrl).flush({ ...run('running'), id: foreignRunId });
        await settle();

        expect.soft(notice(), 'the general notice').toBe('Модель готує тексти…');
        for (const field of TEXT_FIELDS) {
          expect.soft(spinnerIn(half(field)), `spinner beside ${field}`).toBeNull();
          expect.soft(launch(field, 'improve')?.getAttribute('aria-disabled')).toBe('true');
        }

        await vi.advanceTimersByTimeAsync(NEXT_POLL_MS);
        await settle();
        http.expectOne(foreignRunUrl).flush({ ...run('succeeded'), id: foreignRunId });
        await settle();
        http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(PUBLISHED_ON_PROM));
        await settle();

        await startFieldRun('improve');
        expect
          .soft(spinnerIn(half('descriptionOlx')), 'spinner for the run the form started')
          .not.toBeNull();

        await nextPoll(run('succeeded'));
        http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(PUBLISHED_ON_PROM));
        await settle();
      });
    });

    it('explains a rate limit in Ukrainian rather than showing its code', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      element.querySelector<HTMLButtonElement>('[data-testid="generate-all"]')?.click();
      await settle();

      const refusal: ApiError = {
        error: { code: 'preparation_rate_limited', message: 'Too many runs for this product' },
      };
      http
        .expectOne(`/api/products/${CARD_ID}/preparation-runs`)
        .flush(refusal, { status: 429, statusText: 'Too Many Requests' });
      await settle();

      expect(actionsAlert()).toBe(
        'Забагато запусків підготовки для цієї картки. Спробуйте за годину.',
      );
      expect(actionsAlert()).not.toContain('preparation_rate_limited');
    });

    describe('«Знайти ціну»', () => {
      const RUN_URL = `/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`;
      const NEXT_POLL_MS = 30_000;

      const NEWER_PRICE: FieldSuggestion = {
        ...SUGGESTED_PRICE,
        id: '99999999-9999-4999-8999-999999999999',
        runId: RUN_ID,
        value: { ...SUGGESTED_PRICE_RANGE, priceFrom: '2300.00', priceTo: '2800.00' },
        createdAt: '2026-10-09T09:00:35.000Z',
      };

      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      function priceButton(): HTMLButtonElement | null {
        return button('price', 'rewrite');
      }

      function priceRun(
        status: PreparationRunDto['status'],
        errorCode: PreparationRunDto['errorCode'] = null,
      ): PreparationRunDto {
        return { ...run(status), scope: 'price', errorCode, model: 'gemini-3.5-flash-lite' };
      }

      async function priceTooltip(): Promise<string> {
        const tooltip = await TestbedHarnessEnvironment.loader(fixture).getHarnessOrNull(
          MatTooltipHarness.with({
            selector: 'app-suggestion-field[data-field="price"] [data-testid="rewrite"]',
          }),
        );
        expect(tooltip, 'the price button carries no tooltip').not.toBeNull();
        if (tooltip === null) {
          return '';
        }
        await tooltip.show();
        const text = await tooltip.getTooltipText();
        await tooltip.hide();
        return text;
      }

      function notice(): string {
        return element.querySelector('.card-prepare [role="status"]')?.textContent.trim() ?? '';
      }

      async function startPriceRun(): Promise<void> {
        priceButton()?.click();
        await settle();
        http.expectOne(`/api/products/${CARD_ID}/preparation-runs`).flush(priceRun('running'));
        await settle();
      }

      it('stays unavailable for a draft with a title and no description', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        type('titleOlx', 'Logitech MX Master 3 бездротова');
        await settle();

        expect(priceButton()?.getAttribute('aria-disabled')).toBe('true');

        type('descriptionOlx', 'Продам мишу, повний комплект.');
        await settle();

        expect(priceButton()?.getAttribute('aria-disabled')).toBeNull();
      });

      it('counts a Prom description of tags alone as no description', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        type('titleProm', 'Миша Logitech MX Master 3');
        await typePromDescription('<p><br></p>');
        await settle();

        expect(priceButton()?.getAttribute('aria-disabled')).toBe('true');

        const area = element.querySelector<HTMLTextAreaElement>(
          'app-prom-description-editor textarea',
        );
        if (area === null) {
          throw new Error('the Prom description editor left its HTML mode');
        }
        area.value = '<p>Бездротова миша у відмінному стані.</p>';
        area.dispatchEvent(new Event('input'));
        await settle();

        expect(priceButton()?.getAttribute('aria-disabled')).toBeNull();
      });

      const mixedPairs: readonly { name: string; fill: () => Promise<void> }[] = [
        {
          name: 'the Prom title and the OLX description',
          fill: async () => {
            type('titleProm', 'Миша Logitech MX Master 3');
            type('descriptionOlx', 'Продам мишу, повний комплект.');
            await settle();
          },
        },
        {
          name: 'the OLX title and the Prom description',
          fill: async () => {
            type('titleOlx', 'Logitech MX Master 3 бездротова');
            await typePromDescription('<p>Бездротова миша у відмінному стані.</p>');
            await settle();
          },
        },
      ];
      for (const { name, fill } of mixedPairs) {
        it(`becomes available with ${name}`, async () => {
          open(EMPTY_WITH_FRAME);
          await settle();

          await fill();

          expect(priceButton()?.getAttribute('aria-disabled')).toBeNull();
        });
      }

      it('explains on the unavailable button that a title and a description are both needed', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        expect(await priceTooltip()).toContain(
          'хоча б одна назва й хоча б один опис з будь-якого майданчика',
        );
      });

      it('is labelled «Знайти ціну»', async () => {
        open(PUBLISHED_ON_PROM);
        await settle();

        const label = priceButton()?.getAttribute('aria-label') ?? '';
        expect(label).toContain('Знайти ціну');
        expect(label).not.toContain('Застосувати як промпт');
        expect(await priceTooltip()).toContain('Знайти ціну');
      });

      it('searches by the draft in the form, not by the saved card', async () => {
        open(PUBLISHED_ON_PROM);
        await settle();

        type('titleProm', 'Миша Logitech MX Master 3S');
        type('descriptionOlx', 'Продам мишу 3S, коробка в комплекті.');
        await settle();
        priceButton()?.click();
        await settle();

        const request = http.expectOne(`/api/products/${CARD_ID}/preparation-runs`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
          scope: 'price',
          titleProm: 'Миша Logitech MX Master 3S',
          titleOlx: PUBLISHED_ON_PROM.titleOlx,
          descriptionProm: PUBLISHED_ON_PROM.descriptionProm,
          descriptionOlx: 'Продам мишу 3S, коробка в комплекті.',
        });
        request.flush(priceRun('running'));
        await settle();

        http.expectOne(RUN_URL).flush(priceRun('succeeded'));
        await settle();
        http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(PUBLISHED_ON_PROM));
        await settle();
      });

      // Mid-run checks are soft: a hard failure would leave the poll open, and the shared verify()
      // would then fail every test after this one as well.
      it('searches again over an existing range, stays off while the search goes and shows the new range', async () => {
        openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_PRICE]);
        await settle();

        await startPriceRun();
        http.expectOne(RUN_URL).flush(priceRun('running'));
        await settle();

        expect
          .soft(priceButton()?.getAttribute('aria-disabled'), 'button while running')
          .toBe('true');
        expect.soft(notice(), 'the general notice').toBe('Модель шукає ціну…');
        priceButton()?.click();
        await settle();
        http.expectNone(`/api/products/${CARD_ID}/preparation-runs`);

        await vi.advanceTimersByTimeAsync(NEXT_POLL_MS);
        await settle();
        http.expectOne(RUN_URL).flush(priceRun('succeeded'));
        await settle();
        http
          .expectOne(`/api/products/${CARD_ID}`)
          .flush(withLatest(PUBLISHED_ON_PROM, [NEWER_PRICE]));
        await settle();

        expect(suggestionText('price')).toBe('від 2300.00 до 2800.00 ₴');
        expect(priceButton()?.getAttribute('aria-disabled')).toBeNull();
      });

      it('leaves the price field empty after a search that found a range', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();
        type('titleOlx', 'Logitech MX Master 3 бездротова');
        type('descriptionOlx', 'Продам мишу, повний комплект.');
        await settle();

        await startPriceRun();
        http.expectOne(RUN_URL).flush(priceRun('succeeded'));
        await settle();
        http
          .expectOne(`/api/products/${CARD_ID}`)
          .flush(withLatest(EMPTY_WITH_FRAME, [SUGGESTED_PRICE]));
        await settle();

        expect(suggestionText('price')).toBe('від 2100.00 до 2600.00 ₴');
        expect(field('price').value).toBe('');
      });

      const failures: readonly {
        code: NonNullable<PreparationRunDto['errorCode']>;
        message: string;
      }[] = [
        { code: 'price_unavailable', message: 'Пошук ціни не пройшов — спробуйте ще раз.' },
        { code: 'price_not_found', message: 'Вилку не знайдено — повторіть чи уточніть назву.' },
        {
          code: 'price_quota_exhausted',
          message: 'Ліміт пошуку на сьогодні вичерпано — спробуйте наступного дня.',
        },
      ];
      for (const { code, message } of failures) {
        it(`shows «${message}» for ${code}, keeps the draft and the previous range, and offers the button again`, async () => {
          openWithLatest(PUBLISHED_ON_PROM, [SUGGESTED_PRICE]);
          await settle();
          type('descriptionOlx', 'Мій власний опис.');
          await settle();

          await startPriceRun();
          http.expectOne(RUN_URL).flush(priceRun('failed', code));
          await settle();
          http
            .expectOne(`/api/products/${CARD_ID}`)
            .flush(withLatest(PUBLISHED_ON_PROM, [SUGGESTED_PRICE]));
          await settle();

          expect(actionsAlert()).toBe(message);
          expect(actionsAlert()).not.toMatch(/текст/i);
          expect(field('descriptionOlx').value).toBe('Мій власний опис.');
          expect(suggestionText('price')).toBe('від 2100.00 до 2600.00 ₴');
          expect(priceButton()?.getAttribute('aria-disabled')).toBeNull();
        });
      }
    });

    function run(status: PreparationRunDto['status']): PreparationRunDto {
      return {
        id: RUN_ID,
        productId: CARD_ID,
        scope: 'field',
        status,
        errorCode: status === 'failed' ? 'preparation_failed' : null,
        errorDetail: null,
        model: 'claude-sonnet-5',
        inputTokens: 0,
        outputTokens: 0,
        createdAt: '2026-09-20T09:00:00.000Z',
        startedAt: null,
        finishedAt: null,
      };
    }
  });

  describe('the card cost tail', () => {
    function openWithCost(cost: string | null): void {
      const data: ProductFormData = { productId: EMPTY_WITH_FRAME.id };
      TestBed.configureTestingModule({
        imports: [ProductForm],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: MAT_DIALOG_DATA, useValue: data },
          { provide: MatDialogRef, useValue: dialogRefDouble() },
        ],
      });
      fixture = TestBed.createComponent(ProductForm);
      http = TestBed.inject(HttpTestingController);
      element = fixture.nativeElement as HTMLElement;
      http
        .expectOne(`/api/products/${EMPTY_WITH_FRAME.id}`)
        .flush(asRead(EMPTY_WITH_FRAME, { estimatedCostUsd: cost }));
    }

    function costLine(): string {
      return element.querySelector('[data-testid="card-cost"]')?.textContent.trim() ?? '';
    }

    it('ends in «· ≈ $0,00» when nothing has been spent yet', async () => {
      openWithCost('0.0000');
      await settle();

      expect(costLine()).toMatch(/· ≈ \$0,00$/);
    });

    it('ends in «· < $0,01» for a cost below one cent instead of a rounded «$0,00»', async () => {
      openWithCost('0.0030');
      await settle();

      expect(costLine()).toMatch(/· < \$0,01$/);
    });

    it('ends in «· ≈ $0,04» for a cost of «0.0412»', async () => {
      openWithCost('0.0412');
      await settle();

      expect(costLine()).toMatch(/· ≈ \$0,04$/);
    });

    it('ends in «· вартість невідома» when the cost is null', async () => {
      openWithCost(null);
      await settle();

      expect(costLine()).toMatch(/· вартість невідома$/);
    });

    it('keeps the token readout from T31 next to the cost tail', async () => {
      openWithCost('0.0412');
      await settle();

      expect(costLine()).toContain('Витрачено токенів: 0 вхідних, 0 вихідних');
    });
  });
});
