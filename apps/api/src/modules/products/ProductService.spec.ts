import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProductCreate, ProductListQuery } from '../../contracts/products.contract.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { MediaService, StorageUnavailable, type ImageStorage } from '../media/index.ts';
import type { Product, ProductPage } from './Product.ts';
import { GalleryFull, ImageNotFound, ProductNotFound } from './ProductErrors.ts';
import type { ProductImage } from './ProductImage.ts';
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
    promId: null,
    olxId: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    images: [
      {
        id: '01931f2a-2222-7000-8000-000000000001',
        productId: CARD_ID,
        r2Key: `products/${CARD_ID}/front.jpg`,
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
  readonly addedImages: ProductImage[] = [];
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

  override async findImage(productId: string, imageId: string): Promise<ProductImage | null> {
    return this.galleryOf(productId).find((image) => image.id === imageId) ?? null;
  }

  override async setMainImage(productId: string, imageId: string): Promise<boolean> {
    const gallery = this.galleryOf(productId);
    if (!gallery.some((image) => image.id === imageId)) {
      return false;
    }
    for (const image of gallery) {
      image.isMain = image.id === imageId;
    }
    return true;
  }

  override async countImages(productId: string): Promise<number> {
    return this.galleryOf(productId).length;
  }

  lastMaxImages: number | undefined;
  /** Stands for a gallery that another request filled between the service's check and the insert. */
  fullOnInsert = false;
  insertFailure: Error | undefined;

  /** Mirrors the repository's rules; the real ones run against Postgres in its own spec. */
  override async addImage(
    productId: string,
    r2Key: string,
    maxImages: number,
  ): Promise<ProductImage | null> {
    this.lastMaxImages = maxImages;
    if (this.insertFailure !== undefined) {
      throw this.insertFailure;
    }
    const gallery = this.galleryOf(productId);
    if (this.fullOnInsert || gallery.length >= maxImages) {
      return null;
    }
    const image: ProductImage = {
      id: `01931f2a-2222-7000-8000-${String(this.addedImages.length + 100).padStart(12, '0')}`,
      productId,
      r2Key,
      position: gallery.reduce((next, frame) => Math.max(next, frame.position + 1), 0),
      isMain: gallery.length === 0,
    };
    this.addedImages.push(image);
    this.galleryOf(productId).push(image);
    return image;
  }

  deleteFailure: Error | undefined;

  override async deleteImage(imageId: string): Promise<boolean> {
    if (this.deleteFailure !== undefined) {
      throw this.deleteFailure;
    }
    const gallery = this.stored?.images ?? [];
    const index = gallery.findIndex((image) => image.id === imageId);
    if (index === -1) {
      return false;
    }
    gallery.splice(index, 1);
    return true;
  }

  override async findImageKeys(productId: string): Promise<string[]> {
    return this.galleryOf(productId).map((image) => image.r2Key);
  }

  /** The frames go with the card, as `on delete cascade` takes them in Postgres. */
  override async delete(id: string): Promise<boolean> {
    if (this.stored?.id !== id) {
      return false;
    }
    this.stored = null;
    return true;
  }

  /** Mirrors the repository: the keys, then the removal, then the card — nothing after a failure. */
  override async deleteWithObjects(
    id: string,
    removeObjects: (keys: string[]) => Promise<void>,
  ): Promise<boolean> {
    if (!(await this.findById(id).then((product) => product !== null))) {
      return false;
    }
    await removeObjects(await this.findImageKeys(id));
    return this.delete(id);
  }

  private galleryOf(productId: string): ProductImage[] {
    return this.stored?.id === productId ? this.stored.images : [];
  }
}

/** The storage is never reached: every media method the service calls is overridden. */
const NO_STORAGE = undefined as unknown as ImageStorage;

class RecordingMediaService extends MediaService {
  readonly stored: { bytes: Uint8Array; key: string }[] = [];
  readonly removed: string[] = [];
  failure: Error | undefined;

  constructor() {
    super(NO_STORAGE);
  }

  override async store(bytes: Uint8Array, key: string): Promise<string> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.stored.push({ bytes, key });
    return key;
  }

  removeFailure: Error | undefined;
  /** Called at the moment of removal, before the key is recorded. */
  onRemove: (() => void) | undefined;

  override async remove(key: string): Promise<void> {
    this.onRemove?.();
    if (this.removeFailure !== undefined) {
      throw this.removeFailure;
    }
    this.removed.push(key);
  }

  /** One entry per call, so a test can tell one batch from many single removals. */
  readonly removedBatches: string[][] = [];

  override async removeMany(keys: readonly string[]): Promise<void> {
    this.onRemove?.();
    if (this.removeFailure !== undefined) {
      throw this.removeFailure;
    }
    this.removedBatches.push([...keys]);
  }
}

const BASE_QUERY: ProductListQuery = {
  page: 1,
  pageSize: 20,
  sort: 'titleProm',
  direction: 'asc',
};

function setup(): {
  service: ProductService;
  repository: StubProductRepository;
  media: RecordingMediaService;
} {
  const repository = new StubProductRepository();
  const media = new RecordingMediaService();
  return { service: new ProductService(repository, media), repository, media };
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

  it('does not treat a card without a Prom title as ready (AC-36)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard({ titleProm: '' })), false);
  });

  it('does not treat a card without an OLX title as ready (AC-36)', () => {
    const { service } = setup();

    assert.equal(service.isReady(readyCard({ titleOlx: '' })), false);
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

const FRONT_ID = '01931f2a-2222-7000-8000-000000000001';
const BACK_ID = '01931f2a-2222-7000-8000-000000000002';
const FOREIGN_IMAGE_ID = '01931f2a-2222-7000-8000-000000000099';

/** Two frames, the front one main: the state AC-03 starts from. */
function twoFrameCard(): Product {
  return readyCard({
    images: [
      {
        id: FRONT_ID,
        productId: CARD_ID,
        r2Key: `products/${CARD_ID}/front.jpg`,
        position: 0,
        isMain: true,
      },
      {
        id: BACK_ID,
        productId: CARD_ID,
        r2Key: `products/${CARD_ID}/back.jpg`,
        position: 1,
        isMain: false,
      },
    ],
  });
}

function mainFlags(gallery: readonly ProductImage[]): Record<string, boolean> {
  return Object.fromEntries(gallery.map((image) => [image.id, image.isMain]));
}

describe('product service: main frame', () => {
  it('makes the chosen frame the only main one and returns the whole gallery (AC-03)', async () => {
    const { service, repository } = setup();
    repository.stored = twoFrameCard();

    const gallery = await service.setMainImage(CARD_ID, BACK_ID);

    assert.deepEqual(mainFlags(gallery), { [FRONT_ID]: false, [BACK_ID]: true });
  });

  it('gives the same gallery when the frame that is already main is chosen again', async () => {
    const { service, repository } = setup();
    repository.stored = twoFrameCard();

    const first = await service.setMainImage(CARD_ID, FRONT_ID);
    const second = await service.setMainImage(CARD_ID, FRONT_ID);

    assert.deepEqual(mainFlags(first), { [FRONT_ID]: true, [BACK_ID]: false });
    assert.deepEqual(second, first);
  });

  it('refuses a frame that does not belong to the card', async () => {
    const { service, repository } = setup();
    repository.stored = twoFrameCard();

    await assert.rejects(service.setMainImage(CARD_ID, FOREIGN_IMAGE_ID), ImageNotFound);
    assert.deepEqual(mainFlags(repository.stored.images), { [FRONT_ID]: true, [BACK_ID]: false });
  });
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

/** A card whose gallery already holds `count` frames, the first of them main. */
function cardWithFrames(count: number): Product {
  return readyCard({
    images: Array.from({ length: count }, (_, position) => ({
      id: `01931f2a-2222-7000-8000-${String(position + 1).padStart(12, '0')}`,
      productId: CARD_ID,
      r2Key: `products/${CARD_ID}/frame-${String(position)}.jpg`,
      position,
      isMain: position === 0,
    })),
  });
}

describe('product service: adding a frame', () => {
  it('refuses a frame for a card that does not exist, before touching storage', async () => {
    const { service, repository, media } = setup();

    await assert.rejects(
      service.addImage('01931f2a-1111-7000-8000-000000000999', JPEG),
      ProductNotFound,
    );
    assert.equal(media.stored.length, 0);
    assert.equal(repository.addedImages.length, 0);
  });

  it('stores the file under a key of the card and adds the frame after the last one (AC-01)', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();

    const image = await service.addImage(CARD_ID, JPEG);

    assert.equal(media.stored.length, 1);
    assert.equal(media.stored[0]?.bytes, JPEG);
    const key = media.stored[0].key;
    assert.match(key, new RegExp(`^products/${CARD_ID}/[^/]+$`));
    assert.equal(image.productId, CARD_ID);
    assert.equal(image.r2Key, key);
    assert.equal(image.position, 2);
    assert.deepEqual(repository.stored.images.map((frame) => frame.id).slice(0, 2), [
      FRONT_ID,
      BACK_ID,
    ]);
    assert.equal(repository.stored.images.length, 3);
  });

  it('makes the first frame of an empty gallery the main one (AC-19)', async () => {
    const { service, repository } = setup();
    repository.stored = readyCard({ images: [] });

    const image = await service.addImage(CARD_ID, JPEG);

    assert.equal(image.isMain, true);
    assert.equal(image.position, 0);
  });

  it('does not make a frame main when the gallery already has one (AC-19)', async () => {
    const { service, repository } = setup();
    repository.stored = twoFrameCard();

    const image = await service.addImage(CARD_ID, JPEG);

    assert.equal(image.isMain, false);
    assert.deepEqual(mainFlags(repository.stored.images.slice(0, 2)), {
      [FRONT_ID]: true,
      [BACK_ID]: false,
    });
  });

  it('accepts the tenth frame (AC-02)', async () => {
    const { service, repository } = setup();
    repository.stored = cardWithFrames(9);

    const image = await service.addImage(CARD_ID, JPEG);

    assert.equal(image.position, 9);
    assert.equal(repository.stored.images.length, 10);
  });

  it('refuses an eleventh frame without storing it and keeps the ten in place (AC-02)', async () => {
    const { service, repository, media } = setup();
    repository.stored = cardWithFrames(10);

    await assert.rejects(service.addImage(CARD_ID, JPEG), GalleryFull);
    assert.equal(media.stored.length, 0);
    assert.equal(repository.addedImages.length, 0);
    assert.deepEqual(repository.stored.images, cardWithFrames(10).images);
  });

  it('hands the gallery ceiling to the repository, which decides under a lock (AC-02)', async () => {
    const { service, repository } = setup();
    repository.stored = twoFrameCard();

    await service.addImage(CARD_ID, JPEG);

    assert.equal(repository.lastMaxImages, productConstraints.maxImagesPerProduct);
  });

  it('removes the stored object when the gallery filled up meanwhile (AC-02)', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();
    repository.fullOnInsert = true;

    await assert.rejects(service.addImage(CARD_ID, JPEG), GalleryFull);
    assert.deepEqual(media.removed, [media.stored[0]?.key]);
  });

  it('removes the stored object and reports the original failure when the row cannot be written', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();
    const failure = new Error('connection terminated');
    repository.insertFailure = failure;

    await assert.rejects(service.addImage(CARD_ID, JPEG), (error) => error === failure);
    assert.deepEqual(media.removed, [media.stored[0]?.key]);
  });

  it('writes no frame row when storage is unavailable (DoD, QG-1)', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();
    media.failure = new StorageUnavailable(new Error('getaddrinfo ENOTFOUND'));

    await assert.rejects(service.addImage(CARD_ID, JPEG), StorageUnavailable);
    assert.equal(repository.addedImages.length, 0);
    assert.equal(repository.stored.images.length, 2);
  });
});

describe('product service: deleting a frame', () => {
  it('removes the object of the frame and then its row, leaving the rest of the gallery (AC-16)', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();

    await service.deleteImage(CARD_ID, BACK_ID);

    assert.deepEqual(media.removed, [`products/${CARD_ID}/back.jpg`]);
    assert.deepEqual(
      repository.stored.images.map((image) => image.id),
      [FRONT_ID],
    );
  });

  it('removes the object while the row of the frame is still in place (AC-16)', async () => {
    const { service, repository, media } = setup();
    const stored = twoFrameCard();
    repository.stored = stored;
    let rowPresentAtRemoval: boolean | undefined;
    media.onRemove = () => {
      rowPresentAtRemoval = stored.images.some((image) => image.id === BACK_ID);
    };

    await service.deleteImage(CARD_ID, BACK_ID);

    assert.equal(rowPresentAtRemoval, true);
  });

  it('keeps the row when storage is unavailable and reports storage_unavailable (AC-17)', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();
    media.removeFailure = new StorageUnavailable(new Error('getaddrinfo ENOTFOUND'));

    await assert.rejects(service.deleteImage(CARD_ID, BACK_ID), StorageUnavailable);
    assert.deepEqual(repository.stored.images, twoFrameCard().images);
  });

  it('deletes the frame on a repeat once its object is already gone', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();
    const failure = new Error('connection terminated');
    repository.deleteFailure = failure;

    await assert.rejects(service.deleteImage(CARD_ID, BACK_ID), (error) => error === failure);
    assert.equal(repository.stored.images.length, 2);

    repository.deleteFailure = undefined;
    await service.deleteImage(CARD_ID, BACK_ID);

    assert.deepEqual(media.removed, [
      `products/${CARD_ID}/back.jpg`,
      `products/${CARD_ID}/back.jpg`,
    ]);
    assert.deepEqual(
      repository.stored.images.map((image) => image.id),
      [FRONT_ID],
    );
  });

  it('refuses a frame that does not belong to the card without touching storage', async () => {
    const { service, repository, media } = setup();
    repository.stored = twoFrameCard();

    await assert.rejects(service.deleteImage(CARD_ID, FOREIGN_IMAGE_ID), ImageNotFound);
    assert.deepEqual(media.removed, []);
    assert.equal(repository.stored.images.length, 2);
  });
});

describe('product service: deleting a card', () => {
  it('removes every object of a ten-frame card in a single batch and then the card (AC-18)', async () => {
    const { service, repository, media } = setup();
    repository.stored = cardWithFrames(10);

    await service.deleteProduct(CARD_ID);

    assert.deepEqual(media.removedBatches, [cardWithFrames(10).images.map((image) => image.r2Key)]);
    assert.deepEqual(media.removed, []);
    assert.equal(await repository.findById(CARD_ID), null);
  });

  it('removes the objects while the card row is still in place (AC-18)', async () => {
    const { service, repository, media } = setup();
    repository.stored = cardWithFrames(10);
    let cardPresentAtRemoval: boolean | undefined;
    media.onRemove = () => {
      cardPresentAtRemoval = repository.stored !== null;
    };

    await service.deleteProduct(CARD_ID);

    assert.equal(cardPresentAtRemoval, true);
  });

  it('deletes a card that has no frames without removing any object (AC-18)', async () => {
    const { service, repository, media } = setup();
    repository.stored = readyCard({ images: [] });

    await service.deleteProduct(CARD_ID);

    assert.equal(await repository.findById(CARD_ID), null);
    assert.deepEqual(media.removedBatches.flat(), []);
    assert.deepEqual(media.removed, []);
  });

  it('deletes nothing when storage is unavailable and reports storage_unavailable (AC-17)', async () => {
    const { service, repository, media } = setup();
    repository.stored = cardWithFrames(10);
    media.removeFailure = new StorageUnavailable(new Error('getaddrinfo ENOTFOUND'));

    await assert.rejects(service.deleteProduct(CARD_ID), StorageUnavailable);
    assert.deepEqual(repository.stored, cardWithFrames(10));
  });

  it('refuses to delete a card that does not exist', async () => {
    const { service, repository } = setup();
    repository.stored = null;

    await assert.rejects(service.deleteProduct(CARD_ID), ProductNotFound);
  });
});
