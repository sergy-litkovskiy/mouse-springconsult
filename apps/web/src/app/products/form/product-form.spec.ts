import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { firstValueFrom } from 'rxjs';
import type { ApiError } from '@contracts/error.contract';
import type {
  Product,
  ProductCard,
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

  function open(product: ProductCard | null): void {
    const data: ProductFormData = { product };
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
        'descriptionProm',
        'descriptionOlx',
        'seoKeywords',
        'price',
        'category',
      ]) {
        expect(field(name).disabled, name).toBe(true);
      }
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
    type('descriptionProm', 'Бездротова миша у відмінному стані.');
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

    type('descriptionProm', 'Опис');
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
});
