import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { prepareTestDatabase, resetTables, testDatabaseUrl } from '../../../db/test-database.ts';
import { createDataSource } from '../../db.ts';
import { USERS_TABLE, User } from './User.ts';
import { UserRepository } from './UserRepository.ts';

/**
 * The user repository against a real Postgres: the email lookup and the two writes a
 * session depends on. The stub in `AuthService.spec.ts` promises the service the same
 * behaviour; this is where the promise is checked against the database.
 */
const EPOCH = new Date('2026-01-01T00:00:00.000Z');
const LOGIN_AT = new Date('2026-03-01T12:00:00.000Z');

const dataSource = createDataSource({ url: testDatabaseUrl(), entities: [User] });

let users: UserRepository;

async function seedUser(
  overrides: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Promise<string> {
  const row: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
    email: 'admin@example.com',
    displayName: 'Адміністратор',
    passwordHash: '$argon2id$not-a-real-hash',
    isActive: true,
    tokensValidFrom: EPOCH,
    lastLoginAt: null,
    ...overrides,
  };

  const saved = await dataSource.getRepository(User).save(row);
  return saved.id;
}

describe('user repository (postgres)', () => {
  before(async () => {
    await prepareTestDatabase();
    await dataSource.initialize();
    users = new UserRepository(dataSource);
  });

  after(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetTables(dataSource, [USERS_TABLE]);
  });

  it('finds a user whose email was typed in another case and with spaces', async () => {
    const id = await seedUser({ email: 'admin@example.com' });

    const found = await users.findByEmail('  ADMIN@Example.COM  ');

    assert.equal(found?.id, id);
  });

  it('returns null for an email nobody signed up with', async () => {
    await seedUser();

    assert.equal(await users.findByEmail('stranger@example.com'), null);
  });

  it('records the moment of a successful sign-in', async () => {
    const id = await seedUser();

    await users.recordLogin(id, LOGIN_AT);

    assert.equal((await users.findById(id))?.lastLoginAt?.getTime(), LOGIN_AT.getTime());
  });

  it('moves the token validity boundary on revocation', async () => {
    const id = await seedUser();

    await users.revokeTokensIssuedBefore(id, LOGIN_AT);

    const user = await users.findById(id);
    assert.ok(user !== null);
    assert.equal(user.tokensValidFrom.getTime(), LOGIN_AT.getTime());
    // Revocation touches nothing else: an account is not deactivated by signing out.
    assert.equal(user.isActive, true);
  });
});
