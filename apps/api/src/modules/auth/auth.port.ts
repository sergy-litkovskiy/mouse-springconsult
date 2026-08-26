import type { User } from './user.ts';

/**
 * Ports of the auth module. No I/O here — implementations live in `*.repository.ts`
 * and `*.adapter.ts`, and the composition root wires them in.
 */

export type UserRepository = {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Records a successful sign-in. */
  recordLogin(userId: string, at: Date): Promise<void>;
  /** Moves `tokensValidFrom`, invalidating every token issued so far. */
  revokeTokensIssuedBefore(userId: string, at: Date): Promise<void>;
};

export type PasswordHasher = {
  hash(plainPassword: string): Promise<string>;
  verify(passwordHash: string, plainPassword: string): Promise<boolean>;
  /**
   * Hash of a password that does not exist. Verifying against it for an unknown email
   * levels the response time, so brute force cannot tell "no such user" from "wrong
   * password". The hash format is the adapter's business, not the use-case's.
   */
  readonly decoyHash: string;
};

export type SessionClaims = {
  readonly userId: string;
  readonly email: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
};

export type IssueTokenInput = {
  readonly userId: string;
  readonly email: string;
  readonly ttlSeconds: number;
  readonly now: Date;
};

export type IssuedToken = {
  readonly token: string;
  readonly expiresAt: Date;
};

export type SessionTokens = {
  issue(input: IssueTokenInput): Promise<IssuedToken>;
  /** Returns null for an expired, forged or foreign token. */
  verify(token: string): Promise<SessionClaims | null>;
};

/** Time is a dependency too: in tests it stands still. */
export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
};
