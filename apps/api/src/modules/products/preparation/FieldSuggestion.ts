import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const FIELD_SUGGESTIONS_TABLE = 'product_field_suggestions';

export type SuggestionField =
  'title_prom' | 'title_olx' | 'description_prom' | 'description_olx' | 'seo_keywords' | 'price';

export type SuggestionResolution = 'accepted' | 'rejected';

/** Decimal strings, like `products.price`: the range never passes through a float. */
export type PriceRange = { readonly priceFrom: string; readonly priceTo: string };

/** A string for titles and descriptions, a list for keywords, a range for the price. */
export type SuggestionValue = string | readonly string[] | PriceRange;

/**
 * No `productId`: the card is reached through the run. A copy here would be a second place for
 * the same fact, and nothing would keep the two in agreement.
 */
@Entity({ name: FIELD_SUGGESTIONS_TABLE })
export class FieldSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'field', type: 'varchar', length: 32 })
  field!: SuggestionField;

  @Column({ name: 'value', type: 'jsonb' })
  value!: SuggestionValue;

  /** NULL means not decided yet. */
  @Column({ name: 'resolution', type: 'varchar', length: 16, nullable: true })
  resolution!: SuggestionResolution | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
