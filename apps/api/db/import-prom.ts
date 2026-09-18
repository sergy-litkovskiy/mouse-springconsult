import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { config, env } from '../src/config.ts';
import { createDataSource } from '../src/db.ts';
import { ImageStorage, MediaService } from '../src/modules/media/index.ts';
import { ProductRepository, ProductService } from '../src/modules/products/index.ts';
import { parsePromExport, type PromCard, type PromExport } from './prom-csv.ts';

/**
 * `npm run db:import:prom -- <csv-path> [--dry-run] [--limit N]`.
 *
 * Carries a Prom export over into cards, frames included. A run can be repeated at any point: a
 * card is found again by its `prom_id`, and its gallery is topped up from the frame it stopped at.
 * That is also why a frame that cannot be stored ends its card's gallery instead of being skipped:
 * a gap would shift every later frame by one on the next run, and one of them would land twice.
 */

const PRODUCT_CONCURRENCY = 4;
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 20_000;

type Outcome = {
  readonly created: boolean;
  readonly imagesStored: number;
  readonly error?: string;
};

class PermanentFetchError extends Error {}

async function fetchImage(url: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.status >= 400 && response.status < 500) {
        throw new PermanentFetchError(`answered ${String(response.status)}`);
      }
      if (!response.ok) {
        throw new Error(`answered ${String(response.status)}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof PermanentFetchError) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

async function importCard(service: ProductService, card: PromCard): Promise<Outcome> {
  const existing = await service.findByPromId(card.draft.promId);
  const product = existing ?? (await service.importFromProm(card.draft));

  let imagesStored = 0;
  for (const url of card.imageUrls.slice(product.images.length)) {
    try {
      await service.addImage(product.id, await fetchImage(url));
      imagesStored += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { created: existing === null, imagesStored, error: `${url}: ${reason}` };
    }
  }
  return { created: existing === null, imagesStored };
}

function printDryRun(parsed: PromExport): void {
  const drafts = parsed.cards.map((card) => card.draft);
  const max = (values: readonly number[]): number => values.reduce((a, b) => Math.max(a, b), 0);

  process.stdout.write(
    [
      `cards: ${String(parsed.cards.length)}`,
      `out of stock (skipped): ${String(parsed.outOfStock)}`,
      `mapping errors: ${String(parsed.errors.length)}`,
      `max title length: ${String(max(drafts.map((d) => d.titleProm?.length ?? 0)))}`,
      `max description length: ${String(max(drafts.map((d) => d.descriptionProm?.length ?? 0)))}`,
      `max OLX description length: ${String(max(drafts.map((d) => d.descriptionOlx?.length ?? 0)))}`,
      `max category length: ${String(max(drafts.map((d) => d.category?.length ?? 0)))}`,
      `max keywords: ${String(max(drafts.map((d) => d.seoKeywords?.length ?? 0)))}`,
      `max keyword length: ${String(max(drafts.flatMap((d) => (d.seoKeywords ?? []).map((k) => k.length))))}`,
      `max images: ${String(max(parsed.cards.map((card) => card.imageUrls.length)))}`,
      `total images: ${String(parsed.cards.reduce((sum, card) => sum + card.imageUrls.length, 0))}`,
      `empty titles: ${String(drafts.filter((d) => d.titleProm === '').length)}`,
      `empty descriptions: ${String(drafts.filter((d) => d.descriptionProm === '').length)}`,
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'dry-run': { type: 'boolean', default: false }, limit: { type: 'string' } },
  });
  const [csvPath] = positionals;
  if (csvPath === undefined) {
    process.stderr.write('usage: npm run db:import:prom -- <csv-path> [--dry-run] [--limit N]\n');
    process.exitCode = 1;
    return;
  }

  const parsed = parsePromExport(await readFile(csvPath, 'utf8'));
  for (const { row, promId, reason } of parsed.errors) {
    process.stderr.write(`row ${String(row)} (${promId}): ${reason}\n`);
  }

  if (values['dry-run']) {
    printDryRun(parsed);
    return;
  }

  const limit = values.limit === undefined ? parsed.cards.length : Number(values.limit);
  const queue = parsed.cards.slice(0, limit);

  const dataSource = createDataSource();
  await dataSource.initialize();
  const service = new ProductService(
    new ProductRepository(dataSource),
    new MediaService(
      new ImageStorage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
        ...config.storage,
      }),
    ),
  );

  let created = 0;
  let resumed = 0;
  let imagesStored = 0;
  const failures: string[] = [];
  let done = 0;

  const next = (): PromCard | undefined => queue.shift();
  async function worker(): Promise<void> {
    for (let card = next(); card !== undefined; card = next()) {
      try {
        const outcome = await importCard(service, card);
        if (outcome.created) {
          created += 1;
        } else {
          resumed += 1;
        }
        imagesStored += outcome.imagesStored;
        if (outcome.error !== undefined) {
          failures.push(`${card.draft.promId}: ${outcome.error}`);
        }
      } catch (error) {
        failures.push(
          `${card.draft.promId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      done += 1;
      if (done % 20 === 0) {
        process.stdout.write(`${String(done)} cards processed\n`);
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: PRODUCT_CONCURRENCY }, worker));
  } finally {
    await dataSource.destroy();
  }

  process.stdout.write(
    [
      `created: ${String(created)}`,
      `already there: ${String(resumed)}`,
      `images stored: ${String(imagesStored)}`,
      `failures: ${String(failures.length)}`,
      ...failures.map((failure) => `  ${failure}`),
      '',
    ].join('\n'),
  );
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
