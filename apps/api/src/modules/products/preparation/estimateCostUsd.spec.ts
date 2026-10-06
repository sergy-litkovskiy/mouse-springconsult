import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateCostUsd } from './estimateCostUsd.ts';

const PRICING = {
  'claude-sonnet-5': { inputMicroDollarsPerToken: 2, outputMicroDollarsPerToken: 10 },
} as const;

describe('estimateCostUsd', () => {
  it('answers "0.0000" for a card that has had no runs, not null', () => {
    assert.equal(estimateCostUsd([], PRICING), '0.0000');
  });

  it('sums every run of the only priced model and formats the dollars with four digits (AC-84 happy path)', () => {
    const cost = estimateCostUsd(
      [{ model: 'claude-sonnet-5', inputTokens: 1340, outputTokens: 255 }],
      PRICING,
    );

    assert.equal(cost, '0.0052');
  });

  it('answers null when at least one row names a model the pricing table does not hold (AC-84 error)', () => {
    const cost = estimateCostUsd(
      [
        { model: 'claude-sonnet-5', inputTokens: 1000, outputTokens: 200 },
        { model: 'claude-opus-5', inputTokens: 500, outputTokens: 100 },
      ],
      PRICING,
    );

    assert.equal(cost, null);
  });

  it('rounds half-up at the fifth decimal, which is the boundary of the fourth', () => {
    // 150 µ$ = $0.00015, which rounds to $0.0002, not $0.0001.
    const cost = estimateCostUsd(
      [{ model: 'claude-sonnet-5', inputTokens: 75, outputTokens: 0 }],
      PRICING,
    );

    assert.equal(cost, '0.0002');
  });

  it('rounds down below the half, so a value just under the boundary stays on the lower digit', () => {
    // 148 µ$ = $0.000148 rounds to $0.0001.
    const cost = estimateCostUsd(
      [{ model: 'claude-sonnet-5', inputTokens: 74, outputTokens: 0 }],
      PRICING,
    );

    assert.equal(cost, '0.0001');
  });

  it('pads the fractional part to four digits even when it ends in zeros', () => {
    // 10_000 µ$ = $0.01 → "0.0100".
    const cost = estimateCostUsd(
      [{ model: 'claude-sonnet-5', inputTokens: 5000, outputTokens: 0 }],
      PRICING,
    );

    assert.equal(cost, '0.0100');
  });

  it('carries the integer part past one dollar', () => {
    // 1_234_567 µ$ = $1.234567 → rounds to $1.2346.
    const cost = estimateCostUsd(
      [{ model: 'claude-sonnet-5', inputTokens: 617_283, outputTokens: 1 }],
      PRICING,
    );

    assert.equal(cost, '1.2346');
  });

  it('adds the rows of one model, not of the whole input, before pricing', () => {
    const cost = estimateCostUsd(
      [
        { model: 'claude-sonnet-5', inputTokens: 1000, outputTokens: 200 },
        { model: 'claude-sonnet-5', inputTokens: 340, outputTokens: 55 },
      ],
      PRICING,
    );

    assert.equal(cost, '0.0052');
  });
});
