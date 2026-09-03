import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Generator of an empty migration: `npm run db:migrate:new -- add-product-seo`.
 *
 * The class name ends with a timestamp — that is what TypeORM orders migrations by — so
 * in the file name it comes first, to keep the order visible in `ls` as well.
 *
 * Writing the file is all there is to it: `db/migrations-glob.ts` picks the directory up
 * whole, so a new migration takes effect the moment it compiles.
 *
 * The generator itself runs compiled, out of `dist/db/`, while what it writes are
 * sources: the target directory comes from the working directory — npm sets it to the
 * package root — rather than from `import.meta.url`.
 */
const here = join(process.cwd(), 'db');

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
  const fileName = `${String(timestamp)}-${kebab}.ts`;
  const filePath = join(here, 'migrations', fileName);

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

  process.stdout.write(`created ${filePath}\n`);
}

await main();
