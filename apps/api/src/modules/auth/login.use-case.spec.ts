import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidCredentials, UserDeactivated } from './auth.errors.ts';
import {
  createFakePasswordHasher,
  createFakeSessionTokens,
  createFixedClock,
  createInMemoryUserRepository,
  makeUser,
} from './auth.fixtures.ts';
import { createLogin, type LoginDependencies } from './login.use-case.ts';
import type { User } from './user.ts';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const TTL_SECONDS = 3600;
const REMEMBER_ME_TTL_SECONDS = 86_400;

function setup(users: readonly User[]) {
  const repository = createInMemoryUserRepository(users);
  const passwordHasher = createFakePasswordHasher();
  const dependencies: LoginDependencies = {
    users: repository,
    passwordHasher,
    sessionTokens: createFakeSessionTokens(),
    clock: createFixedClock(NOW),
    ttlSeconds: TTL_SECONDS,
    rememberMeTtlSeconds: REMEMBER_ME_TTL_SECONDS,
  };
  return { login: createLogin(dependencies), repository, passwordHasher };
}

describe('login use-case', () => {
  it('issues a token and returns the public fields of the user', async () => {
    const user = makeUser();
    const { login } = setup([user]);

    const result = await login({
      email: 'admin@example.com',
      password: 'correct-horse',
      rememberMe: false,
    });

    assert.equal(result.user.id, user.id);
    assert.equal(result.user.email, user.email);
    assert.equal(result.user.displayName, user.displayName);
    assert.equal(result.ttlSeconds, TTL_SECONDS);
    assert.equal(result.expiresAt.getTime(), NOW.getTime() + TTL_SECONDS * 1000);
    assert.ok(result.token.length > 0);
    assert.equal(Object.hasOwn(result.user, 'passwordHash'), false);
  });

  it('normalises the email: case and spaces do not prevent signing in', async () => {
    const { login } = setup([makeUser()]);

    const result = await login({
      email: '  ADMIN@Example.COM ',
      password: 'correct-horse',
      rememberMe: false,
    });

    assert.equal(result.user.email, 'admin@example.com');
  });

  it('"remember me" extends the lifetime of the token', async () => {
    const { login } = setup([makeUser()]);

    const result = await login({
      email: 'admin@example.com',
      password: 'correct-horse',
      rememberMe: true,
    });

    assert.equal(result.rememberMe, true);
    assert.equal(result.ttlSeconds, REMEMBER_ME_TTL_SECONDS);
    assert.equal(result.expiresAt.getTime(), NOW.getTime() + REMEMBER_ME_TTL_SECONDS * 1000);
  });

  it('records the moment of the sign-in', async () => {
    const user = makeUser();
    const { login, repository } = setup([user]);

    await login({ email: user.email, password: 'correct-horse', rememberMe: false });

    assert.equal(repository.get(user.id)?.lastLoginAt?.getTime(), NOW.getTime());
  });

  it('rejects a wrong password', async () => {
    const { login } = setup([makeUser()]);

    await assert.rejects(
      login({ email: 'admin@example.com', password: 'wrong', rememberMe: false }),
      InvalidCredentials,
    );
  });

  it('still verifies the password against a decoy hash for an unknown email', async () => {
    const { login, passwordHasher } = setup([makeUser()]);

    await assert.rejects(
      login({ email: 'nobody@example.com', password: 'whatever', rememberMe: false }),
      InvalidCredentials,
    );

    // Without this call the response time would reveal whether such an email exists.
    assert.deepEqual(passwordHasher.verifiedHashes, [passwordHasher.decoyHash]);
  });

  it('does not let a deactivated user in', async () => {
    const { login } = setup([makeUser({ isActive: false })]);

    await assert.rejects(
      login({ email: 'admin@example.com', password: 'correct-horse', rememberMe: false }),
      UserDeactivated,
    );
  });

  it('gives a deactivated user with a wrong password the same error as everyone else', async () => {
    const { login } = setup([makeUser({ isActive: false })]);

    // The order of the checks is deliberate: account state must not leak through password guessing.
    await assert.rejects(
      login({ email: 'admin@example.com', password: 'wrong', rememberMe: false }),
      InvalidCredentials,
    );
  });
});
