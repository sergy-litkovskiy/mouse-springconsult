import { EntitySchema } from 'typeorm';
import type { User } from './user.ts';

/**
 * ORM mapping of the domain `User`. Infrastructure — it sits on the same rung as
 * `*.repository.ts` and `*.adapter.ts`, and the domain never sees it.
 *
 * `EntitySchema` instead of decorators is a deliberate choice: Node 26 strips types but
 * does not transform decorators, and `erasableSyntaxOnly` rejects them at the tsc level.
 * A schema is an ordinary object, so the backend keeps running without a build step.
 *
 * The table itself is created by a migration; `synchronize` stays off forever.
 */
export const USERS_TABLE = 'users';

export const UserEntity = new EntitySchema<User>({
  name: 'User',
  tableName: USERS_TABLE,
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: 'varchar', length: 320, unique: true },
    displayName: { name: 'display_name', type: 'varchar', length: 120 },
    passwordHash: { name: 'password_hash', type: 'text' },
    isActive: { name: 'is_active', type: 'boolean', default: true },
    tokensValidFrom: { name: 'tokens_valid_from', type: 'timestamptz' },
    lastLoginAt: { name: 'last_login_at', type: 'timestamptz', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});
