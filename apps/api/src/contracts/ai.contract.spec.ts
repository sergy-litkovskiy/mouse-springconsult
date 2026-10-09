import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { preparationRunRequestSchema, preparationRunSchema } from './ai.contract.ts';
import { productConstraints } from './products-limits.ts';

describe('preparationRunRequestSchema: field branch mode', () => {
  it("accepts 'improve' as the mode", () => {
    const result = preparationRunRequestSchema.safeParse({
      scope: 'field',
      field: 'titleProm',
      draftText: 'миша лоджитек',
      mode: 'improve',
    });
    assert.equal(result.success, true);
  });

  it("accepts 'prompt' as the mode", () => {
    const result = preparationRunRequestSchema.safeParse({
      scope: 'field',
      field: 'titleOlx',
      draftText: 'миша лоджитек',
      mode: 'prompt',
    });
    assert.equal(result.success, true);
  });

  it("defaults to 'improve' when mode is absent", () => {
    const result = preparationRunRequestSchema.safeParse({
      scope: 'field',
      field: 'titleProm',
      draftText: 'миша лоджитек',
    });
    assert.ok(result.success);
    assert.ok(result.data.scope === 'field');
    assert.equal(result.data.mode, 'improve');
  });

  it('rejects an unknown mode value', () => {
    const result = preparationRunRequestSchema.safeParse({
      scope: 'field',
      field: 'titleProm',
      draftText: 'миша лоджитек',
      mode: 'auto',
    });
    assert.equal(result.success, false);
  });
});

describe('preparationRunRequestSchema: price branch', () => {
  const priceRun = {
    scope: 'price',
    titleProm: 'Миша Logitech MX Master 3',
    titleOlx: 'Миша Logitech MX Master 3 бездротова',
    descriptionProm: '<p>Бездротова миша, стан відмінний.</p>',
    descriptionOlx: 'Продаю бездротову мишу, стан відмінний.',
  };

  it('carries the four draft strings of a price run', () => {
    const result = preparationRunRequestSchema.safeParse(priceRun);

    assert.ok(result.success);
    assert.deepEqual(result.data, priceRun);
  });

  it('accepts a price draft of empty strings, leaving the gap for the service to name', () => {
    const empty = {
      scope: 'price',
      titleProm: '',
      titleOlx: '',
      descriptionProm: '',
      descriptionOlx: '',
    };

    const result = preparationRunRequestSchema.safeParse(empty);

    assert.ok(result.success);
    assert.deepEqual(result.data, empty);
  });

  it('accepts a price draft longer than the card allows, since the search input is cut later', () => {
    const long = {
      ...priceRun,
      titleProm: 'М'.repeat(productConstraints.titleMaxLength + 1),
      descriptionProm: 'о'.repeat(50_000),
    };

    const result = preparationRunRequestSchema.safeParse(long);

    assert.ok(result.success);
    assert.deepEqual(result.data, long);
  });

  it('rejects a price run that lacks any of the four draft strings', () => {
    for (const absent of ['titleProm', 'titleOlx', 'descriptionProm', 'descriptionOlx'] as const) {
      const incomplete = Object.fromEntries(
        Object.entries(priceRun).filter(([key]) => key !== absent),
      );

      assert.equal(preparationRunRequestSchema.safeParse(incomplete).success, false, absent);
    }
  });
});

describe('preparationRunSchema: errorCode', () => {
  const failedPriceRun = {
    id: '44444444-4444-4444-8444-444444444444',
    productId: '11111111-1111-4111-8111-111111111111',
    scope: 'price',
    status: 'failed',
    errorDetail: null,
    model: 'gemini-3.5-flash-lite',
    inputTokens: 0,
    outputTokens: 0,
    createdAt: '2026-10-08T09:00:00.000Z',
    startedAt: '2026-10-08T09:00:01.000Z',
    finishedAt: '2026-10-08T09:00:20.000Z',
  };

  it('accepts a run closed as price_not_found', () => {
    const result = preparationRunSchema.safeParse({
      ...failedPriceRun,
      errorCode: 'price_not_found',
    });
    assert.equal(result.success, true);
  });

  it('accepts a run closed as price_quota_exhausted', () => {
    const result = preparationRunSchema.safeParse({
      ...failedPriceRun,
      errorCode: 'price_quota_exhausted',
    });
    assert.equal(result.success, true);
  });
});
