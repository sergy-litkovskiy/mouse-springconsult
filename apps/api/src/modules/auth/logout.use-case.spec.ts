import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFixedClock, createInMemoryUserRepository, makeUser } from './auth.fixtures.ts';
import { createLogout } from './logout.use-case.ts';

const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('logout use-case', () => {
  it('moves the token validity boundary to "now"', async () => {
    const user = makeUser();
    const repository = createInMemoryUserRepository([user]);
    const logout = createLogout({ users: repository, clock: createFixedClock(NOW) });

    await logout(user.id);

    assert.equal(repository.get(user.id)?.tokensValidFrom.getTime(), NOW.getTime());
  });

  it('does not fail on an unknown user', async () => {
    const repository = createInMemoryUserRepository([]);
    const logout = createLogout({ users: repository, clock: createFixedClock(NOW) });

    await assert.doesNotReject(logout('11111111-1111-4111-8111-111111111111'));
  });
});
