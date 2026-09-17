import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  Product,
  ProductCreate,
  ProductImage,
  ProductUpdate,
  ProductUpdateResponse,
} from '@contracts/products.contract';
import { firstValueFrom } from 'rxjs';
import { ProductsApi } from './products-api';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const IMAGE: ProductImage = {
  id: IMAGE_ID,
  r2Key: `products/${PRODUCT_ID}/${IMAGE_ID}.jpg`,
  url: `https://r2.example.com/products/${PRODUCT_ID}/${IMAGE_ID}.jpg`,
  position: 0,
  isMain: true,
};

const PRODUCT: Product = {
  id: PRODUCT_ID,
  titleProm: 'Миша Logitech MX Master 3',
  descriptionProm: 'Бездротова миша у відмінному стані.',
  titleOlx: 'Logitech MX Master 3 бездротова',
  descriptionOlx: 'Продам мишу, повний комплект.',
  price: '2499.00',
  seoKeywords: ['миша', 'logitech'],
  category: 'Периферія',
  publishedProm: false,
  publishedOlx: false,
  condition: 'used',
  images: [IMAGE],
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

describe('ProductsApi', () => {
  let api: ProductsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ProductsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads one card by its id (getProduct)', async () => {
    const pending = firstValueFrom(api.getById(PRODUCT_ID));
    const request = http.expectOne(`/api/products/${PRODUCT_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush(PRODUCT);

    expect(await pending).toEqual(PRODUCT);
  });

  it('creates a card from the given fields (createProduct)', async () => {
    const body: ProductCreate = {
      titleProm: PRODUCT.titleProm,
      titleOlx: PRODUCT.titleOlx,
      category: PRODUCT.category,
      descriptionProm: '',
      descriptionOlx: '',
      price: '0.00',
      seoKeywords: [],
      condition: 'used',
    };

    const pending = firstValueFrom(api.create(body));
    const request = http.expectOne('/api/products');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(PRODUCT, { status: 201, statusText: 'Created' });

    expect(await pending).toEqual(PRODUCT);
  });

  it('saves a hand-written card with the same PATCH that accepting a suggestion uses (AC-12)', async () => {
    const body: ProductUpdate = {
      descriptionProm: 'Опис для Prom, написаний вручну.',
      descriptionOlx: 'Опис для OLX, написаний вручну.',
      seoKeywords: ['миша', 'бездротова'],
      price: '2499.00',
    };
    const saved: ProductUpdateResponse = {
      ...PRODUCT,
      ...body,
      isReady: true,
      discardedKeywordsCount: 0,
    };

    const pending = firstValueFrom(api.update(PRODUCT_ID, body));
    const request = http.expectOne(`/api/products/${PRODUCT_ID}`);
    expect(request.request.method).toBe('PATCH');
    // The price stays the decimal string the admin typed: nothing on the way may turn it into a number.
    expect(request.request.body).toEqual(body);
    request.flush(saved);

    expect(await pending).toEqual(saved);
  });

  it('deletes a card and completes on the empty answer (deleteProduct)', async () => {
    const pending = firstValueFrom(api.delete(PRODUCT_ID));
    const request = http.expectOne(`/api/products/${PRODUCT_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(await pending).toBeNull();
  });

  it('uploads a frame as multipart form data under the file field (uploadProductImage)', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'mouse.jpg', {
      type: 'image/jpeg',
    });

    const pending = firstValueFrom(api.uploadImage(PRODUCT_ID, file));
    const request = http.expectOne(`/api/products/${PRODUCT_ID}/images`);
    expect(request.request.method).toBe('POST');
    const body: unknown = request.request.body;
    expect(body).toBeInstanceOf(FormData);
    const sent = (body as FormData).get('file');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('mouse.jpg');
    expect((sent as File).size).toBe(file.size);
    request.flush(IMAGE, { status: 201, statusText: 'Created' });

    expect(await pending).toEqual(IMAGE);
  });

  it('makes a frame the main one and returns the updated gallery (setMainProductImage)', async () => {
    const gallery: ProductImage[] = [
      { ...IMAGE, isMain: true },
      {
        ...IMAGE,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        position: 1,
        isMain: false,
      },
    ];

    const pending = firstValueFrom(api.setMainImage(PRODUCT_ID, IMAGE_ID));
    const request = http.expectOne(`/api/products/${PRODUCT_ID}/images/${IMAGE_ID}/main`);
    expect(request.request.method).toBe('PUT');
    request.flush(gallery);

    expect(await pending).toEqual(gallery);
  });

  it('deletes a frame and completes on the empty answer (deleteProductImage)', async () => {
    const pending = firstValueFrom(api.deleteImage(PRODUCT_ID, IMAGE_ID));
    const request = http.expectOne(`/api/products/${PRODUCT_ID}/images/${IMAGE_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(await pending).toBeNull();
  });
});
