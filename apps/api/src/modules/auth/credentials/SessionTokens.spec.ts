import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SessionTokens } from './SessionTokens.ts';

const SECRET = 'test-secret-that-is-long-enough-for-hs256';
const OTHER_SECRET = 'another-secret-that-is-long-enough-for-hs256';
const USER_ID = '11111111-1111-4111-8111-111111111111';

/**
 * JWT stores iat/exp with one-second precision and checks them against the real clock,
 * so "now" here is genuine, only truncated to a second — otherwise date comparisons would
 * drift by milliseconds, and a fixed date in the past would simply be expired.
 */
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000);

function makeTokens(secret = SECRET): SessionTokens {
  return new SessionTokens({
    secret,
    issuer: 'mouse.test',
    audience: 'mouse-admin',
    algorithm: 'HS256',
  });
}

describe('session tokens (JWT)', () => {
  it('issues a token it can read back', async () => {
    const tokens = makeTokens();

    const issued = await tokens.issue({
      userId: USER_ID,
      email: 'admin@example.com',
      ttlSeconds: 3600,
      now: NOW,
    });
    const claims = await tokens.verify(issued.token);

    assert.ok(claims !== null);
    assert.equal(claims.userId, USER_ID);
    assert.equal(claims.email, 'admin@example.com');
    assert.equal(claims.issuedAt.getTime(), NOW.getTime());
    assert.equal(claims.expiresAt.getTime(), NOW.getTime() + 3600 * 1000);
    assert.equal(issued.expiresAt.getTime(), claims.expiresAt.getTime());
  });

  it('does not accept a token signed with a different secret', async () => {
    const issued = await makeTokens(OTHER_SECRET).issue({
      userId: USER_ID,
      email: 'admin@example.com',
      ttlSeconds: 3600,
      now: NOW,
    });

    assert.equal(await makeTokens().verify(issued.token), null);
  });

  it('does not accept a tampered payload', async () => {
    const tokens = makeTokens();
    const issued = await tokens.issue({
      userId: USER_ID,
      email: 'admin@example.com',
      ttlSeconds: 3600,
      now: NOW,
    });
    const [header, payload, signature] = issued.token.split('.');
    assert.ok(header !== undefined && payload !== undefined && signature !== undefined);

    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const tampered = Buffer.from(
      JSON.stringify({ ...(decoded as Record<string, unknown>), sub: 'someone-else' }),
      'utf8',
    ).toString('base64url');

    assert.equal(await tokens.verify(`${header}.${tampered}.${signature}`), null);
  });

  it('does not accept an expired token', async () => {
    const tokens = makeTokens();
    const expired = await tokens.issue({
      userId: USER_ID,
      email: 'admin@example.com',
      ttlSeconds: 1,
      now: new Date(Date.now() - 60_000),
    });

    assert.equal(await tokens.verify(expired.token), null);
  });

  it('does not accept garbage instead of a token', async () => {
    const tokens = makeTokens();

    assert.equal(await tokens.verify('not-a-jwt'), null);
    assert.equal(await tokens.verify(''), null);
  });
});
