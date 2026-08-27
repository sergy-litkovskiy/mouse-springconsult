import { Client } from 'pg';
import { env } from '../src/config.ts';

/**
 * Idempotent creation of the `mouse_trading` database on an existing Postgres server.
 *
 * The same step as `db/init/0001-create-database.sql`, but for the case where Postgres
 * is not coming up from scratch (a managed database, someone else's server): the initdb
 * hook will not fire there, because the volume is already initialised.
 *
 * Postgres has no `CREATE DATABASE ... IF NOT EXISTS`, so existence is checked with a
 * query; the database name cannot be passed as a parameter either — it comes from
 * DATABASE_URL and is escaped as an identifier.
 */
function parseTarget(databaseUrl: string): { maintenanceUrl: string; databaseName: string } {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (databaseName === '') {
    throw new Error('DATABASE_URL must contain a database name');
  }

  const maintenance = new URL(databaseUrl);
  maintenance.pathname = '/postgres';
  return { maintenanceUrl: maintenance.toString(), databaseName };
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

async function main(): Promise<void> {
  const { maintenanceUrl, databaseName } = parseTarget(env.DATABASE_URL);
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();

  try {
    const existing = await client.query('select 1 from pg_database where datname = $1', [
      databaseName,
    ]);

    if (existing.rowCount === 0) {
      await client.query(`create database ${quoteIdentifier(databaseName)}`);
      process.stdout.write(`created database ${databaseName}\n`);
    } else {
      process.stdout.write(`database ${databaseName} already exists\n`);
    }
  } finally {
    await client.end();
  }
}

await main();
