import { createDataSource } from '../src/db.ts';
import { migrationsGlob } from './migrations-glob.ts';

/**
 * Composition root of the migration process — the third entry point alongside api.ts.
 *
 * Migrations are found by a glob rather than listed by hand. Order does not depend on
 * that glob: TypeORM sorts by the timestamp at the end of the class name, so the sequence
 * is the same whichever way the files are discovered — and a hand-kept list only added a
 * registration step that could be forgotten.
 */

const usage = 'usage: node db/migrate.ts <up|down|show>';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const dataSource = createDataSource({ migrations: [migrationsGlob] });
  await dataSource.initialize();

  try {
    switch (command) {
      case 'up': {
        const applied = await dataSource.runMigrations({ transaction: 'each' });
        process.stdout.write(
          applied.length === 0
            ? 'no pending migrations\n'
            : `applied:\n${applied.map((m) => `  ${m.name}`).join('\n')}\n`,
        );
        break;
      }
      case 'down': {
        await dataSource.undoLastMigration({ transaction: 'each' });
        process.stdout.write('reverted last migration\n');
        break;
      }
      case 'show': {
        const pending = await dataSource.showMigrations();
        // `name` is optional on the interface; every migration here sets it, and the
        // class name is the same string anyway.
        const known = dataSource.migrations
          .map((m) => `  ${m.name ?? m.constructor.name}`)
          .join('\n');
        process.stdout.write(`${known}\npending: ${pending ? 'yes' : 'no'}\n`);
        break;
      }
      default: {
        process.stderr.write(`unknown command "${command}"\n${usage}\n`);
        process.exitCode = 1;
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

await main();
