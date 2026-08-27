import { Client } from 'pg';
import { env } from '../src/config.ts';

/**
 * Idempotent creation of a database on an existing Postgres server.
 *
 * The same step as `db/init/0001-create-database.sql`, but for the case where Postgres
 * is not coming up from scratch (a managed database, someone else's server): the initdb
 * hook will not fire there, because the volume is already initialised.
 *
 * Postgres has no `CREATE DATABASE ... IF NOT EXISTS`, so existence is checked with a
 * query; the database name cannot be passed as a parameter either — it comes from
 * DATABASE_URL and is escaped as an identifier.
 *
 * The work is exported as a function rather than run on import: `db/test-database.ts`
 * calls it for the throwaway `_test` twin, and `import.meta.main` keeps the CLI.
 */

/** `CREATE DATABASE` needs a connection to another database; `postgres` always exists. */
export function toMaintenanceUrl(databaseUrl: string): string {
  const maintenance = new URL(databaseUrl);
  maintenance.pathname = '/postgres';
  return maintenance.toString();
}

export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function parseTarget(databaseUrl: string): { maintenanceUrl: string; databaseName: string } {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (databaseName === '') {
    throw new Error('DATABASE_URL must contain a database name');
  }

  return { maintenanceUrl: toMaintenanceUrl(databaseUrl), databaseName };
}

export type EnsureDatabaseResult = {
  readonly databaseName: string;
  /** False when the database was already there — the call is idempotent either way. */
  readonly created: boolean;
};

export async function ensureDatabase(databaseUrl: string): Promise<EnsureDatabaseResult> {
  const { maintenanceUrl, databaseName } = parseTarget(databaseUrl);
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();

  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [
      databaseName,
    ]);

    if (existing.rowCount === 0) {
      await client.query(`create database ${quoteIdentifier(databaseName)}`);
      return { databaseName, created: true };
    }

    return { databaseName, created: false };
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  const { databaseName, created } = await ensureDatabase(env.DATABASE_URL);
  process.stdout.write(
    created ? `created database ${databaseName}\n` : `database ${databaseName} already exists\n`,
  );
}
