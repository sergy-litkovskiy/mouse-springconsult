import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import type {
  ProductList,
  ProductImage as ProductImageResponse,
} from '../../contracts/products.contract.ts';
import multipart from '@fastify/multipart';
import { config } from '../../config.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { ImageStorage, MediaService } from '../media/index.ts';
import type { Product, ProductPage } from './Product.ts';
import { ProductController } from './ProductController.ts';
import type { ProductImage } from './ProductImage.ts';
import { ProductRepository, type ProductListCriteria } from './ProductRepository.ts';
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

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async list(criteria: ProductListCriteria): Promise<ProductPage> {
    return {
      items: this.cards,
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

describe('product controller: list', () => {
  const repository = new StubProductRepository();
  const service = new ProductService(repository, NO_MEDIA);
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
      new ProductService(repository, NO_MEDIA),
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
      new ProductService(new StubProductRepository(), NO_MEDIA),
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
      new ProductService(repository, new MediaService(storage)),
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
      new ProductService(repository, new MediaService(storage)),
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
    storage.failure = new Error('getaddrinfo ENOTFOUND');
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
