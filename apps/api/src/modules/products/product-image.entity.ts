import { EntitySchema } from 'typeorm';
import type { ProductImage } from './product.ts';

/**
 * ORM mapping of a gallery frame. Cloudflare R2 holds the file itself; the database keeps
 * the key and the link, which is what makes a card renderable before the media module exists.
 *
 * `productId` is a plain column rather than a relation: the repository joins nothing and
 * fetches images by a list of identifiers, so nothing here needs an inverse side.
 */
export const PRODUCT_IMAGES_TABLE = 'product_images';

/** A row of `product_images`: the domain frame plus the owner it belongs to. */
export type ProductImageRow = ProductImage & { readonly productId: string };

export const ProductImageEntity = new EntitySchema<ProductImageRow>({
  name: 'ProductImage',
  tableName: PRODUCT_IMAGES_TABLE,
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    productId: { name: 'product_id', type: 'uuid' },
    r2Key: { name: 'r2_key', type: 'text' },
    url: { name: 'url', type: 'text' },
    position: { name: 'position', type: 'int' },
    isMain: { name: 'is_main', type: 'boolean', default: false },
  },
});
