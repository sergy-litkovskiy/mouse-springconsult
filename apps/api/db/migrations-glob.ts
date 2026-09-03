import { join } from 'node:path';

/**
 * Where the migration classes are found.
 *
 * TypeORM needs an answer to "what migrations exist" — the `migrations` table in the
 * database answers the other question, "which of them already ran". The answer used to be
 * a hand-kept array; it is a glob now, because the list bought nothing the file names do
 * not already give. Order in particular: TypeORM sorts by the timestamp at the end of the
 * class name, never by the position in an array, so a forgotten registration was the only
 * thing the list could add.
 *
 * The path is absolute rather than relative to the working directory: the migration CLI,
 * the test database and any future caller reach the same files regardless of where the
 * process was started from. `import.meta.url` points at this compiled file inside
 * `dist/db/`, and the migrations sit next to it.
 */
export const migrationsGlob = join(new URL('.', import.meta.url).pathname, 'migrations', '*.js');
