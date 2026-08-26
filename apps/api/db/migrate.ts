import { createDataSource } from '../src/db.ts';
import { CreateUsersTable1787734800000 } from './migrations/1787734800000-create-users-table.ts';
import { CreateFirstUser1787738400000 } from './migrations/1787738400000-create-first-user.ts';
import { CreateProductsTables1787756956906 } from './migrations/1787756956906-create-products-tables.ts';

/**
 * Composition root of the migration process — the third entry point alongside api.ts.
 *
 * Migrations are listed explicitly rather than discovered by a glob: the order shows up
 * in the diff, and the runtime does not depend on whether the ORM loader can read `.ts`
 * without a build. A new migration is added here by hand — `npm run db:migrate:new` says so.
 */
const migrations = [
  CreateUsersTable1787734800000,
  CreateFirstUser1787738400000,
  CreateProductsTables1787756956906,
];

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
