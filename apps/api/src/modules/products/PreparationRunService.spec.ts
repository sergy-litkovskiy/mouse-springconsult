import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PgBoss } from '../../queue.ts';
import type { Product } from './Product.ts';
import {
  ProductNotFound,
  PreparationInputIncomplete,
  PreparationRateLimited,
} from './ProductErrors.ts';
import { PreparationQueue, type PreparationRunJob } from './PreparationQueue.ts';
import {
  PreparationRepository,
  type PreparationRunDraft,
  type RunClaim,
} from './PreparationRepository.ts';
import { PreparationRun } from './PreparationRun.ts';
import { PreparationRunService } from './PreparationRunService.ts';
import { ProductRepository } from './ProductRepository.ts';

/** The DataSource is never reached: every repository method the service calls is overridden. */
const NO_DATA_SOURCE = undefined as unknown as ConstructorParameters<typeof ProductRepository>[0];
const NO_BOSS = undefined as unknown as PgBoss;

const CARD_ID = '01931f2a-5555-7000-8000-000000000001';
const OTHER_CARD_ID = '01931f2a-5555-7000-8000-000000000002';

function card(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    titleProm: 'Миша Logitech MX Master 3',
    descriptionProm: 'Бездротова миша, стан відмінний.',
    titleOlx: 'Миша Logitech MX Master 3 бездротова',
    descriptionOlx: 'Продаю бездротову мишу, стан відмінний.',
    price: '0.00',
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
  readonly cards: Product[];

  constructor(cards: Product[]) {
    super(NO_DATA_SOURCE);
    this.cards = cards;
  }

  override async findById(id: string): Promise<Product | null> {
    return this.cards.find((product) => product.id === id) ?? null;
  }
}

/** Keys runs by idempotency key the way the UNIQUE index does; the index itself is proven against Postgres. */
class StubPreparationRepository extends PreparationRepository {
  readonly rows: PreparationRun[] = [];
  recentRuns: Record<string, number> = {};

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async createRunOnce(draft: PreparationRunDraft): Promise<RunClaim> {
    const existing = this.rows.find((row) => row.idempotencyKey === draft.idempotencyKey);
    if (existing !== undefined) {
      return { run: existing, created: false };
    }
    const run = Object.assign(new PreparationRun(), {
      ...draft,
      id: `01931f2a-6666-7000-8000-${String(this.rows.length + 1).padStart(12, '0')}`,
      status: 'queued',
      errorCode: null,
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date('2026-09-19T10:00:00.000Z'),
      startedAt: null,
      finishedAt: null,
    });
    this.rows.push(run);
    return { run, created: true };
  }

  override async countRecentRuns(productId: string): Promise<number> {
    return this.recentRuns[productId] ?? 0;
  }

  override async findRunByKey(idempotencyKey: string): Promise<PreparationRun | null> {
    return this.rows.find((row) => row.idempotencyKey === idempotencyKey) ?? null;
  }

  override async findRun(productId: string, runId: string): Promise<PreparationRun | null> {
    return this.rows.find((row) => row.id === runId && row.productId === productId) ?? null;
  }
}

class RecordingQueue extends PreparationQueue {
  readonly jobs: PreparationRunJob[] = [];

  constructor() {
    super(NO_BOSS);
  }

  /** pg-boss keeps the first job of an id and ignores the rest, as the real queue does. */
  override async enqueue(job: PreparationRunJob): Promise<void> {
    if (this.jobs.some((queued) => queued.runId === job.runId)) {
      return;
    }
    this.jobs.push(job);
  }
}

class QueueDown extends Error {}

/** Loses the first job, as a dropped connection between the insert and the send would. */
class FlakyQueue extends RecordingQueue {
  private failuresLeft = 1;

  override async enqueue(job: PreparationRunJob): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new QueueDown('connection terminated unexpectedly');
    }
    return super.enqueue(job);
  }
}

function setup(cards: Product[] = [card(CARD_ID)], queue = new RecordingQueue()) {
  const products = new StubProductRepository(cards);
  const runs = new StubPreparationRepository();
  const service = new PreparationRunService(products, runs, queue);
  return { products, runs, queue, service };
}

function missing(expected: 'gallery' | 'title') {
  return (error: unknown): boolean => {
    assert.ok(error instanceof PreparationInputIncomplete);
    assert.deepEqual(error.details, { missing: [expected] });
    return true;
  };
}

describe('preparation run service: input gates', () => {
  it('refuses to prepare texts for a card without a single frame (AC-06)', async () => {
    const { service, runs, queue } = setup([card(CARD_ID, { images: [] })]);

    await assert.rejects(service.start(CARD_ID, { scope: 'texts' }), missing('gallery'));

    assert.equal(runs.rows.length, 0);
    assert.deepEqual(queue.jobs, []);
  });

  it('refuses a both run for a card without a single frame (AC-06)', async () => {
    const { service, runs, queue } = setup([card(CARD_ID, { images: [] })]);

    await assert.rejects(service.start(CARD_ID, { scope: 'both' }), missing('gallery'));

    assert.equal(runs.rows.length, 0);
    assert.deepEqual(queue.jobs, []);
  });

  it('queues a texts run once the card has a frame (AC-06)', async () => {
    const { service, queue } = setup();

    const { run, created } = await service.start(CARD_ID, { scope: 'texts' });

    assert.equal(created, true);
    assert.equal(run.scope, 'texts');
    assert.deepEqual(queue.jobs, [{ runId: run.id, productId: CARD_ID, scope: 'texts' }]);
  });

  it('refuses a price run for a card with neither a Prom nor an OLX title (AC-27)', async () => {
    const { service, runs, queue } = setup([card(CARD_ID, { titleProm: '', titleOlx: '' })]);

    await assert.rejects(service.start(CARD_ID, { scope: 'price' }), missing('title'));

    assert.equal(runs.rows.length, 0);
    assert.deepEqual(queue.jobs, []);
  });

  it('does not let a description stand in for a missing title (AC-27)', async () => {
    const { service, queue } = setup([
      card(CARD_ID, {
        titleProm: '',
        titleOlx: '',
        descriptionProm: 'Бездротова миша, стан відмінний.',
        descriptionOlx: 'Продаю бездротову мишу.',
      }),
    ]);

    await assert.rejects(service.start(CARD_ID, { scope: 'price' }), missing('title'));

    assert.deepEqual(queue.jobs, []);
  });

  it('queues a price run when only the OLX title is filled (AC-27)', async () => {
    const { service, queue } = setup([card(CARD_ID, { titleProm: '', images: [] })]);

    const { run, created } = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(created, true);
    assert.deepEqual(queue.jobs, [{ runId: run.id, productId: CARD_ID, scope: 'price' }]);
  });

  it('answers product_not_found for a card that does not exist (Checklist 3)', async () => {
    const { service, queue } = setup([]);

    await assert.rejects(service.start(CARD_ID, { scope: 'texts' }), ProductNotFound);

    assert.deepEqual(queue.jobs, []);
  });
});

describe('preparation run service: scopes', () => {
  it('queues only the price for a card whose texts are ready, without re-running them (AC-10b)', async () => {
    const { service, runs, queue } = setup([card(CARD_ID, { price: '0.00' })]);

    const { run } = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(run.scope, 'price');
    assert.deepEqual(
      runs.rows.map((row) => row.scope),
      ['price'],
    );
    assert.deepEqual(queue.jobs, [{ runId: run.id, productId: CARD_ID, scope: 'price' }]);
  });

  it('starts a price run as a run of its own after a texts run of the same card (AC-10b)', async () => {
    const { service, queue } = setup();

    const texts = await service.start(CARD_ID, { scope: 'texts' });
    const price = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(price.created, true);
    assert.notEqual(price.run.id, texts.run.id);
    assert.deepEqual(
      queue.jobs.map((job) => job.scope),
      ['texts', 'price'],
    );
  });

  it('carries the field and its draft into the queued job of a field run (Checklist 1)', async () => {
    const { service, queue } = setup();

    const { run } = await service.start(CARD_ID, {
      scope: 'field',
      field: 'descriptionOlx',
      draftText: 'Продаю мишу, майже нова.',
    });

    assert.equal(run.scope, 'field');
    assert.deepEqual(queue.jobs, [
      {
        runId: run.id,
        productId: CARD_ID,
        scope: 'field',
        field: 'descriptionOlx',
        draftText: 'Продаю мишу, майже нова.',
      },
    ]);
  });
});

describe('preparation run service: idempotency', () => {
  it('returns the existing run for the same input and queues nothing more (DoD idempotency)', async () => {
    const { service, runs, queue } = setup();

    const first = await service.start(CARD_ID, { scope: 'both' });
    const second = await service.start(CARD_ID, { scope: 'both' });

    assert.equal(second.created, false);
    assert.equal(second.run.id, first.run.id);
    assert.equal(runs.rows.length, 1);
    assert.equal(queue.jobs.length, 1);
  });

  it('queues a run again when the same input finds it still queued, so a lost send is recovered', async () => {
    const { service, queue } = setup([card(CARD_ID)], new FlakyQueue());

    await assert.rejects(service.start(CARD_ID, { scope: 'texts' }), QueueDown);
    const retried = await service.start(CARD_ID, { scope: 'texts' });

    assert.equal(retried.created, false);
    assert.deepEqual(queue.jobs, [{ runId: retried.run.id, productId: CARD_ID, scope: 'texts' }]);
  });

  it('returns the existing run for the same input even when the card has used up its limit', async () => {
    const { service, runs, queue } = setup();

    const first = await service.start(CARD_ID, { scope: 'price' });
    runs.recentRuns[CARD_ID] = 20;
    const repeat = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(repeat.created, false);
    assert.equal(repeat.run.id, first.run.id);
    assert.equal(queue.jobs.length, 1);
  });

  it('starts a new texts run once the frames have changed (Data delta)', async () => {
    const { service, products } = setup();

    const first = await service.start(CARD_ID, { scope: 'texts' });
    products.cards[0] = card(CARD_ID, {
      images: [
        {
          id: '01931f2a-5555-7000-8000-00000000000a',
          productId: CARD_ID,
          r2Key: `products/${CARD_ID}/side.jpg`,
          position: 0,
          isMain: true,
        },
      ],
    });
    const second = await service.start(CARD_ID, { scope: 'texts' });

    assert.equal(second.created, true);
    assert.notEqual(second.run.id, first.run.id);
  });

  it('starts a new price run once the title has changed (Data delta)', async () => {
    const { service, products } = setup();

    const first = await service.start(CARD_ID, { scope: 'price' });
    products.cards[0] = card(CARD_ID, { titleProm: 'Миша Logitech MX Master 3S' });
    const second = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(second.created, true);
    assert.notEqual(second.run.id, first.run.id);
  });

  it('starts a new price run once the description has changed, because it is part of the query (AC-27)', async () => {
    const { service, products } = setup();

    const first = await service.start(CARD_ID, { scope: 'price' });
    products.cards[0] = card(CARD_ID, { descriptionProm: 'Нова батарея, повний комплект.' });
    const second = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(second.created, true);
    assert.notEqual(second.run.id, first.run.id);
  });

  it('keeps the texts run when a frame beyond the three sent to the model is added (Data delta)', async () => {
    const frame = (position: number) => ({
      id: `01931f2a-5555-7000-8000-00000000010${String(position)}`,
      productId: CARD_ID,
      r2Key: `products/${CARD_ID}/frame-${String(position)}.jpg`,
      position,
      isMain: position === 0,
    });
    const { service, products } = setup([card(CARD_ID, { images: [0, 1, 2].map(frame) })]);

    const first = await service.start(CARD_ID, { scope: 'texts' });
    products.cards[0] = card(CARD_ID, { images: [0, 1, 2, 3].map(frame) });
    const second = await service.start(CARD_ID, { scope: 'texts' });

    assert.equal(second.created, false);
    assert.equal(second.run.id, first.run.id);
  });

  it('starts a new field run for a different draft of the same field (Data delta)', async () => {
    const { service } = setup();

    const first = await service.start(CARD_ID, {
      scope: 'field',
      field: 'titleOlx',
      draftText: 'Миша Logitech',
    });
    const second = await service.start(CARD_ID, {
      scope: 'field',
      field: 'titleOlx',
      draftText: 'Миша Logitech MX',
    });

    assert.equal(second.created, true);
    assert.notEqual(second.run.id, first.run.id);
  });

  it('keeps the runs of two cards with the same title apart (Data delta)', async () => {
    const { service } = setup([card(CARD_ID), card(OTHER_CARD_ID)]);

    const first = await service.start(CARD_ID, { scope: 'price' });
    const second = await service.start(OTHER_CARD_ID, { scope: 'price' });

    assert.equal(second.created, true);
    assert.notEqual(second.run.id, first.run.id);
  });
});

describe('preparation run service: rate limit', () => {
  it('refuses a run once the card has had twenty runs within the hour (Checklist 5)', async () => {
    const { service, runs, queue } = setup();
    runs.recentRuns[CARD_ID] = 20;

    await assert.rejects(service.start(CARD_ID, { scope: 'texts' }), PreparationRateLimited);

    assert.equal(runs.rows.length, 0);
    assert.deepEqual(queue.jobs, []);
  });

  it('still lets the twentieth run of the hour through (Checklist 5)', async () => {
    const { service, runs, queue } = setup();
    runs.recentRuns[CARD_ID] = 19;

    const { created } = await service.start(CARD_ID, { scope: 'price' });

    assert.equal(created, true);
    assert.equal(queue.jobs.length, 1);
  });

  it('counts the window per card, so another card is not held back (Checklist 5)', async () => {
    const { service, runs, queue } = setup([card(CARD_ID), card(OTHER_CARD_ID)]);
    runs.recentRuns[CARD_ID] = 20;

    const { created } = await service.start(OTHER_CARD_ID, { scope: 'texts' });

    assert.equal(created, true);
    assert.equal(queue.jobs.length, 1);
  });
});

describe('preparation run service: polling', () => {
  it('reads back a started run of the card (Checklist 3)', async () => {
    const { service } = setup();
    const { run } = await service.start(CARD_ID, { scope: 'texts' });

    const polled = await service.getRun(CARD_ID, run.id);

    assert.equal(polled.id, run.id);
    assert.equal(polled.status, 'queued');
  });
});
