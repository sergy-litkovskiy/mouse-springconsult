import { CreateUsersTable1787734800000 } from './migrations/1787734800000-create-users-table.ts';
import { CreateFirstUser1787738400000 } from './migrations/1787738400000-create-first-user.ts';
import { CreateProductsTables1787756956906 } from './migrations/1787756956906-create-products-tables.ts';

/**
 * The ordered list of migrations — the single source of that order. Three readers depend
 * on it: `db/migrate.ts` (the CLI), `db/test-database.ts` (the throwaway test database)
 * and `db/new-migration.ts`, which appends to this file.
 *
 * The list is explicit rather than a glob: the order shows up in the diff, and the
 * runtime does not depend on whether the ORM loader can read `.ts` without a build. The
 * shape below is deliberately rigid — an import block, then one class name per line —
 * because the generator edits it mechanically.
 */
export const migrations = [
  CreateUsersTable1787734800000,
  CreateFirstUser1787738400000,
  CreateProductsTables1787756956906,
];
