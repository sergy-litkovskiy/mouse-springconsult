import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PRODUCT_IMAGES_TABLE = 'product_images';

/**
 * `productId` is a plain column rather than a relation: the repository joins nothing and fetches
 * images by a list of identifiers, so nothing here needs an inverse side.
 */
@Entity({ name: PRODUCT_IMAGES_TABLE })
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ name: 'r2_key', type: 'text' })
  r2Key!: string;

  @Column({ name: 'url', type: 'text' })
  url!: string;

  @Column({ name: 'position', type: 'int' })
  position!: number;

  @Column({ name: 'is_main', type: 'boolean', default: false })
  isMain!: boolean;
}
