import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Generator of an empty migration: `npm run db:migrate:new -- add-product-seo`.
 *
 * The class name ends with a timestamp — that is what TypeORM orders migrations by — so
 * in the file name it comes first, to keep the order visible in `ls` as well.
 *
 * The new class is registered in `migrations-list.ts` right away. A glob over the
 * directory would spare the edit, but an explicit list puts the order into the diff, and
 * appending to a file of a fixed shape gives the same ergonomics deterministically.
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

/** Appends the import and the list entry, both last: the list is ordered by timestamp. */
async function register(className: string, fileName: string): Promise<void> {
  const listPath = join(here, 'migrations-list.ts');
  const source = await readFile(listPath, 'utf8');

  const imports = [...source.matchAll(/^import .*\n/gm)];
  const lastImport = imports.at(-1);
  const listEnd = source.lastIndexOf('\n];');
  if (lastImport?.index === undefined || listEnd === -1) {
    throw new Error(
      `db/migrations-list.ts no longer has the shape this generator edits: ` +
        `an import block followed by an array literal. Register ${className} by hand.`,
    );
  }

  const importEnd = lastImport.index + lastImport[0].length;
  const withImport =
    source.slice(0, importEnd) +
    `import { ${className} } from './migrations/${fileName}';\n` +
    source.slice(importEnd);

  const entryAt = withImport.lastIndexOf('\n];');
  await writeFile(
    listPath,
    `${withImport.slice(0, entryAt)}\n  ${className},${withImport.slice(entryAt)}`,
  );
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
  await register(className, fileName);

  process.stdout.write(`created ${filePath}\nregistered ${className} in db/migrations-list.ts\n`);
}

await main();
