import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Product, ProductList } from '@contracts/products.contract';
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

const MOUSE: Product = {
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
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

const KEYBOARD: Product = {
  ...MOUSE,
  id: '22222222-2222-4222-8222-222222222222',
  titleProm: 'Клавіатура Keychron K2',
  titleOlx: 'Keychron K2 механічна',
  price: '3200.00',
  publishedProm: false,
  publishedOlx: false,
  condition: 'new',
  images: [],
};

const PAGE: ProductList = { items: [MOUSE, KEYBOARD], total: 2, page: 1, pageSize: 20 };

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
    const cells = [...(firstRow?.querySelectorAll('td') ?? [])].map((cell) =>
      cell.textContent.trim(),
    );
    expect(cells.at(-2)).toBe('Опубліковано');
    expect(cells.at(-1)).toBe('Ні');
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

  it('opens the gallery dialog when the image count is clicked', async () => {
    await open();
    expectRequest().flush(PAGE);
    await settle();

    element.querySelector<HTMLButtonElement>('.gallery-cell__count')?.click();
    await settle();

    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
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
});
