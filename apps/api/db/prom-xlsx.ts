import ExcelJS from 'exceljs';
import sanitizeHtml from 'sanitize-html';
import { productConstraints, type ProductCondition } from '../src/contracts/products-limits.ts';
import { cleanDescription, type ProductDraft } from '../src/modules/products/index.ts';

/**
 * Mapping of a Prom product export (the xlsx from the Prom cabinet, hand-edited before import) onto
 * cards. No file or network I/O here: `import-prom.ts` reads the file from disk, fetches the frames
 * and writes the cards; `parsePromExport` only decodes the bytes it is handed.
 */

export type PromCardDraft = ProductDraft & { readonly promId: string };

export type PromCard = {
  readonly draft: PromCardDraft;
  /** In the order Prom shows them; the first one becomes the main frame. */
  readonly imageUrls: readonly string[];
};

export type PromRowError = {
  /** 1-based, counting the header, so it matches the line a spreadsheet shows. */
  readonly row: number;
  readonly promId: string;
  readonly reason: string;
};

export type PromExport = {
  readonly cards: readonly PromCard[];
  /** Rows marked `-` in `Наявність`: out of stock on Prom, and not carried over. */
  readonly outOfStock: number;
  readonly errors: readonly PromRowError[];
};

/**
 * Columns are looked up by header rather than by a fixed index, so a reordered export still maps.
 * The characteristics repeat the same three headers twenty-odd times, which is why rows are read
 * as arrays and not as objects keyed by header.
 */
export type PromColumns = {
  readonly promId: number;
  readonly title: number;
  readonly description: number;
  readonly price: number;
  readonly keywords: number;
  readonly category: number;
  readonly images: number;
  readonly availability: number;
  /** Index of every `Назва_Характеристики`; its value sits two columns to the right. */
  readonly characteristicNames: readonly number[];
};

const OUT_OF_STOCK = '-';
const CONDITION_CHARACTERISTIC = 'Стан';
const NEW_CONDITIONS: ReadonlySet<string> = new Set(['Новий', 'Новое', 'Негашене']);
const PRODUCTS_SHEET_NAME = 'Export Products Sheet';

/**
 * A machine-written CSV only ever held strings; a hand-edited workbook can hold whatever type Excel
 * guessed for a column — `Унікальний_ідентифікатор` comes back as a number, and a pasted link can
 * turn into a hyperlink cell. `characteristic()` and `toPromCard()` still work on plain strings, so
 * every cell is flattened to text right after reading.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if ('richText' in value) {
    return value.richText.map((run) => run.text).join('');
  }
  if ('text' in value) {
    return cellText(value.text);
  }
  if ('result' in value) {
    return cellText(value.result ?? '');
  }
  throw new Error(`unsupported cell value: ${JSON.stringify(value)}`);
}

export function resolveColumns(header: readonly string[]): PromColumns {
  const find = (name: string): number => {
    const index = header.indexOf(name);
    if (index === -1) {
      throw new Error(`the export has no "${name}" column`);
    }
    return index;
  };

  return {
    promId: find('Унікальний_ідентифікатор'),
    title: find('Назва_позиції_укр'),
    description: find('Опис_укр'),
    price: find('Ціна'),
    keywords: find('Пошукові_запити_укр'),
    category: find('Назва_групи'),
    images: find('Посилання_зображення'),
    availability: find('Наявність'),
    characteristicNames: header.flatMap((name, index) =>
      name === 'Назва_Характеристики' ? [index] : [],
    ),
  };
}

/**
 * sanitize-html escapes the text it writes out; plain text has no markup to protect, so the
 * entities go back to characters. `&amp;` is last, or `&amp;lt;` would turn into `<`.
 */
const TEXT_ENTITIES: readonly (readonly [string, string])[] = [
  ['&nbsp;', ' '],
  ['\u00a0', ' '],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&amp;', '&'],
];

/**
 * OLX takes no markup at all, so its description is the cleaned one with the structure turned
 * into line breaks: a paragraph ends with a blank line, a list item becomes a bulleted line.
 * A link keeps its text and loses the address — OLX does not allow links in an ad anyway.
 */
export function toPlainText(cleanHtml: string): string {
  const withBreaks = cleanHtml
    .replaceAll(/<br(?: \/)?>\s*/g, '\n')
    .replaceAll('<li>', '• ')
    .replaceAll(/<\/li>\s*/g, '\n')
    .replaceAll(/<\/(?:p|ul|ol|h2|h3|h4)>/g, '\n\n');
  const text = TEXT_ENTITIES.reduce(
    (result, [entity, character]) => result.replaceAll(entity, character),
    sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} }),
  );

  return text
    .replaceAll(/[ \t]+\n/g, '\n')
    .replaceAll(/\n[ \t]+/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

export function toCondition(value: string | undefined): ProductCondition {
  return value !== undefined && NEW_CONDITIONS.has(value.trim()) ? 'new' : 'used';
}

export function splitKeywords(value: string): string[] {
  const keywords = value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== '');
  return [...new Set(keywords)];
}

export function splitImageUrls(value: string): string[] {
  return value
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url !== '');
}

function characteristic(
  row: readonly string[],
  columns: PromColumns,
  name: string,
): string | undefined {
  const index = columns.characteristicNames.find((column) => row[column]?.trim() === name);
  return index === undefined ? undefined : row[index + 2];
}

/**
 * `null` for a row that is not carried over. A row that cannot become a card throws, with the
 * reason in the message — the caller reports it and moves on.
 */
export function toPromCard(row: readonly string[], columns: PromColumns): PromCard | null {
  const cell = (index: number): string => (row[index] ?? '').trim();

  if (cell(columns.availability) === OUT_OF_STOCK) {
    return null;
  }

  const promId = cell(columns.promId);
  if (promId === '') {
    throw new Error('no Унікальний_ідентифікатор');
  }

  // The column rounds it to two decimals itself; the cell's text goes in as read.
  const price = cell(columns.price);
  if (!productConstraints.pricePattern.test(price)) {
    throw new Error(`price "${price}" is not a decimal`);
  }

  const title = cell(columns.title);
  const description = cleanDescription(row[columns.description] ?? '');

  return {
    draft: {
      promId,
      titleProm: title,
      titleOlx: title,
      descriptionProm: description,
      descriptionOlx: toPlainText(description),
      price,
      seoKeywords: splitKeywords(cell(columns.keywords)),
      category: cell(columns.category),
      condition: toCondition(characteristic(row, columns, CONDITION_CHARACTERISTIC)),
      publishedProm: true,
      publishedOlx: false,
      olxId: null,
    },
    imageUrls: splitImageUrls(cell(columns.images)),
  };
}

/**
 * exceljs's bundled types declare their own module-local `Buffer extends ArrayBuffer`, which this
 * project's `lib: es2024` no longer treats as compatible with Node's real `Buffer` — a gap in the
 * library's types, not a runtime one. This is the one cast that bridges it.
 */
type XlsxBytes = Parameters<ExcelJS.Xlsx['load']>[0];

export async function parsePromExport(xlsx: Buffer): Promise<PromExport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx as unknown as XlsxBytes);
  const sheet = workbook.getWorksheet(PRODUCTS_SHEET_NAME);
  if (sheet === undefined) {
    throw new Error(`the workbook has no "${PRODUCTS_SHEET_NAME}" sheet`);
  }

  const columnCount = sheet.columnCount;
  const toRow = (row: ExcelJS.Row): string[] =>
    Array.from({ length: columnCount }, (_, index) => cellText(row.getCell(index + 1).value));

  const [headerRow, ...dataRows] = sheet.getRows(1, sheet.rowCount) ?? [];
  if (headerRow === undefined) {
    throw new Error('the export is empty');
  }
  const columns = resolveColumns(toRow(headerRow));

  // A cell a spreadsheet tool cannot resolve (e.g. a formula error) fails `cellText` too, so the
  // conversion to strings happens inside the loop: one bad cell costs its row, not the whole file.
  const cards: PromCard[] = [];
  const errors: PromRowError[] = [];
  let outOfStock = 0;

  for (const [index, sheetRow] of dataRows.entries()) {
    try {
      const card = toPromCard(toRow(sheetRow), columns);
      if (card === null) {
        outOfStock += 1;
      } else {
        cards.push(card);
      }
    } catch (error) {
      let promId = '';
      try {
        promId = cellText(sheetRow.getCell(columns.promId + 1).value);
      } catch {
        // The id cell itself is unreadable; the row error below still gets reported.
      }
      errors.push({
        row: index + 2,
        promId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { cards, outOfStock, errors };
}
