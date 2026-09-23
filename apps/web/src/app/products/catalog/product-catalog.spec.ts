import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { PreparationRunDto } from '@contracts/ai.contract';
import type { ProductCard, ProductList, ProductListItem } from '@contracts/products.contract';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from '../../confirm-dialog';
import { ProductForm } from '../form/product-form';
import { ImageViewer } from '../gallery/image-viewer';
import { PreparationFailures } from './preparation-failures';
import { ProductCatalog } from './product-catalog';

function makeImage(id: string, position: number, isMain: boolean) {
  return {
    id,
    r2Key: `products/${id}.jpg`,
    url: `https://r2.example.com/${id}.jpg`,
    position,
    isMain,
  };
}

const MOUSE: ProductListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  titleProm: 'Миша Logitech MX Master 3',
  descriptionProm: 'Бездротова миша у відмінному стані.',
  titleOlx: 'Logitech MX Master 3 бездротова',
  descriptionOlx: 'Продам мишу, повний комплект.',
  price: '2499.00',
  seoKeywords: ['миша', 'logitech'],
  category: 'Периферія',
  publishedProm: true,
  publishedOlx: false,
  condition: 'used',
  images: [
    makeImage('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 0, false),
    makeImage('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1, true),
    makeImage('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 2, false),
  ],
  isReady: true,
  failedRuns: 2,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

const KEYBOARD: ProductListItem = {
  ...MOUSE,
  id: '22222222-2222-4222-8222-222222222222',
  titleProm: 'Клавіатура Keychron K2',
  titleOlx: 'Keychron K2 механічна',
  price: '3200.00',
  publishedProm: false,
  publishedOlx: false,
  condition: 'new',
  images: [],
  isReady: false,
  failedRuns: 0,
};

const FAILED_PRICE_RUN: PreparationRunDto = {
  id: '44444444-4444-4444-8444-444444444444',
  productId: MOUSE.id,
  scope: 'both',
  status: 'failed',
  errorCode: 'price_unavailable',
  errorDetail: 'Price search refused',
  model: 'claude-sonnet-5',
  inputTokens: 1200,
  outputTokens: 300,
  createdAt: '2026-09-20T09:00:00.000Z',
  startedAt: '2026-09-20T09:00:01.000Z',
  finishedAt: '2026-09-20T09:00:40.000Z',
};

const FAILED_TEXTS_RUN: PreparationRunDto = {
  ...FAILED_PRICE_RUN,
  id: '55555555-5555-4555-8555-555555555555',
  scope: 'texts',
  errorCode: 'preparation_failed',
  errorDetail: null,
  createdAt: '2026-09-19T09:00:00.000Z',
  finishedAt: '2026-09-19T09:05:00.000Z',
};

const PAGE: ProductList = { items: [MOUSE, KEYBOARD], total: 2, page: 1, pageSize: 20 };

const EMPTY_CARD: ProductListItem = {
  ...MOUSE,
  id: '33333333-3333-4333-8333-333333333333',
  titleProm: '',
  descriptionProm: '',
  titleOlx: '',
  descriptionOlx: '',
  price: '0.00',
  seoKeywords: [],
  category: '',
  images: [],
  isReady: false,
};

const UNPRICED: ProductListItem = {
  ...MOUSE,
  id: '44444444-4444-4444-8444-444444444444',
  price: '0.00',
  isReady: false,
};

const WITHOUT_OLX_DESCRIPTION: ProductListItem = {
  ...MOUSE,
  id: '55555555-5555-4555-8555-555555555555',
  descriptionOlx: '',
  isReady: false,
};

describe('ProductCatalog', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let element: HTMLElement;

  /**
   * The table is opened through the router, not built by hand: its whole state arrives as
   * query parameters, so a test that skips the router tests a component nobody runs.
   */
  async function open(url = '/products'): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    element = harness.routeNativeElement!;
    await tick();
  }

  /**
   * Drains the microtask queue and repaints — a navigation, the inputs the router fills from
   * it and the request the resource makes of them are three separate turns. `whenStable()`
   * has no place here: a resource holds a pending task while it loads, so waiting for
   * stability before the answer is flushed waits for something this test is about to do.
   */
  async function tick(): Promise<void> {
    for (let round = 0; round < 2; round += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      harness.detectChanges();
    }
  }

  /** Once the answer has been flushed there is nothing left in flight to wait for. */
  async function settle(): Promise<void> {
    await tick();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function expectRequest(): TestRequest {
    return http.expectOne((request) => request.url === '/api/products');
  }

  /** Filled through the DOM, not through the instance: the test sees what the user sees. */
  function type(name: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(`input[formcontrolname="${name}"]`);
    if (input === null) {
      throw new Error(`no input named ${name}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submitFilters(): void {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [{ path: 'products', component: ProductCatalog }],
          withComponentInputBinding(),
        ),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks for the first page with the default ordering', async () => {
    await open();
    const request = expectRequest();

    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('20');
    expect(request.request.params.get('sort')).toBe('titleProm');
    expect(request.request.params.get('direction')).toBe('asc');
    // An empty filter is not sent at all: the backend would reject an empty string.
    expect(request.request.params.has('title')).toBe(false);

    request.flush(PAGE);
    await settle();
  });

  it('takes the whole state of the table out of the address bar', async () => {
    await open(
      '/products?page=2&pageSize=10&sort=price&direction=desc&title=миша' +
        '&publishedProm=false&publishedOlx=true',
    );
    const request = expectRequest();

    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('sort')).toBe('price');
    expect(request.request.params.get('direction')).toBe('desc');
    expect(request.request.params.get('title')).toBe('миша');
    expect(request.request.params.get('publishedProm')).toBe('false');
    expect(request.request.params.get('publishedOlx')).toBe('true');

    request.flush({ ...PAGE, page: 2, pageSize: 10 });
    await settle();

    // The filters show what the rows underneath them were selected by.
    const title = element.querySelector<HTMLInputElement>('input[formcontrolname="title"]');
    expect(title?.value).toBe('миша');
  });

  it('falls back to the defaults for a query string that was typed by hand', async () => {
    await open('/products?page=nonsense&pageSize=9999&sort=category&direction=sideways');
    const request = expectRequest();

    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('20');
    expect(request.request.params.get('sort')).toBe('titleProm');
    expect(request.request.params.get('direction')).toBe('asc');

    request.flush(PAGE);
    await settle();
  });

  it('drops a filter the address bar made longer than the contract allows', async () => {
    await open(`/products?category=${'я'.repeat(200)}`);
    const request = expectRequest();

    // 120 is the contract's own bound; the server would only answer validation_failed.
    expect(request.request.params.has('category')).toBe(false);

    request.flush(PAGE);
    await settle();
  });

  it('keeps filter text that has not been applied yet when the page changes', async () => {
    await open();
    expectRequest().flush({ ...PAGE, total: 100 });
    await settle();

    type('title', 'миша');
    await harness.navigateByUrl('/products?page=2');
    await tick();

    const title = element.querySelector<HTMLInputElement>('input[formcontrolname="title"]');
    expect(title?.value).toBe('миша');

    expectRequest().flush({ ...PAGE, page: 2, total: 100 });
    await settle();
  });

  it('leaves the first page out of the URL rather than spelling it out', async () => {
    await open('/products?page=2');
    expectRequest().flush({ ...PAGE, page: 2, total: 100 });
    await settle();

    element.querySelector<HTMLButtonElement>('button[aria-label="Попередня сторінка"]')?.click();
    await tick();

    // The same view the admin would have reached by applying a filter, and the same URL.
    expect(TestBed.inject(Router).url).toBe('/products');

    expectRequest().flush({ ...PAGE, total: 100 });
    await settle();
  });

  it('explains a price range the address bar got backwards', async () => {
    await open('/products?priceMin=5000.00&priceMax=1000.00');
    expectRequest().flush({ ...PAGE, items: [], total: 0 });
    await settle();

    expect(element.textContent).toContain('не може бути меншою');
  });

  it('renders a row per product with the price and the condition in Ukrainian', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    expect(element.querySelectorAll('tr[mat-row]').length).toBe(2);
    expect(element.textContent).toContain('Миша Logitech MX Master 3');
    expect(element.textContent).toContain('Keychron K2 механічна');
    expect(element.textContent).toContain('Вживаний');
    expect(element.textContent).toContain('Новий');
    expect(element.textContent).toContain('Знайдено: 2');

    // MOUSE is up on Prom and not on OLX: the two columns say different things about the
    // same card, which is the whole point of there being two of them.
    const firstRow = element.querySelector('tr[mat-row]');
    const cell = (column: string): string | undefined =>
      firstRow?.querySelector(`td.mat-column-${column}`)?.textContent.trim();
    expect(cell('publishedProm')).toBe('Опубліковано');
    expect(cell('publishedOlx')).toBe('Ні');
  });

  it('shows the main frame as the thumbnail and the total number of images beside it', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    const thumbnails = element.querySelectorAll<HTMLImageElement>('.gallery-cell__thumb img');
    // The main image is second in the array — the thumbnail follows isMain, not position.
    expect(thumbnails[0]?.src).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    const counters = element.querySelectorAll<HTMLButtonElement>('.gallery-cell__count');
    expect(counters[0]?.textContent.trim()).toBe('3');
    expect(counters[1]?.textContent.trim()).toBe('0');
    // A card without photographs has nothing to open.
    expect(counters[1]?.disabled).toBe(true);
  });

  it('opens the photo viewer, not the card, when the image count is clicked (AC-40)', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    element.querySelector<HTMLButtonElement>('.gallery-cell__count')?.click();
    await settle();

    const dialogs = TestBed.inject(MatDialog).openDialogs;
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]?.componentInstance).toBeInstanceOf(ImageViewer);
    TestBed.inject(MatDialog).closeAll();
    await settle();
  });

  it('opens the photo viewer, not the card, when the thumbnail is clicked (AC-40)', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    element.querySelector<HTMLButtonElement>('button.gallery-cell__thumb')?.click();
    await settle();

    const dialogs = TestBed.inject(MatDialog).openDialogs;
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]?.componentInstance).toBeInstanceOf(ImageViewer);
    TestBed.inject(MatDialog).closeAll();
    await settle();
  });

  function failuresButton(row: number): HTMLButtonElement | null {
    return rows()[row]?.querySelector<HTMLButtonElement>('[data-testid="failures"]') ?? null;
  }

  it('shows the failed-run count only in the row of a card that failed (AC-49)', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    expect(failuresButton(0)?.textContent.trim()).toContain('2');
    // An empty cell, not a zero: nothing to open and nothing to look at.
    expect(failuresButton(1)).toBeNull();
  });

  it('opens the list of failures, not the card, and words them in Ukrainian (AC-49)', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    failuresButton(0)?.click();
    // Not `settle()`: the dialog's resource is still waiting for the answer flushed below.
    await tick();

    expect(dialogs().length).toBe(1);
    expect(dialogs()[0]?.componentInstance).toBeInstanceOf(PreparationFailures);
    const read = http.expectOne(
      (request) => request.url === `/api/products/${MOUSE.id}/preparation-runs`,
    );
    expect(read.request.params.get('status')).toBe('failed');
    read.flush([FAILED_PRICE_RUN, FAILED_TEXTS_RUN]);
    await settle();

    const items = [...document.querySelectorAll<HTMLElement>('[data-testid="failure"]')];
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toContain('Тексти й ціна');
    expect(items[0]?.textContent).toContain('Ціну знайти не вдалося');
    expect(items[0]?.querySelector('[data-testid="failure-detail"]')?.textContent).toBe(
      'Price search refused',
    );
    expect(items[1]?.textContent).toContain('Підготовка не вдалася');
    // A run that failed before the detail was recorded shows the Ukrainian text alone.
    expect(items[1]?.querySelector('[data-testid="failure-detail"]')).toBeNull();
    const dialogText = document.querySelector('mat-dialog-container')?.textContent ?? '';
    expect(dialogText).not.toContain('price_unavailable');
    expect(dialogText).not.toContain('preparation_failed');

    TestBed.inject(MatDialog).closeAll();
    await settle();
  });

  it('offers no viewer for a card without photos, only its form (AC-41)', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    const keyboardRow = element.querySelectorAll('tr[mat-row]')[1];
    expect(keyboardRow?.querySelector('button.gallery-cell__thumb')).toBeNull();
    keyboardRow?.querySelector<HTMLElement>('.gallery-cell__thumb--empty')?.click();
    await settle();
    await answerCardRead(KEYBOARD);

    const dialogs = TestBed.inject(MatDialog).openDialogs;
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]?.componentInstance).toBeInstanceOf(ProductForm);
    TestBed.inject(MatDialog).closeAll();
    await settle();
  });

  it('writes the applied filters into the URL and returns to the first page', async () => {
    await open('/products?page=2');
    expectRequest().flush({ ...PAGE, page: 2 });
    await settle();

    type('title', '  миша  ');
    type('priceMin', '1000.50');
    submitFilters();
    await tick();

    const url = TestBed.inject(Router).url;
    expect(url).toContain('priceMin=1000.50');
    expect(url).not.toContain('page=');

    const request = expectRequest();
    expect(request.request.params.get('title')).toBe('миша');
    // The price travels as the decimal the admin typed; nothing rescales it on the way.
    expect(request.request.params.get('priceMin')).toBe('1000.50');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.has('description')).toBe(false);
    expect(request.request.params.has('priceMax')).toBe(false);

    request.flush({ ...PAGE, items: [MOUSE], total: 1 });
    await settle();

    expect(element.querySelectorAll('tr[mat-row]').length).toBe(1);
  });

  it('refuses a price the contract would reject instead of asking the server', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    type('priceMin', '1000.555');
    submitFilters();
    await tick();

    http.expectNone((request) => request.url === '/api/products');
    expect(element.textContent).toContain('Ціна виглядає як');
  });

  it('refuses an upper bound below the lower one', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    type('priceMin', '5000.00');
    type('priceMax', '1000.00');
    submitFilters();
    await tick();

    http.expectNone((request) => request.url === '/api/products');
    expect(element.textContent).toContain('не може бути меншою');
  });

  it('abandons the page in flight instead of letting two answers race', async () => {
    await open();
    const first = expectRequest();

    await harness.navigateByUrl('/products?page=3');
    await tick();

    expect(first.cancelled).toBe(true);

    const second = expectRequest();
    expect(second.request.params.get('page')).toBe('3');
    second.flush({ ...PAGE, page: 3 });
    await settle();

    expect(element.querySelectorAll('tr[mat-row]').length).toBe(2);
  });

  it('reports a failure instead of leaving stale rows on screen', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    type('title', 'нічого');
    submitFilters();
    await tick();

    expectRequest().flush(
      { error: { code: 'not_authenticated', message: 'Authentication required' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    await settle();

    expect(element.textContent).toContain('Сесія завершилась');
    expect(element.querySelectorAll('tr[mat-row]').length).toBe(0);
  });

  function publishedSelect(name: 'publishedProm' | 'publishedOlx'): Promise<MatSelectHarness> {
    return TestbedHarnessEnvironment.loader(harness.fixture).getHarness(
      MatSelectHarness.with({ selector: `[formcontrolname="${name}"]` }),
    );
  }

  for (const name of ['publishedProm', 'publishedOlx'] as const) {
    it(`offers all, yes and no in the ${name} filter with all chosen by default (AC-32)`, async () => {
      await open();
      expectRequest().flush(PAGE);
      await settle();

      const select = await publishedSelect(name);
      expect(await select.getValueText()).toBe('Всі');

      await select.open();
      const options = await select.getOptions();
      expect(await Promise.all(options.map((option) => option.getText()))).toEqual([
        'Всі',
        'Так',
        'Ні',
      ]);
      expect(await Promise.all(options.map((option) => option.isSelected()))).toEqual([
        true,
        false,
        false,
      ]);
      await select.close();
    });
  }

  it('labels the published filters of a saved address with no and yes (AC-13)', async () => {
    await open('/products?publishedProm=false&publishedOlx=true');
    const request = expectRequest();

    // The option values are what saved addresses carry, so the relabelling must not touch them.
    expect(request.request.params.get('publishedProm')).toBe('false');
    expect(request.request.params.get('publishedOlx')).toBe('true');

    request.flush(PAGE);
    await settle();

    expect(await (await publishedSelect('publishedProm')).getValueText()).toBe('Ні');
    expect(await (await publishedSelect('publishedOlx')).getValueText()).toBe('Так');
  });

  function readySelect(): Promise<MatSelectHarness> {
    return TestbedHarnessEnvironment.loader(harness.fixture).getHarness(
      MatSelectHarness.with({ selector: '[formcontrolname="ready"]' }),
    );
  }

  it('carries ready=false from the address into the request and the select (AC-29)', async () => {
    await open('/products?ready=false');
    const request = expectRequest();

    expect(request.request.params.get('ready')).toBe('false');

    request.flush({ ...PAGE, items: [KEYBOARD], total: 1 });
    await settle();

    expect(await (await readySelect()).getValueText()).toBe('Ні');
  });

  for (const [label, value] of [
    ['Так', 'true'],
    ['Ні', 'false'],
  ] as const) {
    it(`writes ready=${value} into the URL and returns to the first page when «${label}» is applied (AC-29)`, async () => {
      await open('/products?page=2');
      expectRequest().flush({ ...PAGE, page: 2 });
      await settle();

      await (await readySelect()).clickOptions({ text: label });
      submitFilters();
      await tick();

      const url = TestBed.inject(Router).url;
      expect(url).toContain(`ready=${value}`);
      expect(url).not.toContain('page=');

      const request = expectRequest();
      expect(request.request.params.get('ready')).toBe(value);
      expect(request.request.params.get('page')).toBe('1');

      request.flush(PAGE);
      await settle();
    });
  }

  it('offers all, yes and no in the readiness filter with all chosen by default (AC-31)', async () => {
    await open();
    const request = expectRequest();

    expect(request.request.params.has('ready')).toBe(false);

    request.flush(PAGE);
    await settle();

    const select = await readySelect();
    expect(await select.getValueText()).toBe('Всі');

    await select.open();
    const options = await select.getOptions();
    expect(await Promise.all(options.map((option) => option.getText()))).toEqual([
      'Всі',
      'Так',
      'Ні',
    ]);
    await select.close();
  });

  it('reads an invalid ready from the address as all and leaves it out of the request (AC-31)', async () => {
    await open('/products?ready=yes');
    const request = expectRequest();

    expect(request.request.params.has('ready')).toBe(false);

    request.flush(PAGE);
    await settle();

    expect(await (await readySelect()).getValueText()).toBe('Всі');
  });

  it('drops ready from the URL and the request on reset (AC-31)', async () => {
    await open('/products?ready=true');
    expectRequest().flush(PAGE);
    await settle();

    [...element.querySelectorAll<HTMLButtonElement>('.filters__actions button')]
      .find((button) => button.textContent.trim() === 'Скинути')
      ?.click();
    await tick();

    expect(TestBed.inject(Router).url).toBe('/products');

    const request = expectRequest();
    expect(request.request.params.has('ready')).toBe(false);
    request.flush(PAGE);
    await settle();

    expect(await (await readySelect()).getValueText()).toBe('Всі');
  });

  it('puts the readiness select back in line with the address on Back', async () => {
    await open('/products?ready=true');
    expectRequest().flush(PAGE);
    await settle();

    await harness.navigateByUrl('/products');
    await tick();

    const request = expectRequest();
    expect(request.request.params.has('ready')).toBe(false);
    request.flush(PAGE);
    await settle();

    expect(await (await readySelect()).getValueText()).toBe('Всі');
  });
  function dialogs() {
    return TestBed.inject(MatDialog).openDialogs;
  }

  /**
   * The card form reads the card it was given (T32): the row of the list carries neither the
   * suggestions waiting for a decision nor the cost of the card, so the dialog asks for them.
   */
  async function answerCardRead(card: ProductCard): Promise<void> {
    const read = http.expectOne(`/api/products/${card.id}`);
    expect(read.request.method).toBe('GET');
    read.flush({ ...card, pendingSuggestions: [], totalInputTokens: 0, totalOutputTokens: 0 });
    await settle();
  }

  /** The overlay lives on the body, outside the routed fixture. */
  function dialogField(name: string): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(
      `mat-dialog-container [formcontrolname="${name}"]`,
    );
  }

  async function closeDialog(result: boolean | undefined): Promise<void> {
    const ref = dialogs()[0];
    if (ref === undefined) {
      throw new Error('no dialog is open');
    }
    const closed = firstValueFrom(ref.afterClosed());
    ref.close(result);
    await closed;
    await tick();
  }

  function createButton(): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent.trim() === 'Нова картка',
    );
  }

  function rows(): HTMLTableRowElement[] {
    return [...element.querySelectorAll<HTMLTableRowElement>('tr[mat-row]')];
  }

  function badge(row: number): HTMLElement | null {
    return rows()[row]?.querySelector<HTMLElement>('[data-testid="readiness"]') ?? null;
  }

  async function missingHint(row: number): Promise<string> {
    const tooltips = await TestbedHarnessEnvironment.loader(harness.fixture).getAllHarnesses(
      MatTooltipHarness.with({ selector: '[data-testid="readiness"]' }),
    );
    const tooltip = tooltips[row];
    if (tooltip === undefined) {
      throw new Error(`no readiness badge in row ${String(row)}`);
    }
    await tooltip.show();
    const text = await tooltip.getTooltipText();
    await tooltip.hide();
    return text.toLowerCase();
  }

  function deleteButton(row: number): HTMLButtonElement | null {
    return rows()[row]?.querySelector<HTMLButtonElement>('button[aria-label^="Видалити"]') ?? null;
  }

  it('opens an empty card form from the create button', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    const create = createButton();
    expect(create).toBeDefined();
    create?.click();
    await settle();

    expect(dialogs().length).toBe(1);
    expect(dialogs()[0]?.componentInstance).toBeInstanceOf(ProductForm);
    expect(dialogField('titleProm')?.value).toBe('');
    expect(dialogField('descriptionOlx')?.value).toBe('');

    await closeDialog(false);
  });

  it('opens the form of the card whose row is clicked', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    rows()[1]?.click();
    await settle();
    await answerCardRead(KEYBOARD);

    expect(dialogs().length).toBe(1);
    expect(dialogs()[0]?.componentInstance).toBeInstanceOf(ProductForm);
    expect(dialogField('titleProm')?.value).toBe('Клавіатура Keychron K2');
    expect(dialogField('price')?.value).toBe('3200.00');

    await closeDialog(false);
  });

  it('re-reads the page when the form closes having changed something', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    rows()[0]?.click();
    await settle();
    await answerCardRead(MOUSE);
    await closeDialog(true);

    const request = expectRequest();
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ ...PAGE, items: [MOUSE, KEYBOARD, EMPTY_CARD], total: 3 });
    await settle();

    expect(rows().length).toBe(3);
  });

  it('re-reads the page after a new card was created in the form', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    createButton()?.click();
    await settle();
    await closeDialog(true);

    expectRequest().flush({ ...PAGE, items: [MOUSE, KEYBOARD, EMPTY_CARD], total: 3 });
    await settle();

    expect(element.textContent).toContain('Знайдено: 3');
  });

  it('keeps the page as it is when the form closes without changes', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    rows()[0]?.click();
    await settle();
    await answerCardRead(MOUSE);
    expect(dialogs().length).toBe(1);
    await closeDialog(false);

    http.expectNone((request) => request.url === '/api/products');
  });

  it('marks each row ready or not ready from isReady with no way to switch it (AC-15)', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    expect(badge(0)).not.toBeNull();
    expect(badge(0)?.textContent.trim()).toContain('Готово');
    expect(badge(0)?.textContent).not.toContain('Неготово');
    expect(badge(1)?.textContent.trim()).toContain('Неготово');
    // The colour follows the state, so the two badges cannot look alike.
    expect(badge(0)?.className).not.toBe(badge(1)?.className);

    // Readiness is derived on read (ADR 0009): nothing in the row can set it.
    for (const row of rows()) {
      expect(
        row.querySelector('mat-slide-toggle, mat-checkbox, input[type="checkbox"]'),
      ).toBeNull();
    }
    expect(badge(1)?.closest('button, a')).toBeNull();
    expect(element.textContent).not.toContain('Позначити готовою');
  });

  it('shows the readiness the server reported rather than recomputing it (AC-15)', async () => {
    await open();
    // Every field is filled, yet the server says no: the badge believes the server.
    expectRequest().flush({ ...PAGE, items: [{ ...MOUSE, isReady: false }], total: 1 });
    await settle();

    expect(badge(0)).not.toBeNull();
    expect(badge(0)?.textContent.trim()).toContain('Неготово');
  });

  it('names the missing gallery on a card without frames (AC-15)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, items: [KEYBOARD], total: 1 });
    await settle();

    const hint = await missingHint(0);
    expect(hint).toContain('галерея');
    expect(hint).not.toContain('ціна');
    expect(hint).not.toContain('опис');
    expect(hint).not.toContain('заголовок');
  });

  it('names the missing price on a card priced at zero (AC-15)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, items: [UNPRICED], total: 1 });
    await settle();

    const hint = await missingHint(0);
    expect(hint).toContain('ціна');
    expect(hint).not.toContain('галерея');
    expect(hint).not.toContain('опис');
    expect(hint).not.toContain('заголовок');
  });

  it('names the one missing text on a card that lacks it (AC-15)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, items: [WITHOUT_OLX_DESCRIPTION], total: 1 });
    await settle();

    const hint = await missingHint(0);
    expect(hint).toContain('опис olx');
    expect(hint).not.toContain('опис prom');
    expect(hint).not.toContain('заголовок');
    expect(hint).not.toContain('ціна');
    expect(hint).not.toContain('галерея');
  });

  it('names every gap of an empty card (AC-15)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, items: [EMPTY_CARD], total: 1 });
    await settle();

    const hint = await missingHint(0);
    for (const gap of [
      'заголовок prom',
      'опис prom',
      'заголовок olx',
      'опис olx',
      'ціна',
      'галерея',
    ]) {
      expect(hint).toContain(gap);
    }
  });

  it('gives a ready card no list of gaps (AC-15)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, items: [MOUSE], total: 1 });
    await settle();

    expect(badge(0)).not.toBeNull();
    expect(await missingHint(0)).toBe('');
  });

  it('asks before deleting a card and re-reads the page once it is gone', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    const remove = deleteButton(0);
    expect(remove).not.toBeNull();
    remove?.click();
    await settle();

    // The row underneath must not take the click and open the form as well.
    expect(dialogs().length).toBe(1);
    expect(dialogs()[0]?.componentInstance).toBeInstanceOf(ConfirmDialog);
    http.expectNone(`/api/products/${MOUSE.id}`);

    await closeDialog(true);

    const deletion = http.expectOne(`/api/products/${MOUSE.id}`);
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);
    await tick();

    expectRequest().flush({ ...PAGE, items: [KEYBOARD], total: 1 });
    await settle();

    expect(rows().length).toBe(1);
    expect(element.textContent).not.toContain('Миша Logitech MX Master 3');
  });

  it('deletes nothing and keeps the page when the admin cancels', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    const remove = deleteButton(1);
    expect(remove).not.toBeNull();
    remove?.click();
    await settle();

    expect(dialogs()[0]?.componentInstance).toBeInstanceOf(ConfirmDialog);
    await closeDialog(false);

    http.expectNone(`/api/products/${KEYBOARD.id}`);
    http.expectNone((request) => request.url === '/api/products');
    expect(rows().length).toBe(2);
  });

  for (const [prom, olx] of [
    ['true', 'true'],
    ['true', 'false'],
    ['false', 'true'],
    ['false', 'false'],
  ] as const) {
    it(`sends publishedProm=${prom} and publishedOlx=${olx} as two separate filters (AC-13)`, async () => {
      await open();
      expectRequest().flush(PAGE);
      await settle();

      const label = (value: 'true' | 'false'): string => (value === 'true' ? 'Так' : 'Ні');
      await (await publishedSelect('publishedProm')).clickOptions({ text: label(prom) });
      await (await publishedSelect('publishedOlx')).clickOptions({ text: label(olx) });
      submitFilters();
      await tick();

      const request = expectRequest();
      expect(request.request.params.get('publishedProm')).toBe(prom);
      expect(request.request.params.get('publishedOlx')).toBe(olx);

      request.flush(PAGE);
      await settle();
    });
  }

  it('shows the main frame lazily, since only full-size originals are stored', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    const thumbnail = element.querySelector<HTMLImageElement>('.gallery-cell__thumb img');
    expect(thumbnail?.getAttribute('loading')).toBe('lazy');
  });

  it('keeps the card and explains why when storage refuses the deletion', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    deleteButton(0)?.click();
    await settle();
    await closeDialog(true);

    http
      .expectOne(`/api/products/${MOUSE.id}`)
      .flush(
        { error: { code: 'storage_unavailable', message: 'Storage is unavailable' } },
        { status: 502, statusText: 'Bad Gateway' },
      );
    await settle();

    http.expectNone((request) => request.url === '/api/products');
    expect(rows().length).toBe(2);
    expect(element.querySelector('[data-testid="delete-error"]')?.textContent).toContain(
      'Сховище фото недоступне, картку не видалено.',
    );
  });

  it('re-reads the page without an error when the card was already deleted', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    deleteButton(0)?.click();
    await settle();
    await closeDialog(true);

    http
      .expectOne(`/api/products/${MOUSE.id}`)
      .flush(
        { error: { code: 'product_not_found', message: 'Product not found' } },
        { status: 404, statusText: 'Not Found' },
      );
    await tick();

    expectRequest().flush({ ...PAGE, items: [KEYBOARD], total: 1 });
    await settle();

    expect(rows().length).toBe(1);
    expect(element.querySelector('[data-testid="delete-error"]')).toBeNull();
  });

  const PAGINATOR_LABELS = {
    top: 'Верхній пагінатор каталогу',
    bottom: 'Нижній пагінатор каталогу',
  } as const;

  function paginator(position: keyof typeof PAGINATOR_LABELS): Promise<MatPaginatorHarness> {
    return TestbedHarnessEnvironment.loader(harness.fixture).getHarness(
      MatPaginatorHarness.with({ selector: `[aria-label="${PAGINATOR_LABELS[position]}"]` }),
    );
  }

  async function paginatorState(
    position: keyof typeof PAGINATOR_LABELS,
  ): Promise<{ range: string; pageSize: number }> {
    const found = await paginator(position);
    return { range: await found.getRangeLabel(), pageSize: await found.getPageSize() };
  }

  it('shows the same page, size and total above the table and below it (AC-51)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, total: 100 });
    await settle();

    const all = await TestbedHarnessEnvironment.loader(harness.fixture).getAllHarnesses(
      MatPaginatorHarness,
    );
    expect(all.length).toBe(2);

    expect(await paginatorState('top')).toEqual({ range: '1–20 з 100', pageSize: 20 });
    expect(await paginatorState('bottom')).toEqual({ range: '1–20 з 100', pageSize: 20 });

    const top = element.querySelector(`mat-paginator[aria-label="${PAGINATOR_LABELS.top}"]`);
    const bottom = element.querySelector(`mat-paginator[aria-label="${PAGINATOR_LABELS.bottom}"]`);
    const table = element.querySelector('table');
    expect(top?.compareDocumentPosition(table!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(table?.compareDocumentPosition(bottom!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('moves the URL, the request and the bottom paginator to the page chosen above (AC-51)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, total: 100 });
    await settle();

    // The harness waits for the app to settle after the click, and the app cannot settle until
    // the request the click started is answered — so the answer goes out before the await.
    const moving = (await paginator('top')).goToNextPage();
    await tick();

    expect(TestBed.inject(Router).url).toBe('/products?page=2');
    const request = expectRequest();
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ ...PAGE, page: 2, total: 100 });
    await moving;
    await settle();

    expect(await paginatorState('bottom')).toEqual({ range: '21–40 з 100', pageSize: 20 });
    expect(await paginatorState('top')).toEqual({ range: '21–40 з 100', pageSize: 20 });
  });

  it('moves the URL, the request and the bottom paginator to the size chosen above (AC-51)', async () => {
    await open();
    expectRequest().flush({ ...PAGE, total: 100 });
    await settle();

    const resizing = (await paginator('top')).setPageSize(10);
    await tick();

    expect(TestBed.inject(Router).url).toBe('/products?pageSize=10');
    const request = expectRequest();
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ ...PAGE, pageSize: 10, total: 100 });
    await resizing;
    await settle();

    expect(await paginatorState('bottom')).toEqual({ range: '1–10 з 100', pageSize: 10 });
    expect(await paginatorState('top')).toEqual({ range: '1–10 з 100', pageSize: 10 });
  });

  it('reopens both paginators on the page and size a reloaded address carries (AC-51)', async () => {
    await open('/products?page=2&pageSize=10');
    expectRequest().flush({ ...PAGE, page: 2, pageSize: 10, total: 100 });
    await settle();

    expect(await paginatorState('top')).toEqual({ range: '11–20 з 100', pageSize: 10 });
    expect(await paginatorState('bottom')).toEqual({ range: '11–20 з 100', pageSize: 10 });
  });

  it('keeps the current rows and total on screen while the next page loads, with the loader inside the table', async () => {
    await open();
    expectRequest().flush({ ...PAGE, total: 100 });
    await settle();

    const moving = (await paginator('top')).goToNextPage();
    await tick();

    // An emptied table shrinks the page and the filters jump with it until the answer arrives.
    expect(rows().length).toBe(2);
    const ranges = [...element.querySelectorAll('.mat-mdc-paginator-range-label')].map((label) =>
      label.textContent.trim(),
    );
    expect(ranges).toEqual(['21–40 з 100', '21–40 з 100']);
    expect(element.querySelector('.catalog__scroll mat-progress-bar')).not.toBeNull();
    expect(element.querySelectorAll('mat-progress-bar').length).toBe(1);
    // The one change outside the table the admin should see: the filters wait for the answer.
    const filterButtons = [
      ...element.querySelectorAll<HTMLButtonElement>('.filters__actions button'),
    ];
    expect(filterButtons.map((button) => button.disabled)).toEqual([true, true]);

    expectRequest().flush({ ...PAGE, page: 2, total: 100 });
    await moving;
    await settle();

    expect(element.querySelector('mat-progress-bar')).toBeNull();
  });
});
