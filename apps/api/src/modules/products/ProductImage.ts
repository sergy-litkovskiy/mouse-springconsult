import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A gallery frame. Cloudflare R2 holds the file itself; the database keeps the key and
 * the link, which is what makes a card renderable before the media module exists.
 *
 * `productId` is a plain column rather than a relation: the repository joins nothing and
 * fetches images by a list of identifiers, so nothing here needs an inverse side.
 */
export const PRODUCT_IMAGES_TABLE = 'product_images';

@Entity({ name: PRODUCT_IMAGES_TABLE })
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  /** Object key in R2; the bucket itself arrives with the media module. */
  @Column({ name: 'r2_key', type: 'text' })
  r2Key!: string;

  @Column({ name: 'url', type: 'text' })
  url!: string;

  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'is_main', type: 'boolean', default: false })
  isMain!: boolean;
}
