import { createDataSource } from '../src/db.ts';
import { migrations } from './migrations-list.ts';

/**
 * Composition root of the migration process — the third entry point alongside api.ts.
 *
 * The order of migrations lives in `migrations-list.ts`: `db/test-database.ts` needs the
 * same list, and `npm run db:migrate:new` appends to it, so keeping it here would mean
 * two places to edit.
 */

const usage = 'usage: node db/migrate.ts <up|down|show>';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const dataSource = createDataSource({ migrations });
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
        process.stdout.write(
          `${migrations.map((m) => `  ${m.name}`).join('\n')}\n` +
            `pending: ${pending ? 'yes' : 'no'}\n`,
        );
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
