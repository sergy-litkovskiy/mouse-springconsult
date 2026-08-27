import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generator of an empty migration: `npm run db:migrate:new -- add-product-seo`.
 *
 * The class name ends with a timestamp — that is what TypeORM orders migrations by — so
 * in the file name it comes first, to keep the order visible in `ls` as well.
 */
const here = dirname(fileURLToPath(import.meta.url));

function toPascalCase(kebab: string): string {
  return kebab
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

async function main(): Promise<void> {
  const rawName = process.argv[2];
  if (rawName === undefined || rawName.trim() === '') {
    process.stderr.write('usage: npm run db:migrate:new -- <kebab-case-name>\n');
    process.exitCode = 1;
    return;
  }

  const kebab = rawName
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
  const timestamp = Date.now();
  const className = `${toPascalCase(kebab)}${String(timestamp)}`;
  const filePath = join(here, 'migrations', `${String(timestamp)}-${kebab}.ts`);

  const template = `import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
  name = '${className}';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`\`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`\`);
  }
}
`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, template, { flag: 'wx' });

  process.stdout.write(
    `created ${filePath}\n` +
      `register it in db/migrate.ts — the list there is the source of order\n`,
  );
}

await main();
