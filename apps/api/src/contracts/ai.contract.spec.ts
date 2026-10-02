import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { preparationRunRequestSchema } from './ai.contract.ts';

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
