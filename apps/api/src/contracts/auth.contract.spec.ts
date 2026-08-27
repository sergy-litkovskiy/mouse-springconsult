import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { loginRequestSchema } from './auth.contract.ts';

describe('loginRequestSchema', () => {
  it('normalises the email and defaults rememberMe', () => {
    const parsed = loginRequestSchema.parse({
      email: '  Admin@Example.COM  ',
      password: 'correct-horse',
    });

    assert.equal(parsed.email, 'admin@example.com');
    assert.equal(parsed.rememberMe, false);
  });

  it('rejects a malformed email', () => {
    const result = loginRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'correct-horse',
    });

    assert.ok(!result.success);
    assert.deepEqual(Object.keys(z.flattenError(result.error).fieldErrors), ['email']);
  });

  it('rejects a password that is too short', () => {
    const result = loginRequestSchema.safeParse({ email: 'admin@example.com', password: 'short' });

    assert.ok(!result.success);
    assert.deepEqual(Object.keys(z.flattenError(result.error).fieldErrors), ['password']);
  });

  it('accepts rememberMe', () => {
    const parsed = loginRequestSchema.parse({
      email: 'admin@example.com',
      password: 'correct-horse',
      rememberMe: true,
    });

    assert.equal(parsed.rememberMe, true);
  });
});
