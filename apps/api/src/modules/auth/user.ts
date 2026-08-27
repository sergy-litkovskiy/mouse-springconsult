import type { AuthUser } from '../../contracts/auth.contract.ts';

/**
 * Domain model of a user. No I/O: no pg, no typeorm, no fastify.
 * The ORM mapping sits next door in `user.entity.ts` and stays invisible to the domain.
 */
export type User = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  /**
   * The moment from which session tokens count as valid. Logout moves it to "now", and
   * every token issued earlier stops being accepted at once — revocation without a
   * separate table and without checking each request against a revocation list.
   */
  readonly tokensValidFrom: Date;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** What is safe to expose: no password hash, no internal fields. */
export function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
