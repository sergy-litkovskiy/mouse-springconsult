import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import type { PgBoss } from '../../queue.ts';
import type { Product } from './Product.ts';
import { PreparationQueue, type PreparationRunJob } from './PreparationQueue.ts';
import {
  PreparationRepository,
  type PreparationRunDraft,
  type RunClaim,
} from './PreparationRepository.ts';
import { PreparationRun } from './PreparationRun.ts';
import { PreparationRunController } from './PreparationRunController.ts';
import { PreparationRunService } from './PreparationRunService.ts';
import { ProductRepository } from './ProductRepository.ts';

/** The DataSource is never reached: every repository method the routes call is overridden. */
const NO_DATA_SOURCE = undefined as unknown as ConstructorParameters<typeof ProductRepository>[0];
const NO_BOSS = undefined as unknown as PgBoss;

const CARD_ID = '01931f2a-7777-7000-8000-000000000001';
const BARE_CARD_ID = '01931f2a-7777-7000-8000-000000000002';
const UNTITLED_CARD_ID = '01931f2a-7777-7000-8000-000000000003';
const MISSING_CARD_ID = '01931f2a-7777-7000-8000-00000000000f';
const FINISHED_RUN_ID = '01931f2a-8888-7000-8000-000000000001';

type RunBody = {
  id: string;
  productId: string;
  scope: string;
  status: string;
  errorCode: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

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
  readonly cards = [
    card(CARD_ID),
    card(BARE_CARD_ID, { images: [] }),
    card(UNTITLED_CARD_ID, { titleProm: '', titleOlx: '' }),
  ];

  constructor() {
    super(NO_DATA_SOURCE);
  }

  override async findById(id: string): Promise<Product | null> {
    return this.cards.find((product) => product.id === id) ?? null;
  }
}

function finishedRun(): PreparationRun {
  return Object.assign(new PreparationRun(), {
    id: FINISHED_RUN_ID,
    productId: CARD_ID,
    scope: 'both',
    idempotencyKey: 'finished',
    status: 'failed',
    errorCode: 'price_unavailable',
    model: 'claude-sonnet-5',
    inputTokens: 1200,
    outputTokens: 300,
    createdAt: new Date('2026-09-19T10:00:00.000Z'),
    startedAt: new Date('2026-09-19T10:00:01.000Z'),
    finishedAt: new Date('2026-09-19T10:00:40.000Z'),
  });
}

/** Keys runs by idempotency key the way the UNIQUE index does; the index itself is proven against Postgres. */
class StubPreparationRepository extends PreparationRepository {
  rows: PreparationRun[] = [];
  recentRuns = 0;

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
      id: `01931f2a-9999-7000-8000-${String(this.rows.length + 1).padStart(12, '0')}`,
      status: 'queued',
      errorCode: null,
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date('2026-09-19T11:00:00.000Z'),
      startedAt: null,
      finishedAt: null,
    });
    this.rows.push(run);
    return { run, created: true };
  }

  override async countRecentRuns(): Promise<number> {
    return this.recentRuns;
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

function runsUrl(productId: string): string {
  return `/${productId}/preparation-runs`;
}

describe('preparation run controller', () => {
  const runs = new StubPreparationRepository();
  const queue = new RecordingQueue();
  let allowed = true;
  // Built on first use rather than in `before`: a failing build then fails every test that
  // needs the server instead of cancelling them all.
  let built: Promise<FastifyInstance> | undefined;

  async function build(): Promise<FastifyInstance> {
    const app = Fastify();
    new PreparationRunController(
      new PreparationRunService(new StubProductRepository(), runs, queue),
    ).register(app, async (_request, reply) => {
      if (!allowed) {
        return reply.code(401).send({ code: apiErrorCodes.notAuthenticated });
      }
    });
    await app.ready();
    return app;
  }

  function server(): Promise<FastifyInstance> {
    built ??= build();
    return built;
  }

  after(async () => {
    const app = await built?.catch(() => undefined);
    await app?.close();
  });

  beforeEach(() => {
    runs.rows = [finishedRun()];
    runs.recentRuns = 0;
    queue.jobs.length = 0;
    allowed = true;
  });

  async function start(productId: string, payload: unknown) {
    const app = await server();
    return app.inject({ method: 'POST', url: runsUrl(productId), payload: payload as object });
  }

  async function poll(productId: string, runId: string) {
    const app = await server();
    return app.inject({ method: 'GET', url: `${runsUrl(productId)}/${runId}` });
  }

  it('answers 201 with the queued run for a new input (Checklist 3, Checklist 6)', async () => {
    const response = await start(CARD_ID, { scope: 'both' });
    const body = response.json<RunBody>();

    assert.equal(response.statusCode, 201);
    assert.equal(body.productId, CARD_ID);
    assert.equal(body.scope, 'both');
    assert.equal(body.status, 'queued');
    assert.deepEqual(queue.jobs, [{ runId: body.id, productId: CARD_ID, scope: 'both' }]);
  });

  it('answers 200 with the same run when the same input is started again (DoD idempotency)', async () => {
    const first = await start(CARD_ID, { scope: 'texts' });
    const second = await start(CARD_ID, { scope: 'texts' });

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 200);
    assert.equal(second.json<RunBody>().id, first.json<RunBody>().id);
    assert.equal(queue.jobs.length, 1);
  });

  it('answers preparation_input_incomplete for texts on a card without frames (AC-06)', async () => {
    const response = await start(BARE_CARD_ID, { scope: 'texts' });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.preparationInputIncomplete);
    assert.deepEqual(queue.jobs, []);
  });

  it('answers preparation_input_incomplete for a price run on a card without titles (AC-27)', async () => {
    const response = await start(UNTITLED_CARD_ID, { scope: 'price' });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.preparationInputIncomplete);
    assert.deepEqual(queue.jobs, []);
  });

  it('starts a price run on a card without frames, leaving the texts alone (AC-10b)', async () => {
    const response = await start(BARE_CARD_ID, { scope: 'price' });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(
      queue.jobs.map((job) => job.scope),
      ['price'],
    );
  });

  it('rejects a field run without a draft as validation_failed (DoD field)', async () => {
    const response = await start(CARD_ID, { scope: 'field', field: 'titleOlx' });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.validationFailed);
    assert.deepEqual(queue.jobs, []);
  });

  it('rejects a field run without the field as validation_failed (DoD field)', async () => {
    const response = await start(CARD_ID, { scope: 'field', draftText: 'Миша Logitech' });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.validationFailed);
    assert.deepEqual(queue.jobs, []);
  });

  it('queues a field run that names the field and its draft (Checklist 1)', async () => {
    const response = await start(CARD_ID, {
      scope: 'field',
      field: 'titleOlx',
      draftText: 'Миша Logitech',
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(queue.jobs, [
      {
        runId: response.json<RunBody>().id,
        productId: CARD_ID,
        scope: 'field',
        field: 'titleOlx',
        draftText: 'Миша Logitech',
      },
    ]);
  });

  it('rejects an unknown scope as validation_failed (Checklist 1)', async () => {
    const response = await start(CARD_ID, { scope: 'everything' });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.validationFailed);
    assert.deepEqual(queue.jobs, []);
  });

  it('answers preparation_rate_limited once the window is used up, not silence or 500 (DoD rate limit)', async () => {
    runs.recentRuns = 20;

    const response = await start(CARD_ID, { scope: 'texts' });

    assert.equal(response.statusCode, 429);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.preparationRateLimited);
    assert.deepEqual(queue.jobs, []);
  });

  it('answers product_not_found for starting a run on a card that does not exist (Checklist 3)', async () => {
    const response = await start(MISSING_CARD_ID, { scope: 'texts' });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json<{ code: string }>().code, apiErrorCodes.productNotFound);
  });

  it('answers the polled run with its state, tokens and ISO timestamps (Checklist 3)', async () => {
    const response = await poll(CARD_ID, FINISHED_RUN_ID);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json<RunBody>(), {
      id: FINISHED_RUN_ID,
      productId: CARD_ID,
      scope: 'both',
      status: 'failed',
      errorCode: 'price_unavailable',
      model: 'claude-sonnet-5',
      inputTokens: 1200,
      outputTokens: 300,
      createdAt: '2026-09-19T10:00:00.000Z',
      startedAt: '2026-09-19T10:00:01.000Z',
      finishedAt: '2026-09-19T10:00:40.000Z',
    });
  });

  it('answers 404 for polling a run through another card (Checklist 3)', async () => {
    const response = await poll(BARE_CARD_ID, FINISHED_RUN_ID);

    assert.equal(response.statusCode, 404);
  });

  it('puts both preparation routes behind the session guard (Checklist 3)', async () => {
    allowed = false;

    const started = await start(CARD_ID, { scope: 'texts' });
    const polled = await poll(CARD_ID, FINISHED_RUN_ID);

    assert.equal(started.statusCode, 401);
    assert.equal(polled.statusCode, 401);
    assert.deepEqual(queue.jobs, []);
  });
});
