import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import type {
  ProductList,
  ProductImage as ProductImageResponse,
  ProductUpdateResponse,
} from '../../contracts/products.contract.ts';
import multipart from '@fastify/multipart';
import { config } from '../../config.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { ImageStorage, MediaService, StorageUnavailable } from '../media/index.ts';
import {
  FieldSuggestion,
  type SuggestionField,
  type SuggestionResolution,
  type SuggestionValue,
} from './FieldSuggestion.ts';
import type { Product, ProductPage } from './Product.ts';
import { PreparationRepository, type TokenTotals } from './PreparationRepository.ts';
import { ProductController } from './ProductController.ts';
import type { ProductImage } from './ProductImage.ts';
import {
  ProductRepository,
  type ProductChanges,
  type ProductDraft,
  type ProductListCriteria,
} from './ProductRepository.ts';
import { ProductService } from './ProductService.ts';

/** The DataSource is never reached: every repository method the routes call is overridden. */
const NO_DATA_SOURCE = undefined as unknown as ConstructorParameters<typeof ProductRepository>[0];

/** Only the upload suite reaches media, and it builds its own. */
const NO_MEDIA = undefined as unknown as MediaService;

const READY_ID = '01931f2a-3333-7000-8000-000000000001';
const UNPRICED_ID = '01931f2a-3333-7000-8000-000000000002';

function card(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова миша, стан відмінний.',
    titleOlx: 'Миша Logitech MX Master 3 бездротова',
    descriptionOlx: 'Продаю бездротову мишу, стан відмінний.',
    price: '2499.00',
    seoKeywords: ['миша'],
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
        id: `${id.slice(0, -1)}9`,
        productId: id,
        r2Key: `products/${id}/front.jpg`,
        position: 0,
        isMain: true,
      },
    ],
    ...overrides,
  };
}

class StubProductRepository extends ProductRepository {
  readonly cards = [card(READY_ID), card(UNPRICED_ID, { price: '0.00' })];
  readonly failedRuns = new Map<string, number>();

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async list(criteria: ProductListCriteria): Promise<ProductPage> {
    return {
      items: this.cards,
      failedRuns: this.failedRuns,
      total: this.cards.length,
      page: criteria.page,
      pageSize: criteria.pageSize,
    };
  }

  override async findById(id: string): Promise<Product | null> {
    return this.cards.find((product) => product.id === id) ?? null;
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

  private galleryOf(productId: string): ProductImage[] {
    return this.cards.find((product) => product.id === productId)?.images ?? [];
  }
}

/**
 * Holds what the sum over `product_preparation_runs` gives back; a card it does not know about
 * has never been prepared.
 */
class StubPreparationRepository extends PreparationRepository {
  readonly totals = new Map<string, TokenTotals>();
  /** Suggestions reach the card through their run, so the double keys them the way the join does. */
  readonly suggestions = new Map<string, FieldSuggestion[]>();

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async sumTokens(productId: string): Promise<TokenTotals> {
    return this.totals.get(productId) ?? { inputTokens: 0, outputTokens: 0 };
  }

  /** Counts the trips to the table: a card read takes its suggestions from one of them. */
  suggestionQueries = 0;

  override async findSuggestions(productId: string): Promise<FieldSuggestion[]> {
    this.suggestionQueries += 1;
    return this.suggestions.get(productId) ?? [];
  }

  override async findSuggestion(
    productId: string,
    suggestionId: string,
  ): Promise<FieldSuggestion | null> {
    return (this.suggestions.get(productId) ?? []).find((row) => row.id === suggestionId) ?? null;
  }

  override async resolveSuggestion(
    suggestionId: string,
    resolution: SuggestionResolution,
  ): Promise<boolean> {
    const row = [...this.suggestions.values()].flat().find((each) => each.id === suggestionId);
    if (row?.resolution !== null) {
      return false;
    }
    row.resolution = resolution;
    row.resolvedAt = new Date('2026-09-20T12:00:00.000Z');
    return true;
  }
}

describe('product controller: list', () => {
  const repository = new StubProductRepository();
  const service = new ProductService(repository, NO_MEDIA, new StubPreparationRepository());
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    new ProductController(service, 'https://images.example.com').register(app, async () => {
      // Lets every request through: the session is not what this spec is about.
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('puts the derived isReady of each card into its row (AC-30)', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    const body = response.json<ProductList>();
    const readiness = new Map(
      body.items.map((row) => [row.id, (row as Record<string, unknown>)['isReady']]),
    );

    assert.equal(response.statusCode, 200);
    for (const product of repository.cards) {
      assert.equal(readiness.get(product.id), service.isReady(product), product.id);
    }
  });

  it('puts the failed-run count of each card into its row, zero when it never failed (T50)', async () => {
    repository.failedRuns.set(READY_ID, 3);

    const response = await app.inject({ method: 'GET', url: '/' });
    const counts = new Map(
      response.json<ProductList>().items.map((row) => [row.id, row.failedRuns]),
    );

    assert.equal(counts.get(READY_ID), 3);
    assert.equal(counts.get(UNPRICED_ID), 0);
  });
});

class CategoryRepository extends StubProductRepository {
  readonly categories = ['Клавіатури', 'Миші'];
  lastCriteria: ProductListCriteria | undefined;

  override async listCategories(): Promise<string[]> {
    return this.categories;
  }

  override async list(criteria: ProductListCriteria): Promise<ProductPage> {
    this.lastCriteria = criteria;
    return super.list(criteria);
  }
}

describe('product controller: categories', () => {
  const repository = new CategoryRepository();
  let app: FastifyInstance;
  let allowed = true;

  before(async () => {
    app = Fastify();
    new ProductController(
      new ProductService(repository, NO_MEDIA, new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async (_request, reply) => {
      if (!allowed) {
        return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
      }
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('answers the category list rather than reading categories as a card id (AC-55)', async () => {
    const response = await app.inject({ method: 'GET', url: '/categories' });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), ['Клавіатури', 'Миші']);
  });

  it('puts the category list route behind the session guard (AC-55)', async () => {
    allowed = false;
    try {
      const response = await app.inject({ method: 'GET', url: '/categories' });

      assert.equal(response.statusCode, 401);
    } finally {
      allowed = true;
    }
  });

  it('hands a repeated category to the service as a list (AC-55)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/?category=${encodeURIComponent('Миші')}&category=${encodeURIComponent('Клавіатури')}`,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(repository.lastCriteria?.filters.category, ['Миші', 'Клавіатури']);
  });
});

describe('product controller: text filters', () => {
  const repository = new CategoryRepository();
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    new ProductController(
      new ProductService(repository, NO_MEDIA, new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async () => {
      // Lets every request through: the session is not what this spec is about.
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    repository.lastCriteria = undefined;
  });

  for (const url of ['/?title=ab', '/?description=%20ab%20']) {
    it(`answers validation_failed for ${url} without reaching the list (AC-57)`, async () => {
      const response = await app.inject({ method: 'GET', url });

      assert.equal(response.statusCode, 400);
      assert.equal(response.json<{ code: string }>().code, apiErrorCodes.validationFailed);
      assert.equal(repository.lastCriteria, undefined);
    });
  }
});

const FRONT_ID = '01931f2a-4444-7000-8000-000000000001';
const BACK_ID = '01931f2a-4444-7000-8000-000000000002';

/** Two frames with the front one main, listed out of position order on purpose. */
function twoFrameCard(): Product {
  return card(READY_ID, {
    images: [
      {
        id: BACK_ID,
        productId: READY_ID,
        r2Key: `products/${READY_ID}/back.jpg`,
        position: 1,
        isMain: false,
      },
      {
        id: FRONT_ID,
        productId: READY_ID,
        r2Key: `products/${READY_ID}/front.jpg`,
        position: 0,
        isMain: true,
      },
    ],
  });
}

function mainUrl(productId: string, imageId: string): string {
  return `/${productId}/images/${imageId}/main`;
}

describe('product controller: main frame', () => {
  let repository: StubProductRepository;
  let app: FastifyInstance;

  before(async () => {
    repository = new StubProductRepository();
    app = Fastify();
    new ProductController(
      new ProductService(repository, NO_MEDIA, new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async () => {
      // Lets every request through: the session is not what this suite is about.
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('answers with the whole gallery in which only the chosen frame is main (AC-03)', async () => {
    repository.cards[0] = twoFrameCard();

    const response = await app.inject({ method: 'PUT', url: mainUrl(READY_ID, BACK_ID) });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json<ProductImageResponse[]>(), [
      {
        id: FRONT_ID,
        r2Key: `products/${READY_ID}/front.jpg`,
        url: `https://images.example.com/products/${READY_ID}/front.jpg`,
        position: 0,
        isMain: false,
      },
      {
        id: BACK_ID,
        r2Key: `products/${READY_ID}/back.jpg`,
        url: `https://images.example.com/products/${READY_ID}/back.jpg`,
        position: 1,
        isMain: true,
      },
    ]);
  });

  it('answers the same way when the frame that is already main is chosen again', async () => {
    repository.cards[0] = twoFrameCard();

    const first = await app.inject({ method: 'PUT', url: mainUrl(READY_ID, FRONT_ID) });
    const second = await app.inject({ method: 'PUT', url: mainUrl(READY_ID, FRONT_ID) });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.deepEqual(second.json(), first.json());
  });

  it('answers image_not_found for a frame of another card', async () => {
    repository.cards[0] = twoFrameCard();
    const foreignImage = repository.cards[1]?.images[0]?.id ?? '';

    const response = await app.inject({ method: 'PUT', url: mainUrl(READY_ID, foreignImage) });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.imageNotFound);
  });
});

describe('product controller: main frame without a session', () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    new ProductController(
      new ProductService(new StubProductRepository(), NO_MEDIA, new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async (_request, reply) => {
      return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('puts the main-frame route behind the session guard', async () => {
    const repository = new StubProductRepository();
    const frame = repository.cards[0]?.images[0]?.id ?? '';

    const response = await app.inject({ method: 'PUT', url: mainUrl(READY_ID, frame) });

    assert.equal(response.statusCode, 401);
  });
});

const CREATED_ID = '01931f2a-3333-7000-8000-000000000003';

/** What `products` declares as column defaults: the row an insert of nothing produces. */
function emptyCard(draft: ProductDraft): Product {
  return {
    id: CREATED_ID,
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
    promId: null,
    olxId: null,
    createdAt: new Date('2026-09-17T10:00:00.000Z'),
    updatedAt: new Date('2026-09-17T10:00:00.000Z'),
    images: [],
    ...draft,
  };
}

class CreateRepository extends StubProductRepository {
  override async create(draft: ProductDraft): Promise<Product> {
    const created = emptyCard(draft);
    this.cards.push(created);
    return created;
  }
}

describe('product controller: create', () => {
  let app: FastifyInstance;

  before(async () => {
    const service = new ProductService(
      new CreateRepository(),
      NO_MEDIA,
      new StubPreparationRepository(),
    );
    app = Fastify();
    new ProductController(service, 'https://images.example.com').register(app, async () => {
      // Lets every request through: the session is not what this spec is about.
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('answers 201 with an empty card for an empty body, ready to take a frame (AC-35)', async () => {
    const response = await app.inject({ method: 'POST', url: '/', payload: {} });
    const body = response.json<ProductUpdateResponse>();

    assert.equal(response.statusCode, 201);
    assert.equal(body.id, CREATED_ID);
    assert.deepEqual(
      {
        titleProm: body.titleProm,
        titleOlx: body.titleOlx,
        descriptionProm: body.descriptionProm,
        descriptionOlx: body.descriptionOlx,
        category: body.category,
        price: body.price,
        images: body.images,
        isReady: body.isReady,
      },
      {
        titleProm: '',
        titleOlx: '',
        descriptionProm: '',
        descriptionOlx: '',
        category: '',
        price: '0.00',
        images: [],
        isReady: false,
      },
    );
  });
});

/** Never talks to R2: the one method an upload reaches is overridden. */
class RecordingImageStorage extends ImageStorage {
  readonly keys: string[] = [];

  constructor() {
    super({
      accountId: 'test-account',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
      ...config.storage,
    });
  }

  override async put(key: string): Promise<void> {
    this.keys.push(key);
  }
}

class UploadRepository extends StubProductRepository {
  override async addImage(productId: string, r2Key: string): Promise<ProductImage> {
    const gallery = this.cards.find((product) => product.id === productId)?.images ?? [];
    const image = {
      id: '01931f2a-4444-7000-8000-000000000001',
      productId,
      r2Key,
      position: gallery.length,
      isMain: gallery.length === 0,
    };
    this.cards.find((product) => product.id === productId)?.images.push(image);
    return image;
  }
}

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0];

function upload(bytes: Uint8Array<ArrayBuffer>, field = 'file'): { payload: FormData } {
  const payload = new FormData();
  payload.append(field, new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
  return { payload };
}

function jpegOfLength(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  bytes.set(JPEG_BYTES);
  return bytes;
}

describe('product controller: upload', () => {
  let repository: UploadRepository;
  let storage: RecordingImageStorage;
  let app: FastifyInstance;
  let allowed = true;

  before(async () => {
    repository = new UploadRepository();
    storage = new RecordingImageStorage();
    app = Fastify();
    await app.register(multipart, {
      limits: {
        fileSize: config.http.imageUpload.maxFileBytes,
        files: config.http.imageUpload.maxFiles,
      },
    });
    new ProductController(
      new ProductService(repository, new MediaService(storage), new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async (_request, reply) => {
      if (!allowed) {
        return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
      }
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  function post(productId: string, body: { payload: FormData }) {
    return app.inject({ method: 'POST', url: `/${productId}/images`, ...body });
  }

  it('answers 201 with the new frame and its composed address (AC-01)', async () => {
    repository.cards[1] = card(UNPRICED_ID, { images: [] });

    const response = await post(UNPRICED_ID, upload(jpegOfLength(64)));

    assert.equal(response.statusCode, 201);
    const image = response.json<ProductImageResponse>();
    assert.equal(image.r2Key, storage.keys.at(-1));
    assert.equal(image.url, `https://images.example.com/${image.r2Key}`);
    assert.equal(image.isMain, true);
  });

  it('accepts a file exactly at the size limit', async () => {
    repository.cards[1] = card(UNPRICED_ID, { images: [] });

    const response = await post(
      UNPRICED_ID,
      upload(jpegOfLength(productConstraints.maxImageBytes)),
    );

    assert.equal(response.statusCode, 201);
  });

  it('answers file_too_large for a file one byte over the limit, storing nothing', async () => {
    const before = storage.keys.length;

    const response = await post(
      UNPRICED_ID,
      upload(jpegOfLength(productConstraints.maxImageBytes + 1)),
    );

    assert.equal(response.statusCode, 413);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.fileTooLarge);
    assert.equal(storage.keys.length, before);
  });

  it('answers invalid_file for content that is not an image, whatever the declared type', async () => {
    const response = await post(UNPRICED_ID, upload(new TextEncoder().encode('%PDF-1.7')));

    assert.equal(response.statusCode, 422);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.invalidFile);
  });

  it('answers validation_failed when the file field is missing', async () => {
    const response = await post(UNPRICED_ID, upload(jpegOfLength(64), 'photo'));

    assert.equal(response.statusCode, 400);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.validationFailed);
  });

  it('answers product_not_found for a card that does not exist', async () => {
    const response = await post('01931f2a-3333-7000-8000-000000000404', upload(jpegOfLength(64)));

    assert.equal(response.statusCode, 404);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.productNotFound);
  });

  it('puts the upload route behind the session guard', async () => {
    allowed = false;
    try {
      const response = await post(UNPRICED_ID, upload(jpegOfLength(64)));

      assert.equal(response.statusCode, 401);
    } finally {
      allowed = true;
    }
  });
});

/** Never talks to R2: the one method a deletion reaches is overridden. */
class DeletingImageStorage extends RecordingImageStorage {
  readonly deleted: string[] = [];
  failure: Error | undefined;

  override async delete(key: string): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.deleted.push(key);
  }

  /** One entry per call, so a test can tell one batch from many single removals. */
  readonly deletedBatches: string[][] = [];

  override async deleteMany(keys: readonly string[]): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.deletedBatches.push([...keys]);
  }
}

class DeletionRepository extends StubProductRepository {
  override async deleteImage(imageId: string): Promise<boolean> {
    for (const product of this.cards) {
      const index = product.images.findIndex((image) => image.id === imageId);
      if (index !== -1) {
        product.images.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}

function imageUrl(productId: string, imageId: string): string {
  return `/${productId}/images/${imageId}`;
}

describe('product controller: delete frame', () => {
  let repository: DeletionRepository;
  let storage: DeletingImageStorage;
  let app: FastifyInstance;
  let allowed = true;

  before(async () => {
    repository = new DeletionRepository();
    storage = new DeletingImageStorage();
    app = Fastify();
    new ProductController(
      new ProductService(repository, new MediaService(storage), new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async (_request, reply) => {
      if (!allowed) {
        return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
      }
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('answers 204 with no body once the object and the frame are gone (AC-16)', async () => {
    repository.cards[0] = twoFrameCard();

    const response = await app.inject({ method: 'DELETE', url: imageUrl(READY_ID, BACK_ID) });

    assert.equal(response.statusCode, 204);
    assert.equal(response.body, '');
    assert.equal(storage.deleted.at(-1), `products/${READY_ID}/back.jpg`);
    assert.deepEqual(
      repository.cards[0].images.map((image) => image.id),
      [FRONT_ID],
    );
  });

  it('answers storage_unavailable and keeps the frame when storage is down (AC-17)', async () => {
    repository.cards[0] = twoFrameCard();
    // The real ImageStorage turns every SDK failure into this; the double does the same.
    storage.failure = new StorageUnavailable(new Error('getaddrinfo ENOTFOUND'));
    try {
      const response = await app.inject({ method: 'DELETE', url: imageUrl(READY_ID, BACK_ID) });

      assert.equal(response.statusCode, 502);
      assert.equal(response.json<{ code: string }>().code, apiErrorCodes.storageUnavailable);
      assert.equal(repository.cards[0].images.length, 2);
    } finally {
      storage.failure = undefined;
    }
  });

  it('answers image_not_found for a frame of another card', async () => {
    repository.cards[0] = twoFrameCard();
    const foreignImage = repository.cards[1]?.images[0]?.id ?? '';

    const response = await app.inject({
      method: 'DELETE',
      url: imageUrl(READY_ID, foreignImage),
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.imageNotFound);
    assert.equal(repository.cards[1]?.images.length, 1);
  });

  it('puts the delete-frame route behind the session guard', async () => {
    repository.cards[0] = twoFrameCard();
    allowed = false;
    try {
      const response = await app.inject({ method: 'DELETE', url: imageUrl(READY_ID, BACK_ID) });

      assert.equal(response.statusCode, 401);
      assert.equal(repository.cards[0].images.length, 2);
    } finally {
      allowed = true;
    }
  });
});

class CardDeletionRepository extends StubProductRepository {
  override async findImageKeys(productId: string): Promise<string[]> {
    const product = this.cards.find((candidate) => candidate.id === productId);
    return product?.images.map((image) => image.r2Key) ?? [];
  }

  /** The frames go with the card, as `on delete cascade` takes them in Postgres. */
  override async delete(id: string): Promise<boolean> {
    const index = this.cards.findIndex((product) => product.id === id);
    if (index === -1) {
      return false;
    }
    this.cards.splice(index, 1);
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

  reset(): void {
    this.cards.splice(0, this.cards.length, twoFrameCard(), card(UNPRICED_ID, { price: '0.00' }));
  }
}

describe('product controller: delete card', () => {
  let repository: CardDeletionRepository;
  let storage: DeletingImageStorage;
  let app: FastifyInstance;
  let allowed = true;

  before(async () => {
    repository = new CardDeletionRepository();
    storage = new DeletingImageStorage();
    app = Fastify();
    new ProductController(
      new ProductService(repository, new MediaService(storage), new StubPreparationRepository()),
      'https://images.example.com',
    ).register(app, async (_request, reply) => {
      if (!allowed) {
        return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
      }
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('answers 204 with no body once the objects and the card are gone (AC-18)', async () => {
    repository.reset();

    const response = await app.inject({ method: 'DELETE', url: `/${READY_ID}` });

    assert.equal(response.statusCode, 204);
    assert.equal(response.body, '');
    assert.deepEqual(storage.deletedBatches.at(-1)?.toSorted(), [
      `products/${READY_ID}/back.jpg`,
      `products/${READY_ID}/front.jpg`,
    ]);
    assert.equal(await repository.findById(READY_ID), null);
  });

  it('answers storage_unavailable and keeps the card with its frames when storage is down (AC-17)', async () => {
    repository.reset();
    // The real ImageStorage turns every SDK failure into this; the double does the same.
    storage.failure = new StorageUnavailable(new Error('getaddrinfo ENOTFOUND'));
    try {
      const response = await app.inject({ method: 'DELETE', url: `/${READY_ID}` });

      assert.equal(response.statusCode, 502);
      assert.equal(response.json<{ code: string }>().code, apiErrorCodes.storageUnavailable);
      assert.equal((await repository.findById(READY_ID))?.images.length, 2);
    } finally {
      storage.failure = undefined;
    }
  });

  it('answers product_not_found for a card that does not exist', async () => {
    repository.reset();

    const response = await app.inject({
      method: 'DELETE',
      url: '/01931f2a-3333-7000-8000-000000000404',
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.productNotFound);
    assert.equal(repository.cards.length, 2);
  });

  it('puts the delete-card route behind the session guard', async () => {
    repository.reset();
    allowed = false;
    try {
      const response = await app.inject({ method: 'DELETE', url: `/${READY_ID}` });

      assert.equal(response.statusCode, 401);
      assert.notEqual(await repository.findById(READY_ID), null);
    } finally {
      allowed = true;
    }
  });
});

describe('product controller: card cost', () => {
  const runs = new StubPreparationRepository();
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    new ProductController(
      new ProductService(new StubProductRepository(), NO_MEDIA, runs),
      'https://images.example.com',
    ).register(app, async () => {
      // Lets every request through: the session is not what this suite is about.
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('answers the card read with what every preparation of that card has cost (AC-14)', async () => {
    runs.totals.set(READY_ID, { inputTokens: 1300, outputTokens: 250 });

    const response = await app.inject({ method: 'GET', url: `/${READY_ID}` });
    const body = response.json<Record<string, unknown>>();

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      { totalInputTokens: body['totalInputTokens'], totalOutputTokens: body['totalOutputTokens'] },
      { totalInputTokens: 1300, totalOutputTokens: 250 },
    );
  });

  it('answers zeros for a card that has never been prepared, not an empty field (sad.md §12)', async () => {
    const response = await app.inject({ method: 'GET', url: `/${UNPRICED_ID}` });
    const body = response.json<Record<string, unknown>>();

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      { totalInputTokens: body['totalInputTokens'], totalOutputTokens: body['totalOutputTokens'] },
      { totalInputTokens: 0, totalOutputTokens: 0 },
    );
  });
});

const SUGGESTION_ID = '01931f2a-6666-7000-8000-000000000001';
const PRICE_SUGGESTION_ID = '01931f2a-6666-7000-8000-000000000002';
const OLX_DESCRIPTION_SUGGESTION_ID = '01931f2a-6666-7000-8000-000000000003';
const MISSING_SUGGESTION_ID = '01931f2a-6666-7000-8000-00000000000f';
const RUN_ID = '01931f2a-5555-7000-8000-000000000001';
const SUGGESTED_AT = '2026-09-20T10:00:00.000Z';

class SuggestionProductRepository extends StubProductRepository {
  override async update(id: string, changes: ProductChanges): Promise<Product | null> {
    const card = this.cards.find((product) => product.id === id);
    if (card === undefined) {
      return null;
    }
    Object.assign(card, changes);
    return card;
  }
}

function pendingSuggestion(
  id: string,
  field: SuggestionField,
  value: SuggestionValue,
): FieldSuggestion {
  return Object.assign(new FieldSuggestion(), {
    id,
    runId: RUN_ID,
    field,
    value,
    resolution: null,
    resolvedAt: null,
    createdAt: new Date(SUGGESTED_AT),
  });
}

function suggestionUrl(productId: string, suggestionId: string, decision: string): string {
  return `/${productId}/suggestions/${suggestionId}/${decision}`;
}

describe('product controller: resolving a suggestion', () => {
  let repository: SuggestionProductRepository;
  let runs: StubPreparationRepository;
  let app: FastifyInstance;
  let allowed = true;

  before(async () => {
    repository = new SuggestionProductRepository();
    runs = new StubPreparationRepository();
    app = Fastify();
    new ProductController(
      new ProductService(repository, NO_MEDIA, runs),
      'https://images.example.com',
    ).register(app, async (_request, reply) => {
      if (!allowed) {
        return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
      }
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    allowed = true;
    repository.cards[0] = card(READY_ID, { titleOlx: 'Моя власна назва' });
    runs.suggestions.set(READY_ID, [
      pendingSuggestion(SUGGESTION_ID, 'title_olx', 'Назва від моделі'),
      pendingSuggestion(PRICE_SUGGESTION_ID, 'price', {
        priceFrom: '2200.00',
        priceTo: '2700.00',
      }),
    ]);
  });

  it('answers the saved card for an accepted suggestion (Checklist 3)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, SUGGESTION_ID, 'accept'),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json<{ titleOlx: string }>().titleOlx, 'Назва від моделі');
  });

  it('answers price_suggestion_readonly for accepting a price suggestion (AC-26)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, PRICE_SUGGESTION_ID, 'accept'),
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.priceSuggestionReadonly);
    assert.equal(repository.cards[0]?.price, '2499.00');
  });

  it('answers suggestion_already_resolved for a second decision (Checklist 6)', async () => {
    const url = suggestionUrl(READY_ID, SUGGESTION_ID, 'accept');

    const first = await app.inject({ method: 'POST', url });
    const second = await app.inject({ method: 'POST', url });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 409);
    assert.equal(second.json<{ code: string }>().code, apiErrorCodes.suggestionAlreadyResolved);
  });

  it('answers suggestion_not_found for a suggestion this card never had (Checklist 1)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, MISSING_SUGGESTION_ID, 'accept'),
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.suggestionNotFound);
  });

  it('answers the untouched card for a rejected suggestion (Checklist 3)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, SUGGESTION_ID, 'reject'),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json<{ titleOlx: string }>().titleOlx, 'Моя власна назва');
  });

  it('puts both suggestion routes behind the session guard (Checklist 3)', async () => {
    allowed = false;

    const accepted = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, SUGGESTION_ID, 'accept'),
    });
    const rejected = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, SUGGESTION_ID, 'reject'),
    });

    assert.equal(accepted.statusCode, 401);
    assert.equal(rejected.statusCode, 401);
    assert.equal(repository.cards[0]?.titleOlx, 'Моя власна назва');
  });
});

type CardReadBody = {
  titleOlx: string;
  pendingSuggestions?: readonly Record<string, unknown>[];
};

/** What the card read owes per suggestion: the identifiers, the field of the contract, the value. */
function pendingDto(id: string, field: string, value: unknown): Record<string, unknown> {
  return { id, runId: RUN_ID, field, value, createdAt: SUGGESTED_AT };
}

/** An absent field collapses to an empty list, so forgetting it reads as offering no suggestion. */
function pendingOf(body: CardReadBody): Record<string, unknown>[] {
  return (body.pendingSuggestions ?? []).map((row) => ({
    id: row['id'],
    runId: row['runId'],
    field: row['field'],
    value: row['value'],
    createdAt: row['createdAt'],
  }));
}

describe('product controller: pending suggestions of a card', () => {
  let repository: SuggestionProductRepository;
  let runs: StubPreparationRepository;
  let app: FastifyInstance;

  before(async () => {
    repository = new SuggestionProductRepository();
    runs = new StubPreparationRepository();
    app = Fastify();
    new ProductController(
      new ProductService(repository, NO_MEDIA, runs),
      'https://images.example.com',
    ).register(app, async () => {
      // Lets every request through: the session is not what this suite is about.
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Edited by hand, so the reconciliation of the read leaves the suggestion to the human.
    repository.cards[0] = card(READY_ID, { titleOlx: 'Моя власна назва' });
    runs.suggestions.set(READY_ID, [
      pendingSuggestion(SUGGESTION_ID, 'title_olx', 'Назва від моделі'),
    ]);
    runs.suggestionQueries = 0;
  });

  it('answers the card read with the suggestion waiting beside the field (AC-41)', async () => {
    const response = await app.inject({ method: 'GET', url: `/${READY_ID}` });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(pendingOf(response.json<CardReadBody>()), [
      pendingDto(SUGGESTION_ID, 'titleOlx', 'Назва від моделі'),
    ]);
  });

  it('leaves the suggestion the read applied itself out of the pending ones (AC-42)', async () => {
    repository.cards[0] = card(READY_ID, { titleOlx: '' });

    const response = await app.inject({ method: 'GET', url: `/${READY_ID}` });
    const body = response.json<CardReadBody>();

    assert.equal(body.titleOlx, 'Назва від моделі');
    assert.deepEqual(body.pendingSuggestions, []);
  });

  it('never brings a rejected suggestion back among the pending ones (AC-42)', async () => {
    await app.inject({ method: 'POST', url: suggestionUrl(READY_ID, SUGGESTION_ID, 'reject') });

    const response = await app.inject({ method: 'GET', url: `/${READY_ID}` });

    assert.deepEqual(response.json<CardReadBody>().pendingSuggestions, []);
  });

  it('answers an acceptance with what is still waiting for a decision (Checklist 3)', async () => {
    runs.suggestions.set(READY_ID, [
      pendingSuggestion(SUGGESTION_ID, 'title_olx', 'Назва від моделі'),
      pendingSuggestion(OLX_DESCRIPTION_SUGGESTION_ID, 'description_olx', 'Опис від моделі.'),
    ]);

    const response = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, SUGGESTION_ID, 'accept'),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(pendingOf(response.json<CardReadBody>()), [
      pendingDto(OLX_DESCRIPTION_SUGGESTION_ID, 'descriptionOlx', 'Опис від моделі.'),
    ]);
  });

  it('answers a rejection with what is still waiting for a decision (Checklist 3)', async () => {
    runs.suggestions.set(READY_ID, [
      pendingSuggestion(SUGGESTION_ID, 'title_olx', 'Назва від моделі'),
      pendingSuggestion(OLX_DESCRIPTION_SUGGESTION_ID, 'description_olx', 'Опис від моделі.'),
    ]);

    const response = await app.inject({
      method: 'POST',
      url: suggestionUrl(READY_ID, SUGGESTION_ID, 'reject'),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(pendingOf(response.json<CardReadBody>()), [
      pendingDto(OLX_DESCRIPTION_SUGGESTION_ID, 'descriptionOlx', 'Опис від моделі.'),
    ]);
  });

  it('answers a card that was never prepared with an empty array, not a missing field (DoD)', async () => {
    const response = await app.inject({ method: 'GET', url: `/${UNPRICED_ID}` });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json<CardReadBody>().pendingSuggestions, []);
  });

  it('takes the pending suggestions from the query the reconciliation already makes (DoD)', async () => {
    const response = await app.inject({ method: 'GET', url: `/${READY_ID}` });

    assert.deepEqual(pendingOf(response.json<CardReadBody>()), [
      pendingDto(SUGGESTION_ID, 'titleOlx', 'Назва від моделі'),
    ]);
    assert.equal(runs.suggestionQueries, 1);
  });
});
