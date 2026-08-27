-- Creation of the application database.
--
-- This step is deliberately not a TypeORM migration: `CREATE DATABASE` cannot run inside
-- a transaction (and TypeORM migrations are transactional) and needs a connection to a
-- *different* database — the one being created cannot be connected to yet.
--
-- It runs two ways, from the same file:
--   * the `postgres` container mounts this directory into /docker-entrypoint-initdb.d
--     and runs the script through psql on the first initialisation of the volume;
--   * on an existing server — `npm run db:create` (see db/create-database.ts).
--
-- Tables are created by migration 1787734800000-create-users-table.ts, not by this file.

\set ON_ERROR_STOP on

SELECT 'CREATE DATABASE mouse_trading'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mouse_trading')\gexec
