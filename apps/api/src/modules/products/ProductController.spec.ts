import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import type {
  ProductList,
  ProductImage as ProductImageResponse,
} from '../../contracts/products.contract.ts';
import type { Product, ProductPage } from './Product.ts';
import { ProductController } from './ProductController.ts';
import type { ProductImage } from './ProductImage.ts';
import { ProductRepository, type ProductListCriteria } from './ProductRepository.ts';
import { ProductService } from './ProductService.ts';

/** The DataSource is never reached: every repository method the routes call is overridden. */
const NO_DATA_SOURCE = undefined as unknown as ConstructorParameters<typeof ProductRepository>[0];

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
  const service = new ProductService(repository);
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
    new ProductController(new ProductService(repository), 'https://images.example.com').register(
      app,
      async () => {
        // Lets every request through: the session is not what this suite is about.
      },
    );
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
      new ProductService(new StubProductRepository()),
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
