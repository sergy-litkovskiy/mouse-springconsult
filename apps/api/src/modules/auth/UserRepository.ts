import type { DataSource } from 'typeorm';
import { User } from './User.ts';

/**
 * Persistence of the administrators — the only place in the module where TypeORM is
 * mentioned. Instantiated by the composition root alone (`src/api.ts`).
 *
 * `getRepository` is called inside each method rather than kept in a field: a stub
 * subclass in a spec overrides every method, so it must be constructible without a live
 * DataSource.
 */
export class UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.dataSource
      .getRepository(User)
      .findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOne({ where: { id } });
  }

  /** Records a successful sign-in. */
  async recordLogin(userId: string, at: Date): Promise<void> {
    await this.dataSource.getRepository(User).update({ id: userId }, { lastLoginAt: at });
  }

  /** Moves `tokensValidFrom`, invalidating every token issued so far. */
  async revokeTokensIssuedBefore(userId: string, at: Date): Promise<void> {
    await this.dataSource.getRepository(User).update({ id: userId }, { tokensValidFrom: at });
  }
}
