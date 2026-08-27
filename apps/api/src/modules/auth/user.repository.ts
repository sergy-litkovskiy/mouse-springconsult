import type { DataSource } from 'typeorm';
import type { UserRepository } from './auth.port.ts';
import type { User } from './user.ts';
import { UserEntity } from './user.entity.ts';

/**
 * Implementation of the `UserRepository` port on top of TypeORM. The only place in the
 * module where the ORM is mentioned at all: the use-case knows the port and nothing else.
 *
 * Only the composition root (`src/api.ts`) instantiates this file.
 */
export function createUserRepository(dataSource: DataSource): UserRepository {
  const users = dataSource.getRepository(UserEntity);

  return {
    async findByEmail(email: string): Promise<User | null> {
      return users.findOne({ where: { email: email.trim().toLowerCase() } });
    },

    async findById(id: string): Promise<User | null> {
      return users.findOne({ where: { id } });
    },

    async recordLogin(userId: string, at: Date): Promise<void> {
      await users.update({ id: userId }, { lastLoginAt: at });
    },

    async revokeTokensIssuedBefore(userId: string, at: Date): Promise<void> {
      await users.update({ id: userId }, { tokensValidFrom: at });
    },
  };
}
