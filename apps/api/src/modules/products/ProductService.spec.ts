import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProductCreate, ProductListQuery } from '../../contracts/products.contract.ts';
import type { Product, ProductPage } from './Product.ts';
import { ProductNotFound } from './ProductErrors.ts';
import {
  ProductRepository,
  type ProductChanges,
  type ProductDraft,
  type ProductListCriteria,
} from './ProductRepository.ts';
import { ProductService } from './ProductService.ts';

/**
 * For the catalog, only the translation of a validated flat query into repository criteria is
 * checked here — how a filter behaves is SQL's answer, checked against a real Postgres in
 * `ProductRepository.spec.ts`.
 */

/** The DataSource is never reached: every repository method the service calls is overridden. */
const NO_DATA_SOURCE = undefined as unknown as ConstructorParameters<typeof ProductRepository>[0];

const CARD_ID = '01931f2a-1111-7000-8000-000000000001';

/** A card that is ready on all three inputs; each readiness test takes exactly one of them away. */
function readyCard(overrides: Partial<Product> = {}): Product {
  return {
    id: CARD_ID,
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова миша, стан відмінний.',
    titleOlx: 'Миша Logitech MX Master 3 бездротова',
    descriptionOlx: 'Продаю бездротову мишу, стан відмінний.',
    price: '2499.00',
    seoKeywords: ['миша', 'logitech'],
    category: 'Периферія',
    publishedProm: false,
    publishedOlx: false,
    condition: 'used',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    images: [
      {
        id: '01931f2a-2222-7000-8000-000000000001',
        productId: CARD_ID,
        r2Key: `products/${CARD_ID}/front.jpg`,
        url: `https://img.mouse.springconsult.com.ua/products/${CARD_ID}/front.jpg`,
        position: 0,
        isMain: true,
      },
    ],
    ...overrides,
  };
}

function keywords(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `ключове слово ${String(index + 1)}`);
}

const CREATE_INPUT: ProductCreate = {
  titleProm: 'Миша Logitech MX Master 3',
  titleOlx: 'Миша Logitech MX Master 3 бездротова',
  category: 'Периферія',
  descriptionProm: '',
  descriptionOlx: '',
  price: '0.00',
  seoKeywords: [],
  condition: 'used',
};

class StubProductRepository extends ProductRepository {
  lastCriteria: ProductListCriteria | undefined;
  lastDraft: ProductDraft | undefined;
  lastChanges: ProductChanges | undefined;
  /** The one card this repository holds; `null` stands for an empty table. */
  stored: Product | null = readyCard();

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async list(criteria: ProductListCriteria): Promise<ProductPage> {
    this.lastCriteria = criteria;
    return { items: [], total: 0, page: criteria.page, pageSize: criteria.pageSize };
  }

  override async findById(id: string): Promise<Product | null> {
    return this.stored?.id === id ? this.stored : null;
  }

  override async create(draft: ProductDraft): Promise<Product> {
    this.lastDraft = draft;
    return readyCard({ images: [] });
  }

  override async update(id: string, changes: ProductChanges): Promise<Product | null> {
    this.lastChanges = changes;
    return this.stored?.id === id ? this.stored : null;
  }
}

const BASE_QUERY: ProductListQuery = {
  page: 1,
  pageSize: 20,
  sort: 'titleProm',
  direction: 'asc',
};

function setup(): { service: ProductService; repository: StubProductRepository } {
  const repository = new StubProductRepository();
  return { service: new ProductService(repository), repository };
}

describe('product service', () => {
  it('splits a query into pagination, ordering and filters', async () => {
    const { service, repository } = setup();

    await service.list({ ...BASE_QUERY, page: 3, pageSize: 5, sort: 'price', direction: 'desc' });

    assert.deepEqual(repository.lastCriteria, {
      page: 3,
      pageSize: 5,
      sort: 'price',
      direction: 'desc',
      filters: {},
    });
  });

  it('passes every filter of the query through to the repository', async () => {
    const { service, repository } = setup();

    await service.list({
      ...BASE_QUERY,
      title: 'миша',
      description: 'бездротова',
      priceMin: '100.00',
      priceMax: '5000.00',
      category: 'Периферія',
      publishedProm: true,
      publishedOlx: false,
    });

    assert.deepEqual(repository.lastCriteria?.filters, {
      title: 'миша',
      description: 'бездротова',
      priceMin: '100.00',
      priceMax: '5000.00',
      category: 'Периферія',
      publishedProm: true,
      publishedOlx: false,
    });
  });

  it('does not turn a filter that was not sent into a condition', async () => {
    const { service, repository } = setup();

    await service.list({ ...BASE_QUERY, title: 'миша' });

    // An absent filter must not arrive as `undefined` either: the repository asks
    // `!== undefined`, but `Object.keys` on the criteria is what a future writer reads.
    assert.deepEqual(Object.keys(repository.lastCriteria?.filters ?? {}), ['title']);
  });

  it('returns the page the repository produced', async () => {
    const { service } = setup();

    const page = await service.list({ ...BASE_QUERY, page: 2, pageSize: 5 });

    assert.deepEqual(page, { items: [], total: 0, page: 2, pageSize: 5 });
  });
});

describe('product service: keywords', () => {
  it('keeps the first thirty keywords of a new card and reports the rest (AC-07)', async () => {
    const { service, repository } = setup();

    const saved = await service.create({ ...CREATE_INPUT, seoKeywords: keywords(31) });

    assert.deepEqual(repository.lastDraft?.seoKeywords, keywords(30));
    assert.equal(saved.discardedKeywordsCount, 1);
  });

  it('keeps the first thirty keywords on save and reports the rest (AC-07)', async () => {
    const { service, repository } = setup();

    const saved = await service.update(CARD_ID, { seoKeywords: keywords(31) });

    assert.deepEqual(repository.lastChanges?.seoKeywords, keywords(30));
    assert.equal(saved.discardedKeywordsCount, 1);
  });

  it('discards nothing when a save carries exactly thirty keywords (AC-07)', async () => {
    const { service, repository } = setup();

    const saved = await service.update(CARD_ID, { seoKeywords: keywords(30) });

    assert.deepEqual(repository.lastChanges?.seoKeywords, keywords(30));
    assert.equal(saved.discardedKeywordsCount, 0);
  });

  it('leaves the keywords alone when a save does not carry them (AC-07)', async () => {
    const { service, repository } = setup();

    const saved = await service.update(CARD_ID, { price: '100.00' });

    assert.deepEqual(repository.lastChanges, { price: '100.00' });
    assert.equal(saved.discardedKeywordsCount, 0);
  });
});

describe('product service: readiness', () => {
  it('treats a card with both descriptions, a price and a frame as ready (AC-15)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard()), true);
  });

  it('does not treat a card without a Prom description as ready (AC-15)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard({ descriptionProm: '' })), false);
  });

  it('does not treat a card without an OLX description as ready (AC-15)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard({ descriptionOlx: '' })), false);
  });

  it('reads a zero price as not set and does not treat the card as ready (AC-15)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard({ price: '0.00' })), false);
  });

  it('does not treat a card without a single frame as ready (AC-15)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard({ images: [] })), false);
  });

  it('reads a card together with its derived readiness (AC-15)', async () => {
    const { service, repository } = setup();

    const ready = await service.getById(CARD_ID);
    assert.deepEqual(ready.product, readyCard());
    assert.equal(ready.isReady, true);

    repository.stored = readyCard({ images: [] });
    const withoutFrames = await service.getById(CARD_ID);
    assert.equal(withoutFrames.isReady, false);
  });

  it('refuses to read a card that does not exist', async () => {
    const { service, repository } = setup();
    repository.stored = null;

    await assert.rejects(service.getById(CARD_ID), ProductNotFound);
  });

  it('returns the saved card together with its readiness (AC-15)', async () => {
    const { service, repository } = setup();
    repository.stored = readyCard({ price: '0.00' });

    const saved = await service.update(CARD_ID, { descriptionProm: 'Оновлений опис.' });

    assert.deepEqual(saved.product, readyCard({ price: '0.00' }));
    assert.equal(saved.isReady, false);
  });
});
