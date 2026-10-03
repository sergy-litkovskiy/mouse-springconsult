import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const FIELD_SUGGESTIONS_TABLE = 'product_field_suggestions';

export type SuggestionField =
  'title_prom' | 'title_olx' | 'description_prom' | 'description_olx' | 'seo_keywords' | 'price';

/** Decimal strings, like `products.price`: the range never passes through a float. */
export type PriceRange = { readonly priceFrom: string; readonly priceTo: string };

/** A string for titles and descriptions, a list for keywords, a range for the price. */
export type SuggestionValue = string | readonly string[] | PriceRange;

/**
 * One row per card and field (ADR 0017): the next generation replaces the value and the run. Hence
 * `productId` on the row itself — the run changes with every generation, the card does not.
 */
@Entity({ name: FIELD_SUGGESTIONS_TABLE })
export class FieldSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'field', type: 'varchar', length: 32 })
  field!: SuggestionField;

  @Column({ name: 'value', type: 'jsonb' })
  value!: SuggestionValue;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
