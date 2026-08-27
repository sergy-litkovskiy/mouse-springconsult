import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
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
  published: true,
  accountProm: 'prom-main',
  accountOlx: 'olx-main',
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
  published: false,
  accountProm: null,
  accountOlx: null,
  condition: 'new',
  images: [],
};

const PAGE: ProductList = { items: [MOUSE, KEYBOARD], total: 2, page: 1, pageSize: 20 };

describe('ProductCatalog', () => {
  let fixture: ComponentFixture<ProductCatalog>;
  let http: HttpTestingController;
  let element: HTMLElement;

  /**
   * Loading is asynchronous, so a single whenStable() is not enough: the microtask queue
   * has to drain before the table reflects the response.
   */
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProductCatalog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ProductCatalog);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('asks for the first page with the default ordering', async () => {
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

  it('renders a row per product with the price and the condition in Ukrainian', async () => {
    expectRequest().flush(PAGE);
    await settle();

    expect(element.querySelectorAll('tr[mat-row]').length).toBe(2);
    expect(element.textContent).toContain('Миша Logitech MX Master 3');
    expect(element.textContent).toContain('Keychron K2 механічна');
    expect(element.textContent).toContain('Вживаний');
    expect(element.textContent).toContain('Новий');
    expect(element.textContent).toContain('Чернетка');
    expect(element.textContent).toContain('Знайдено: 2');
  });

  it('shows the main frame as the thumbnail and the total number of images beside it', async () => {
    expectRequest().flush(PAGE);
    await settle();

    const thumbnails = element.querySelectorAll<HTMLImageElement>('.gallery-cell__thumb');
    // The main image is second in the array — the thumbnail follows isMain, not position.
    expect(thumbnails[0]?.src).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    const counters = element.querySelectorAll<HTMLButtonElement>('.gallery-cell__count');
    expect(counters[0]?.textContent.trim()).toBe('3');
    expect(counters[1]?.textContent.trim()).toBe('0');
    // A card without photographs has nothing to open.
    expect(counters[1]?.disabled).toBe(true);
  });

  it('opens the gallery dialog when the image count is clicked', async () => {
    expectRequest().flush(PAGE);
    await settle();

    element.querySelector<HTMLButtonElement>('.gallery-cell__count')?.click();
    await settle();

    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    TestBed.inject(MatDialog).closeAll();
    await settle();
  });

  it('sends only the filters that were filled in and returns to the first page', async () => {
    expectRequest().flush({ ...PAGE, page: 2 });
    await settle();

    type('title', '  миша  ');
    type('priceMin', '1000');
    submitFilters();
    await settle();

    const request = expectRequest();
    expect(request.request.params.get('title')).toBe('миша');
    // The price travels as the decimal the admin typed; nothing rescales it on the way.
    expect(request.request.params.get('priceMin')).toBe('1000');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.has('description')).toBe(false);
    expect(request.request.params.has('priceMax')).toBe(false);

    request.flush({ ...PAGE, items: [MOUSE], total: 1 });
    await settle();

    expect(element.querySelectorAll('tr[mat-row]').length).toBe(1);
  });

  it('reports a failure instead of leaving stale rows on screen', async () => {
    expectRequest().flush(PAGE);
    await settle();

    type('title', 'нічого');
    submitFilters();
    await settle();

    expectRequest().flush(
      { error: { code: 'not_authenticated', message: 'Authentication required' } },
      { status: 401, statusText: 'Unauthorized' },
    );
    await settle();

    expect(element.textContent).toContain('Сесія завершилась');
    expect(element.querySelectorAll('tr[mat-row]').length).toBe(0);
  });
});
