import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotAuthenticated } from './auth.errors.ts';
import {
  createFakeSessionTokens,
  createInMemoryUserRepository,
  makeUser,
} from './auth.fixtures.ts';
import { createAuthenticate } from './authenticate.use-case.ts';
import { createLogout } from './logout.use-case.ts';
import type { SessionTokens } from './auth.port.ts';

const NOW = new Date('2026-03-01T10:00:00.000Z');

async function issueTokenFor(tokens: SessionTokens, userId: string, at: Date): Promise<string> {
  const issued = await tokens.issue({
    userId,
    email: 'admin@example.com',
    ttlSeconds: 3600,
    now: at,
  });
  return issued.token;
}

describe('authenticate use-case', () => {
  it('returns a session for a valid token', async () => {
    const user = makeUser();
    const users = createInMemoryUserRepository([user]);
    const sessionTokens = createFakeSessionTokens();
    const authenticate = createAuthenticate({ users, sessionTokens });
    const token = await issueTokenFor(sessionTokens, user.id, NOW);

    const session = await authenticate(token);

    assert.equal(session.user.id, user.id);
    assert.equal(session.expiresAt.getTime(), NOW.getTime() + 3600 * 1000);
  });

  it('answers "not authenticated" when there is no cookie', async () => {
    const authenticate = createAuthenticate({
      users: createInMemoryUserRepository([makeUser()]),
      sessionTokens: createFakeSessionTokens(),
    });

    await assert.rejects(authenticate(undefined), NotAuthenticated);
    await assert.rejects(authenticate(''), NotAuthenticated);
  });

  it('rejects an unknown token', async () => {
    const authenticate = createAuthenticate({
      users: createInMemoryUserRepository([makeUser()]),
      sessionTokens: createFakeSessionTokens(),
    });

    await assert.rejects(authenticate('token-forged'), NotAuthenticated);
  });

  it('stops accepting a previously issued token after logout', async () => {
    const user = makeUser();
    const users = createInMemoryUserRepository([user]);
    const sessionTokens = createFakeSessionTokens();
    const authenticate = createAuthenticate({ users, sessionTokens });
    const token = await issueTokenFor(sessionTokens, user.id, NOW);
    await assert.doesNotReject(authenticate(token));

    const logout = createLogout({
      users,
      clock: { now: () => new Date(NOW.getTime() + 1000) },
    });
    await logout(user.id);

    await assert.rejects(authenticate(token), NotAuthenticated);
  });

  it('rejects the token of a deactivated user without waiting for it to expire', async () => {
    const user = makeUser({ isActive: false });
    const users = createInMemoryUserRepository([user]);
    const sessionTokens = createFakeSessionTokens();
    const authenticate = createAuthenticate({ users, sessionTokens });
    const token = await issueTokenFor(sessionTokens, user.id, NOW);

    await assert.rejects(authenticate(token), NotAuthenticated);
  });

  it('rejects the token of a deleted user', async () => {
    const sessionTokens = createFakeSessionTokens();
    const token = await issueTokenFor(sessionTokens, '11111111-1111-4111-8111-111111111111', NOW);
    const authenticate = createAuthenticate({
      users: createInMemoryUserRepository([]),
      sessionTokens,
    });

    await assert.rejects(authenticate(token), NotAuthenticated);
  });
});
