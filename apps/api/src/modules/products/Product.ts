import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ProductCondition } from '../../contracts/products-limits.ts';
import { ProductImage } from './ProductImage.ts';

export const PRODUCTS_TABLE = 'products';

/**
 * Every column states its type explicitly instead of leaning on the metadata tsc emits:
 * `verbatimModuleSyntax` erases a type-only import, so a type inferred from a signature would
 * depend on how the file happens to import it.
 */
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
   * A decimal string, "2499.00", with no `transformer` on the column: a converter would be a
   * second place where money is rounded, and the first one is the database itself.
   */
  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ name: 'seo_keywords', type: 'text', array: true, default: () => "'{}'" })
  seoKeywords!: string[];

  @Column({ name: 'category', type: 'varchar', length: 120 })
  category!: string;

  @Column({ name: 'published_prom', type: 'boolean', default: false })
  publishedProm!: boolean;

  @Column({ name: 'published_olx', type: 'boolean', default: false })
  publishedOlx!: boolean;

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

export type ProductPage = {
  readonly items: readonly Product[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};
