import type {
  Clock,
  IssuedToken,
  IssueTokenInput,
  PasswordHasher,
  SessionClaims,
  SessionTokens,
  UserRepository,
} from './auth.port.ts';
import type { User } from './user.ts';

/**
 * Test doubles for the ports. Used from `*.spec.ts` only — the rule is pinned down in
 * `.dependency-cruiser.cjs` so they cannot leak into runtime code.
 *
 * This is exactly what describing the domain with ports buys: not one of the tests below
 * needs Postgres, argon2 or a network.
 */

const EPOCH = new Date('2026-01-01T00:00:00.000Z');

export function makeUser(overrides: Partial<User> = {}): User {
  return {
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
  };
}

export type InMemoryUserRepository = UserRepository & {
  readonly get: (id: string) => User | undefined;
};

export function createInMemoryUserRepository(seed: readonly User[] = []): InMemoryUserRepository {
  const rows = new Map<string, User>(seed.map((user) => [user.id, user]));

  function patch(id: string, changes: Partial<User>): void {
    const existing = rows.get(id);
    if (existing !== undefined) {
      rows.set(id, { ...existing, ...changes });
    }
  }

  return {
    get: (id) => rows.get(id),

    async findByEmail(email) {
      const needle = email.trim().toLowerCase();
      return [...rows.values()].find((user) => user.email === needle) ?? null;
    },

    async findById(id) {
      return rows.get(id) ?? null;
    },

    async recordLogin(userId, at) {
      patch(userId, { lastLoginAt: at });
    },

    async revokeTokensIssuedBefore(userId, at) {
      patch(userId, { tokensValidFrom: at });
    },
  };
}

export type FakePasswordHasher = PasswordHasher & {
  readonly verifiedHashes: readonly string[];
};

/** Hashing boils down to a prefix — the test checks the logic, not argon2. */
export function createFakePasswordHasher(): FakePasswordHasher {
  const verifiedHashes: string[] = [];

  return {
    decoyHash: 'hashed:__decoy__',
    verifiedHashes,

    async hash(plainPassword) {
      return `hashed:${plainPassword}`;
    },

    async verify(passwordHash, plainPassword) {
      verifiedHashes.push(passwordHash);
      return passwordHash === `hashed:${plainPassword}`;
    },
  };
}

export function createFakeSessionTokens(): SessionTokens {
  const issued = new Map<string, SessionClaims>();
  let counter = 0;

  return {
    async issue(input: IssueTokenInput): Promise<IssuedToken> {
      counter += 1;
      const token = `token-${String(counter)}`;
      const expiresAt = new Date(input.now.getTime() + input.ttlSeconds * 1000);
      issued.set(token, {
        userId: input.userId,
        email: input.email,
        issuedAt: input.now,
        expiresAt,
      });
      return { token, expiresAt };
    },

    async verify(token) {
      return issued.get(token) ?? null;
    },
  };
}

export type MutableClock = Clock & { readonly set: (at: Date) => void };

export function createFixedClock(at: Date = EPOCH): MutableClock {
  let current = at;
  return {
    now: () => current,
    set: (next) => {
      current = next;
    },
  };
}
