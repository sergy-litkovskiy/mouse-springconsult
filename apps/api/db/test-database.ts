import type { DataSource } from 'typeorm';
import { env } from '../src/config.ts';
import { createDataSource } from '../src/db.ts';
import { ensureDatabase, quoteIdentifier } from './create-database.ts';
import { migrations } from './migrations-list.ts';

/**
 * The throwaway database the integration specs run against. Imported from `*.spec.ts`
 * only — the rule is pinned down in `.dependency-cruiser.cjs`.
 *
 * The name is derived from DATABASE_URL rather than configured separately: whatever
 * database the machine works with, the tests get its `_test` twin, and CI needs no extra
 * variable. Node runs every spec file in its own process, so `prepareTestDatabase` is
 * called from each of them; after the first one the migrations are a no-op.
 *
 * The runner is pinned to one file at a time (`--test-concurrency=1` in package.json):
 * every spec here works against the same database and truncates the same tables, so a
 * second file running in parallel would pull the rows out from under the first.
 */

export function testDatabaseUrl(): string {
  const url = new URL(env.DATABASE_URL);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (databaseName === '') {
    throw new Error('DATABASE_URL must contain a database name');
  }

  url.pathname = `/${encodeURIComponent(`${databaseName}_test`)}`;
  return url.toString();
}

/** Creates the test database if it is missing and brings it up to the latest migration. */
export async function prepareTestDatabase(): Promise<string> {
  const url = testDatabaseUrl();
  await ensureDatabase(url);

  const dataSource = createDataSource({ url, migrations });
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }

  return url;
}

/**
 * Empties the tables between tests, so every one of them starts from a known database.
 * `restart identity cascade` rather than `delete`: it is faster and it clears the rows
 * that migrations seeded — the first administrator among them.
 */
export async function resetTables(
  dataSource: DataSource,
  tables: readonly string[],
): Promise<void> {
  if (tables.length === 0) {
    return;
  }

  const list = tables.map(quoteIdentifier).join(', ');
  await dataSource.query(`truncate table ${list} restart identity cascade`);
}
