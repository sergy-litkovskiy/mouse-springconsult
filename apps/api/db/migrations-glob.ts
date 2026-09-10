import { join } from 'node:path';

/**
 * A glob rather than a hand-kept array: TypeORM orders migrations by the timestamp at the end of
 * the class name, never by their position in a list, so a forgotten registration was the only
 * thing such a list could add.
 *
 * The path is absolute rather than relative to the working directory, so the migration CLI, the
 * test database and any future caller reach the same files wherever the process was started from.
 * `import.meta.url` points at this compiled file inside `dist/db/`, and the migrations sit next
 * to it.
 */
export const migrationsGlob = join(new URL('.', import.meta.url).pathname, 'migrations', '*.js');
