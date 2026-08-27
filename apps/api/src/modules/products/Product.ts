import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ProductCondition } from '../../contracts/products-limits.ts';
import { ProductImage } from './ProductImage.ts';

/**
 * A product card: the model of the domain and the ORM mapping in one class. The table
 * itself is created by a migration; `synchronize` stays off forever.
 *
 * Prom and OLX get separate title and description fields rather than one shared text:
 * the marketplaces differ in length limits and in tone, and a card is prepared for both
 * at once. `condition` is what the marketplaces call the state of the item — `published`
 * answers a different question and the two never collapse into one flag.
 *
 * Every column states its type explicitly instead of leaning on the metadata tsc emits:
 * `verbatimModuleSyntax` erases a type-only import, so a type inferred from a signature
 * would depend on how the file happens to import it.
 *
 * The price column carries no `transformer`. `decimal(12,2)` reaches the driver as a
 * string and stays one all the way to the browser: a converter on the column would be a
 * second place where money is rounded, and the first one is the database itself.
 */
export const PRODUCTS_TABLE = 'products';

@Entity({ name: PRODUCTS_TABLE })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'title_prom', type: 'varchar', length: 200 })
  titleProm!: string;

  @Column({ name: 'description_prom', type: 'text' })
  descriptionProm!: string;

  @Column({ name: 'title_olx', type: 'varchar', length: 200 })
  titleOlx!: string;

  @Column({ name: 'description_olx', type: 'text' })
  descriptionOlx!: string;

  /**
   * The price as `decimal(12,2)` stores and returns it: a decimal string, "2499.00".
   * Nothing converts it on either side of the boundary — a number here would mean
   * either a float, which loses kopiykas, or a unit the database does not share.
   */
  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ name: 'seo_keywords', type: 'text', array: true, default: () => "'{}'" })
  seoKeywords!: string[];

  @Column({ name: 'category', type: 'varchar', length: 120 })
  category!: string;

  @Column({ name: 'published', type: 'boolean', default: false })
  published!: boolean;

  @Column({ name: 'account_prom', type: 'varchar', length: 120, nullable: true })
  accountProm!: string | null;

  @Column({ name: 'account_olx', type: 'varchar', length: 120, nullable: true })
  accountOlx!: string | null;

  @Column({ name: 'condition', type: 'varchar', length: 8 })
  condition!: ProductCondition;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * The gallery, filled in by `ProductRepository` with a second query and deliberately
   * left out of the mapping: a one-to-many relation combined with LIMIT makes the page
   * size mean rows rather than products.
   */
  images!: ProductImage[];
}

/** One page of the catalogue: the rows plus how many there are in total behind them. */
export type ProductPage = {
  readonly items: readonly Product[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};
