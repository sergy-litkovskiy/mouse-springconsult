import { EntitySchema } from 'typeorm';
import type { Product } from './product.ts';

/**
 * ORM mapping of the domain `Product`. Infrastructure — the same rung as
 * `*.repository.ts`, and the domain never sees it.
 *
 * `EntitySchema` instead of decorators for the same reason as in auth: Node 26 strips
 * types but does not transform decorators, and `erasableSyntaxOnly` rejects them at the
 * tsc level. The table itself is created by a migration; `synchronize` stays off.
 *
 * The gallery is deliberately absent from the mapping. A one-to-many relation combined
 * with LIMIT makes the page size mean rows rather than products, so the repository reads
 * images with a second query — see `product.repository.ts`.
 */
export const PRODUCTS_TABLE = 'products';

/** A row of `products`: the card without its gallery. */
export type ProductRow = Omit<Product, 'images'>;

/**
 * numeric(12,2) arrives from pg as a string, and the code counts in whole kopiykas.
 * The conversion goes through the decimal digits rather than through a float: multiplying
 * 2499.99 by 100 in binary floating point lands on 249998.99999999997.
 */
export function numericFromKopiykas(cents: number): string {
  return `${String(Math.trunc(cents / 100))}.${String(Math.abs(cents % 100)).padStart(2, '0')}`;
}

export function kopiykasFromNumeric(value: string): number {
  const [whole = '0', fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

const kopiykas = { to: numericFromKopiykas, from: kopiykasFromNumeric };

export const ProductEntity = new EntitySchema<ProductRow>({
  name: 'Product',
  tableName: PRODUCTS_TABLE,
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    titleProm: { name: 'title_prom', type: 'varchar', length: 200 },
    descriptionProm: { name: 'description_prom', type: 'text' },
    titleOlx: { name: 'title_olx', type: 'varchar', length: 200 },
    descriptionOlx: { name: 'description_olx', type: 'text' },
    priceCents: {
      name: 'price',
      type: 'numeric',
      precision: 12,
      scale: 2,
      transformer: kopiykas,
    },
    seoKeywords: { name: 'seo_keywords', type: 'text', array: true, default: () => "'{}'" },
    category: { name: 'category', type: 'varchar', length: 120 },
    published: { name: 'published', type: 'boolean', default: false },
    accountProm: { name: 'account_prom', type: 'varchar', length: 120, nullable: true },
    accountOlx: { name: 'account_olx', type: 'varchar', length: 120, nullable: true },
    condition: { name: 'condition', type: 'varchar', length: 8 },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
  },
});
