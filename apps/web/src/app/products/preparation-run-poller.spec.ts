import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PreparationRunDto } from '@contracts/ai.contract';
import type { ApiError } from '@contracts/error.contract';
import { PreparationRunPoller } from './preparation-run-poller';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '22222222-2222-4222-8222-222222222222';
const RUN_URL = `/api/products/${PRODUCT_ID}/preparation-runs/${RUN_ID}`;
const PRICE_RUN_ID = '33333333-3333-4333-8333-333333333333';
const PRICE_RUN_URL = `/api/products/${PRODUCT_ID}/preparation-runs/${PRICE_RUN_ID}`;

/**
 * Wider than any sane interval on purpose: what is fixed here is that the next ask follows
 * within seconds, not how many seconds the poller waits between them.
 */
const POLL_WINDOW_MS = 30_000;

const RUNNING: PreparationRunDto = {
  id: RUN_ID,
  productId: PRODUCT_ID,
  scope: 'texts',
  status: 'running',
  errorCode: null,
  errorDetail: null,
  model: 'claude-sonnet-5',
  inputTokens: 0,
  outputTokens: 0,
  createdAt: '2026-09-20T09:00:00.000Z',
  startedAt: '2026-09-20T09:00:05.000Z',
  finishedAt: null,
};

const SUCCEEDED: PreparationRunDto = {
  ...RUNNING,
  status: 'succeeded',
  inputTokens: 1200,
  outputTokens: 800,
  finishedAt: '2026-09-20T09:00:35.000Z',
};

const PRICE_RUN_RUNNING: PreparationRunDto = {
  ...RUNNING,
  id: PRICE_RUN_ID,
  scope: 'price',
};

const FAILED: PreparationRunDto = {
  ...RUNNING,
  status: 'failed',
  errorCode: 'price_unavailable',
  inputTokens: 1200,
  outputTokens: 0,
  finishedAt: '2026-09-20T09:00:35.000Z',
};

describe('PreparationRunPoller', () => {
  let injector: EnvironmentInjector;
  let poller: PreparationRunPoller;
  let http: HttpTestingController;
  let screenIsGone: boolean;

  /** The screen that started the run: leaving it destroys the injector the poller lives in. */
  function leaveScreen(): void {
    if (!screenIsGone) {
      screenIsGone = true;
      injector.destroy();
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    injector = createEnvironmentInjector(
      [PreparationRunPoller],
      TestBed.inject(EnvironmentInjector),
    );
    poller = injector.get(PreparationRunPoller);
    screenIsGone = false;
  });

  afterEach(() => {
    leaveScreen();
    http.verify();
    vi.useRealTimers();
  });

  it('keeps asking for the state of a run that is still going (AC-05)', async () => {
    poller.watch(PRODUCT_ID, RUN_ID);

    const first = http.expectOne(RUN_URL);
    expect(first.request.method).toBe('GET');
    first.flush(RUNNING);
    expect(poller.run()).toEqual(RUNNING);

    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS);

    http.expectOne(RUN_URL).flush(SUCCEEDED);
    expect(poller.run()).toEqual(SUCCEEDED);
  });

  it('stops asking once the run has succeeded (AC-05)', async () => {
    poller.watch(PRODUCT_ID, RUN_ID);
    http.expectOne(RUN_URL).flush(SUCCEEDED);

    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS * 2);

    http.expectNone(RUN_URL);
    expect(poller.run()).toEqual(SUCCEEDED);
  });

  it('stops asking once the run has failed, keeping the code it reported (DoD: a terminal state stops the timer)', async () => {
    poller.watch(PRODUCT_ID, RUN_ID);
    http.expectOne(RUN_URL).flush(FAILED);

    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS * 2);

    http.expectNone(RUN_URL);
    expect(poller.run()).toEqual(FAILED);
  });

  it('stops asking when the screen that started the run is gone (DoD: leaving the screen stops the timer)', async () => {
    poller.watch(PRODUCT_ID, RUN_ID);
    http.expectOne(RUN_URL).flush(RUNNING);

    leaveScreen();
    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS * 2);

    // A timer left behind spends the rate limit of a card nobody is looking at any more.
    http.expectNone(RUN_URL);
  });

  it('gives up on a state request that came back as an error and calls the run failed (DoD: a terminal state stops the timer)', async () => {
    poller.watch(PRODUCT_ID, RUN_ID);
    http.expectOne(RUN_URL).flush(RUNNING);

    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS);
    const refused: ApiError = {
      error: { code: 'too_many_requests', message: 'Too many preparation runs' },
    };
    http.expectOne(RUN_URL).flush(refused, { status: 429, statusText: 'Too Many Requests' });

    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS * 2);

    // Asking again is what got refused in the first place, and every ask is paid for.
    http.expectNone(RUN_URL);
    // The screen cannot tell a dead poll from a dead run, and to the admin both mean the same.
    const state = poller.run();
    expect(state?.id).toBe(RUN_ID);
    expect(state?.status).toBe('failed');
    expect(state?.errorCode).toBe('preparation_failed');
  });

  it('stops asking about the run it was watching when a new run is started (DoD: one timer at a time)', async () => {
    poller.watch(PRODUCT_ID, RUN_ID);
    http.expectOne(RUN_URL).flush(RUNNING);

    poller.watch(PRODUCT_ID, PRICE_RUN_ID);
    http.expectOne(PRICE_RUN_URL).flush(PRICE_RUN_RUNNING);

    await vi.advanceTimersByTimeAsync(POLL_WINDOW_MS);

    // Two timers on one card eat the rate limit twice as fast as one.
    http.expectNone(RUN_URL);
    http.expectOne(PRICE_RUN_URL).flush({ ...PRICE_RUN_RUNNING, status: 'succeeded' });
    expect(poller.run()?.id).toBe(PRICE_RUN_ID);
  });
});
