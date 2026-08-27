import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { InvalidCredentials, NotAuthenticated, UserDeactivated } from './AuthErrors.ts';
import { AuthService } from './AuthService.ts';
import { PasswordHasher } from './PasswordHasher.ts';
import { SessionTokens } from './SessionTokens.ts';
import { SystemClock } from './SystemClock.ts';
import { User } from './User.ts';
import { UserRepository } from './UserRepository.ts';

/**
 * The service without a database and without argon2. The doubles are subclasses of the
 * real collaborators: overriding a method is enough, and the signature the service calls
 * is checked by the compiler rather than restated in a hand-written fake.
 *
 * `SessionTokens` is the genuine one — jose signs an HS256 token in microseconds, so
 * there is nothing to gain by faking it and something to lose: the spec then also proves
 * that a token this service issues is a token it accepts back.
 */
/**
 * "Now" is genuine, only truncated to a second: jose writes `iat`/`exp` with one-second
 * precision and checks them against the real clock, so a fixed date in the past would
 * hand every test an already expired token.
 */
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const EPOCH = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
const TTL_SECONDS = 3600;
const REMEMBER_ME_TTL_SECONDS = 86_400;

/** The DataSource is never reached: every method that would use it is overridden. */
const NO_DATA_SOURCE = undefined as unknown as DataSource;

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  Object.assign(user, {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    displayName: 'Адміністратор',
    passwordHash: 'hashed:correct-horse',
    isActive: true,
    tokensValidFrom: EPOCH,
    lastLoginAt: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  });
  return user;
}

class StubUserRepository extends UserRepository {
  private readonly rows: Map<string, User>;

  constructor(seed: readonly User[] = []) {
    super(NO_DATA_SOURCE);
    this.rows = new Map(seed.map((user) => [user.id, user]));
  }

  get(id: string): User | undefined {
    return this.rows.get(id);
  }

  override async findByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    return [...this.rows.values()].find((user) => user.email === needle) ?? null;
  }

  override async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  override async recordLogin(userId: string, at: Date): Promise<void> {
    this.patch(userId, { lastLoginAt: at });
  }

  override async revokeTokensIssuedBefore(userId: string, at: Date): Promise<void> {
    this.patch(userId, { tokensValidFrom: at });
  }

  /** In place, the way TypeORM writes to an entity — a row here is a mutable object. */
  private patch(id: string, changes: Partial<User>): void {
    const existing = this.rows.get(id);
    if (existing !== undefined) {
      Object.assign(existing, changes);
    }
  }
}

/** Hashing boils down to a prefix — the spec checks the logic, not argon2. */
class StubPasswordHasher extends PasswordHasher {
  readonly verifiedHashes: string[] = [];

  override async hash(plainPassword: string): Promise<string> {
    return `hashed:${plainPassword}`;
  }

  override async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    this.verifiedHashes.push(passwordHash);
    return passwordHash === `hashed:${plainPassword}`;
  }
}

class FixedClock extends SystemClock {
  constructor(private current: Date) {
    super();
  }

  override now(): Date {
    return this.current;
  }

  set(at: Date): void {
    this.current = at;
  }
}

function setup(users: readonly User[] = [makeUser()]): {
  auth: AuthService;
  repository: StubUserRepository;
  passwordHasher: StubPasswordHasher;
  clock: FixedClock;
} {
  const repository = new StubUserRepository(users);
  const passwordHasher = new StubPasswordHasher();
  const clock = new FixedClock(NOW);
  const auth = new AuthService(
    repository,
    passwordHasher,
    new SessionTokens({
      secret: 'test-secret-that-is-long-enough-for-hs256',
      issuer: 'mouse.test',
      audience: 'mouse-admin',
      algorithm: 'HS256',
    }),
    clock,
    { ttlSeconds: TTL_SECONDS, rememberMeTtlSeconds: REMEMBER_ME_TTL_SECONDS },
  );

  return { auth, repository, passwordHasher, clock };
}

describe('auth service — login', () => {
  it('issues a token and returns the public fields of the user', async () => {
    const user = makeUser();
    const { auth } = setup([user]);

    const result = await auth.login({
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
    const { auth } = setup();

    const result = await auth.login({
      email: '  ADMIN@Example.COM ',
      password: 'correct-horse',
      rememberMe: false,
    });

    assert.equal(result.user.email, 'admin@example.com');
  });

  it('"remember me" extends the lifetime of the token', async () => {
    const { auth } = setup();

    const result = await auth.login({
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
    const { auth, repository } = setup([user]);

    await auth.login({ email: user.email, password: 'correct-horse', rememberMe: false });

    assert.equal(repository.get(user.id)?.lastLoginAt?.getTime(), NOW.getTime());
  });

  it('rejects a wrong password', async () => {
    const { auth } = setup();

    await assert.rejects(
      auth.login({ email: 'admin@example.com', password: 'wrong', rememberMe: false }),
      InvalidCredentials,
    );
  });

  it('still verifies the password against a decoy hash for an unknown email', async () => {
    const { auth, passwordHasher } = setup();

    await assert.rejects(
      auth.login({ email: 'nobody@example.com', password: 'whatever', rememberMe: false }),
      InvalidCredentials,
    );

    // Without this call the response time would reveal whether such an email exists.
    assert.deepEqual(passwordHasher.verifiedHashes, [passwordHasher.decoyHash]);
  });

  it('does not let a deactivated user in', async () => {
    const { auth } = setup([makeUser({ isActive: false })]);

    await assert.rejects(
      auth.login({ email: 'admin@example.com', password: 'correct-horse', rememberMe: false }),
      UserDeactivated,
    );
  });

  it('gives a deactivated user with a wrong password the same error as everyone else', async () => {
    const { auth } = setup([makeUser({ isActive: false })]);

    // The order of the checks is deliberate: account state must not leak through password guessing.
    await assert.rejects(
      auth.login({ email: 'admin@example.com', password: 'wrong', rememberMe: false }),
      InvalidCredentials,
    );
  });
});

async function signIn(auth: AuthService, email = 'admin@example.com'): Promise<string> {
  const result = await auth.login({ email, password: 'correct-horse', rememberMe: false });
  return result.token;
}

describe('auth service — authenticate', () => {
  it('returns a session for a valid token', async () => {
    const user = makeUser();
    const { auth } = setup([user]);
    const token = await signIn(auth);

    const session = await auth.authenticate(token);

    assert.equal(session.user.id, user.id);
    assert.equal(session.expiresAt.getTime(), NOW.getTime() + TTL_SECONDS * 1000);
  });

  it('answers "not authenticated" when there is no cookie', async () => {
    const { auth } = setup();

    await assert.rejects(auth.authenticate(undefined), NotAuthenticated);
    await assert.rejects(auth.authenticate(''), NotAuthenticated);
  });

  it('rejects a forged token', async () => {
    const { auth } = setup();

    await assert.rejects(auth.authenticate('token-forged'), NotAuthenticated);
  });

  it('stops accepting a previously issued token after logout', async () => {
    const user = makeUser();
    const { auth, clock } = setup([user]);
    const token = await signIn(auth);
    await assert.doesNotReject(auth.authenticate(token));

    // A token carries `iat` with one-second precision, so the boundary has to move by a
    // whole second to land after it.
    clock.set(new Date(NOW.getTime() + 1000));
    await auth.logout(user.id);

    await assert.rejects(auth.authenticate(token), NotAuthenticated);
  });

  it('rejects the token of a deactivated user without waiting for it to expire', async () => {
    const user = makeUser();
    const { auth } = setup([user]);
    const token = await signIn(auth);

    user.isActive = false;

    await assert.rejects(auth.authenticate(token), NotAuthenticated);
  });

  it('rejects the token of a deleted user', async () => {
    const user = makeUser();
    const { auth } = setup([user]);
    const token = await signIn(auth);

    // A different service — the same secret, an empty database behind it.
    const { auth: withoutUsers } = setup([]);

    await assert.rejects(withoutUsers.authenticate(token), NotAuthenticated);
  });
});

describe('auth service — logout', () => {
  it('moves the token validity boundary to "now"', async () => {
    const user = makeUser();
    const { auth, repository } = setup([user]);

    await auth.logout(user.id);

    assert.equal(repository.get(user.id)?.tokensValidFrom.getTime(), NOW.getTime());
  });

  it('does not fail on an unknown user', async () => {
    const { auth } = setup([]);

    await assert.doesNotReject(auth.logout('11111111-1111-4111-8111-111111111111'));
  });
});
