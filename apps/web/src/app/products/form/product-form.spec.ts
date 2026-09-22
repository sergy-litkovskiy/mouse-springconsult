import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { firstValueFrom } from 'rxjs';
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

function answer(card: ProductCard, discardedKeywordsCount = 0): ProductUpdateResponse {
  return { ...card, discardedKeywordsCount };
}

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let close: ReturnType<typeof vi.fn>;

  /**
   * The dialog is handed an identifier and reads the card itself, so a test that opens an existing
   * card answers that read before anything else can happen.
   */
  function open(product: ProductCard | null): void {
    const data: ProductFormData = { productId: product?.id ?? null };
    close = vi.fn();
    TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    fixture = TestBed.createComponent(ProductForm);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    if (product !== null) {
      const read = http.expectOne(`/api/products/${product.id}`);
      expect(read.request.method).toBe('GET');
      read.flush(asRead(product));
    }
  }

  /** The three fields a read carries and a row of the list does not (T31, T53). */
  function asRead(card: ProductCard): ProductCardRead {
    return { ...card, pendingSuggestions: [], totalInputTokens: 0, totalOutputTokens: 0 };
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

  describe('without a single frame (AC-20)', () => {
    it('keeps every field and the save button unavailable', async () => {
      open(WITHOUT_FRAMES);
      await settle();

      for (const name of [
        'titleProm',
        'titleOlx',
        'descriptionOlx',
        'seoKeywords',
        'price',
        'category',
      ]) {
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

  it('saves a hand-written card with the same PATCH a suggestion uses (AC-12)', async () => {
    open(EMPTY_WITH_FRAME);
    await settle();

    type('titleProm', 'Миша Logitech MX Master 3');
    type('titleOlx', 'Logitech MX Master 3 бездротова');
    await typePromDescription('Бездротова миша у відмінному стані.');
    type('descriptionOlx', 'Продам мишу, повний комплект.');
    type('seoKeywords', 'миша, logitech');
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

  describe('the price (AC-09)', () => {
    it('explains the format, keeps what was typed and sends nothing', async () => {
      open(PUBLISHED_ON_PROM);
      await settle();

      type('price', '2499.999');
      field('price').dispatchEvent(new Event('blur'));
      await settle();

      expect(element.textContent).toContain('Ціна виглядає як 2499 або 2499.00.');
      expect(field('price').value).toBe('2499.999');
      expect(saveButton().disabled).toBe(true);
      submit();
      await settle();
      http.expectNone(`/api/products/${CARD_ID}`);
    });

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

  describe('the two marketplace marks (AC-13)', () => {
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

  it('reports the keywords past the ceiling that the server threw away in the notice (AC-07, AC-43)', async () => {
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

  describe('a successful save (AC-43)', () => {
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

    it('closes the dialog with true so the catalogue re-reads its page (AC-43)', async () => {
      await saveAccepted();

      expect(close).toHaveBeenCalledWith(true);
    });

    it('confirms the save with a green notice (AC-43)', async () => {
      await saveAccepted();

      const notice = successNotice();
      expect(notice, 'no success notice').not.toBeNull();
      expect(notice?.textContent).toContain('Картку збережено');
      expect(notice?.textContent).not.toContain('Понад ліміт');
    });

    it('lets the notice go away by itself within a few seconds (AC-43)', async () => {
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

  describe('a failed save (AC-44)', () => {
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
        message: 'Ціна виглядає як 2499 або 2499.00.',
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
      it(`keeps the dialog open and shows the message next to the buttons on ${name} (AC-44)`, async () => {
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

    type('seoKeywords', 'x'.repeat(61));
    await settle();
    expect(saveButton().disabled).toBe(true);

    type('seoKeywords', 'миша');
    await settle();
    expect(saveButton().disabled).toBe(false);
  });

  describe('the two titles (AC-52)', () => {
    const TITLES = ['titleProm', 'titleOlx'] as const;
    const LONG_TITLE =
      'Миша Logitech MX Master 3 бездротова, графітова, з зарядним кабелем USB-C, ' +
      'коробкою та приймачем Unifying, у відмінному стані після одного року використання';

    for (const name of TITLES) {
      it(`shows the whole ${name} in a field that grows with the text (AC-52)`, async () => {
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

      it(`turns a pasted line break in ${name} into a space and saves one line (AC-52)`, async () => {
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

      it(`adds nothing to ${name} on Enter (AC-52)`, async () => {
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

    it('still refuses a title of 201 characters in the multi-line field (AC-52)', async () => {
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

  describe('the gaps behind the readiness badge (AC-15)', () => {
    it('names what the open card lacks in the words and order of the catalogue (AC-15)', async () => {
      open(WITHOUT_OLX_DESCRIPTION_AND_PRICE);
      await settle();

      expect(readiness()).toContain('Неготово');
      expect(await readinessHint()).toBe('Бракує: опис OLX, ціна');
    });

    // The dialog closes on save (T45), so the fresh readiness is the catalogue's to show.
    it('leaves the readiness of a card that came back ready to the catalogue (AC-15, AC-43)', async () => {
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

    it('lists the gaps of the last server answer, not of unsaved fields (AC-15)', async () => {
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
  describe('the preparation panel (T32)', () => {
    const RUN_ID = '44444444-4444-4444-8444-444444444444';

    const SUGGESTED_OLX_DESCRIPTION: FieldSuggestion = {
      id: '55555555-5555-4555-8555-555555555555',
      runId: RUN_ID,
      field: 'descriptionOlx',
      value: 'Продам мишу Logitech MX Master 3, повний комплект.',
      resolution: null,
      resolvedAt: null,
      createdAt: '2026-09-20T09:00:35.000Z',
    };

    const SUGGESTED_PRICE: FieldSuggestion = {
      ...SUGGESTED_OLX_DESCRIPTION,
      id: '66666666-6666-4666-8666-666666666666',
      field: 'price',
      value: { priceFrom: '2100.00', priceTo: '2600.00' },
    };

    /** A card read that already carries suggestions nobody has decided on yet. */
    function withPending(card: ProductCard, pending: readonly FieldSuggestion[]): ProductCardRead {
      return { ...asRead(card), pendingSuggestions: [...pending] };
    }

    function openWithPending(card: ProductCard, pending: readonly FieldSuggestion[]): void {
      const data: ProductFormData = { productId: card.id };
      close = vi.fn();
      TestBed.configureTestingModule({
        imports: [ProductForm],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: MAT_DIALOG_DATA, useValue: data },
          { provide: MatDialogRef, useValue: { close } },
        ],
      });
      fixture = TestBed.createComponent(ProductForm);
      http = TestBed.inject(HttpTestingController);
      element = fixture.nativeElement as HTMLElement;
      http.expectOne(`/api/products/${card.id}`).flush(withPending(card, pending));
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

    it('keeps «? -> AI» unavailable while the field is empty (AC-22)', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      expect(button('titleOlx', 'rewrite')?.disabled).toBe(true);

      type('titleOlx', 'Logitech MX Master 3 бездротова');
      await settle();

      expect(button('titleOlx', 'rewrite')?.disabled).toBe(false);
    });

    it('rewrites the one field from its draft, without the photos (AC-21)', async () => {
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
      });
      request.flush(run('running'));
      await settle();

      http.expectOne(`/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`).flush(run('failed'));
      await settle();
      http.expectOne(`/api/products/${CARD_ID}`).flush(asRead(EMPTY_WITH_FRAME));
      await settle();
    });

    // Skipped, not deleted: the price half is hidden until T54 makes the lookup return a range
    // instead of an empty string. T54 turns the flag back on and these two go green again.
    it.skip('keeps the price button unavailable until the card has a title (AC-24)', async () => {
      open(EMPTY_WITH_FRAME);
      await settle();

      type('descriptionOlx', 'Продам мишу, повний комплект.');
      await settle();
      // A description alone does not enable it: the server gates on a title (AC-27).
      expect(button('price', 'rewrite')?.disabled).toBe(true);

      type('titleOlx', 'Logitech MX Master 3 бездротова');
      await settle();

      expect(button('price', 'rewrite')?.disabled).toBe(false);
    });

    it.skip('shows the price range as text and never accepts it for the admin (AC-25)', async () => {
      openWithPending(EMPTY_WITH_FRAME, [SUGGESTED_PRICE]);
      await settle();

      expect(suggestionText('price')).toBe('від 2100.00 до 2600.00 ₴');
      // No «<- AI» beside the price at all: the admin types the number in by hand.
      expect(button('price', 'accept')).toBeNull();
      expect(field('price').value).toBe('');
    });

    it('shows a suggestion beside the field the admin wrote, not instead of it (AC-11)', async () => {
      openWithPending(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION]);
      await settle();

      type('descriptionOlx', 'Мій власний текст.');
      await settle();

      expect(field('descriptionOlx').value).toBe('Мій власний текст.');
      expect(suggestionText('descriptionOlx')).toBe(SUGGESTED_OLX_DESCRIPTION.value);

      button('descriptionOlx', 'accept')?.click();
      await settle();

      const accepted = http.expectOne(
        `/api/products/${CARD_ID}/suggestions/${SUGGESTED_OLX_DESCRIPTION.id}/accept`,
      );
      expect(accepted.request.method).toBe('POST');
      accepted.flush(
        asRead({
          ...PUBLISHED_ON_PROM,
          descriptionOlx: SUGGESTED_OLX_DESCRIPTION.value as string,
        }),
      );
      await settle();

      expect(field('descriptionOlx').value).toBe(SUGGESTED_OLX_DESCRIPTION.value);
      // Only that field moved: a suggestion decides nothing about the rest of the form.
      expect(field('titleProm').value).toBe(PUBLISHED_ON_PROM.titleProm);
    });

    it('shows the suggestions of a card opened without a run of its own (AC-28)', async () => {
      openWithPending(PUBLISHED_ON_PROM, [SUGGESTED_OLX_DESCRIPTION, SUGGESTED_PRICE]);
      await settle();

      expect(suggestionText('descriptionOlx')).toBe(SUGGESTED_OLX_DESCRIPTION.value);
      // The price suggestion arrives in the read all the same; showing it comes back with T54.
    });

    describe('texts the server applied on its own (T55)', () => {
      /** The card as the read after «Згенерувати все» returns it: every untouched field filled. */
      const GENERATED: ProductCard = {
        ...EMPTY_WITH_FRAME,
        titleProm: 'Миша Logitech MX Master 3',
        titleOlx: 'Logitech MX Master 3 бездротова',
        descriptionProm: '<p>Бездротова миша у відмінному стані.</p>',
        descriptionOlx: 'Продам мишу, повний комплект.',
        seoKeywords: ['миша', 'logitech'],
      };

      function textsRun(status: PreparationRunDto['status']): PreparationRunDto {
        return { ...run(status), scope: 'texts', errorCode: null };
      }

      async function startGenerateAll(): Promise<void> {
        element.querySelector<HTMLButtonElement>('[data-testid="generate-all"]')?.click();
        await settle();
        const started = http.expectOne(`/api/products/${CARD_ID}/preparation-runs`);
        expect(started.request.body).toEqual({ scope: 'texts' });
        started.flush(textsRun('running'));
        await settle();
      }

      async function finishWith(card: ProductCard): Promise<void> {
        http
          .expectOne(`/api/products/${CARD_ID}/preparation-runs/${RUN_ID}`)
          .flush(textsRun('succeeded'));
        await settle();
        http.expectOne(`/api/products/${CARD_ID}`).flush(withPending(card, []));
        await settle();
      }

      async function promDescriptionHtml(): Promise<string> {
        promHtmlMode().click();
        await settle();
        const area = element.querySelector<HTMLTextAreaElement>(
          'app-prom-description-editor textarea',
        );
        if (area === null) {
          throw new Error('the Prom description editor has no HTML mode');
        }
        return area.value;
      }

      it('shows the applied texts in the fields without a click (AC-05)', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        await startGenerateAll();
        await finishWith(GENERATED);

        expect(field('titleProm').value).toBe(GENERATED.titleProm);
        expect(field('titleOlx').value).toBe(GENERATED.titleOlx);
        expect(field('descriptionOlx').value).toBe(GENERATED.descriptionOlx);
        expect(field('seoKeywords').value).toBe('миша, logitech');
        expect(await promDescriptionHtml()).toBe(GENERATED.descriptionProm);
      });

      it('saves the applied texts instead of erasing them (AC-05)', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        await startGenerateAll();
        await finishWith(GENERATED);
        submit();
        await settle();

        const request = http.expectOne(`/api/products/${CARD_ID}`);
        expect(request.request.method).toBe('PATCH');
        const body = request.request.body as Record<string, unknown>;
        expect({
          titleProm: body['titleProm'],
          titleOlx: body['titleOlx'],
          descriptionProm: body['descriptionProm'],
          descriptionOlx: body['descriptionOlx'],
          seoKeywords: body['seoKeywords'],
        }).toEqual({
          titleProm: GENERATED.titleProm,
          titleOlx: GENERATED.titleOlx,
          descriptionProm: GENERATED.descriptionProm,
          descriptionOlx: GENERATED.descriptionOlx,
          seoKeywords: GENERATED.seoKeywords,
        });
        request.flush(answer(GENERATED));
        await settle();
      });

      it('keeps a field edited during the run and fills the untouched ones (AC-11)', async () => {
        open(EMPTY_WITH_FRAME);
        await settle();

        await startGenerateAll();
        type('descriptionOlx', 'Мій власний текст.');
        await settle();
        await finishWith(GENERATED);

        expect(field('descriptionOlx').value).toBe('Мій власний текст.');
        expect(field('titleOlx').value).toBe(GENERATED.titleOlx);
        expect(field('seoKeywords').value).toBe('миша, logitech');
        expect(await promDescriptionHtml()).toBe(GENERATED.descriptionProm);
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
});
