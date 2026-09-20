import { randomUUID } from 'node:crypto';
import type {
  ProductCreate,
  ProductListQuery,
  ProductUpdate,
} from '../../contracts/products.contract.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import type { MediaService } from '../media/index.ts';
import { cleanDescription } from './cleanDescription.ts';
import type { PreparationRepository, TokenTotals } from './PreparationRepository.ts';
import type { Product, ProductPage } from './Product.ts';
import { GalleryFull, ImageNotFound, ProductNotFound } from './ProductErrors.ts';
import type { ProductImage } from './ProductImage.ts';
import type {
  ProductChanges,
  ProductDraft,
  ProductListCriteria,
  ProductRepository,
} from './ProductRepository.ts';

/** Readiness is derived on read and never stored (ADR 0009). */
export type ProductReading = {
  readonly product: Product;
  readonly isReady: boolean;
};

/** The cost of a card is summed over its runs on read and never stored as a number (ADR 0006). */
export type ProductCardReading = ProductReading & {
  readonly tokens: TokenTotals;
};

/** Keywords past the ceiling are reported here rather than raised as an error (AC-07). */
export type ProductSaving = ProductReading & {
  readonly discardedKeywordsCount: number;
};

function capKeywords(keywords: string[]): {
  seoKeywords: string[];
  discardedKeywordsCount: number;
} {
  const seoKeywords = keywords.slice(0, productConstraints.maxKeywords);
  return { seoKeywords, discardedKeywordsCount: keywords.length - seoKeywords.length };
}

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly media: MediaService,
    private readonly preparations: PreparationRepository,
  ) {}

  /**
   * A filter that was not sent does not become a condition: zod leaves an absent `.optional()`
   * field out of the object entirely, so what is left once the four pagination keys are taken
   * out is exactly the set of filters that arrived.
   */
  async list(query: ProductListQuery): Promise<ProductPage> {
    const { page, pageSize, sort, direction, ...filters } = query;
    const criteria: ProductListCriteria = { page, pageSize, sort, direction, filters };

    return this.products.list(criteria);
  }

  async getById(id: string): Promise<ProductCardReading> {
    const product = await this.products.findById(id);
    if (product === null) {
      throw new ProductNotFound(id);
    }

    return {
      product,
      isReady: this.isReady(product),
      tokens: await this.preparations.sumTokens(id),
    };
  }

  async create(input: ProductCreate): Promise<ProductSaving> {
    const { seoKeywords, discardedKeywordsCount } = capKeywords(input.seoKeywords);
    const product = await this.products.create({
      ...input,
      descriptionProm: cleanDescription(input.descriptionProm),
      seoKeywords,
    });

    return { product, isReady: this.isReady(product), discardedKeywordsCount };
  }

  /**
   * A card carried over from a Prom export. It skips the HTTP contract on purpose: the export is
   * trusted input that `db/import-prom.ts` maps itself, and its frames follow through `addImage`.
   */
  async importFromProm(card: ProductDraft & { readonly promId: string }): Promise<Product> {
    return this.products.create(card);
  }

  async findByPromId(promId: string): Promise<Product | null> {
    return this.products.findByPromId(promId);
  }

  async update(id: string, changes: ProductUpdate): Promise<ProductSaving> {
    const { seoKeywords, discardedKeywordsCount } = capKeywords(changes.seoKeywords ?? []);
    const cleaned =
      changes.descriptionProm === undefined
        ? changes
        : { ...changes, descriptionProm: cleanDescription(changes.descriptionProm) };
    // zod leaves an absent `.optional()` field out of the object rather than setting it to
    // `undefined`, so no key here holds `undefined` — its inferred type just cannot say so
    // under `exactOptionalPropertyTypes`.
    const product = await this.products.update(
      id,
      (cleaned.seoKeywords === undefined ? cleaned : { ...cleaned, seoKeywords }) as ProductChanges,
    );
    if (product === null) {
      throw new ProductNotFound(id);
    }

    return { product, isReady: this.isReady(product), discardedKeywordsCount };
  }

  /**
   * The object goes to storage before the row is written: a failed upload leaves no frame without
   * a file. The reverse — a file without a frame — is cleaned up here when the row cannot be written.
   */
  async addImage(productId: string, bytes: Uint8Array): Promise<ProductImage> {
    // Looked up before storage is touched: a card that does not exist would otherwise leave an
    // object behind in R2 and fail on the foreign key only after that.
    const product = await this.products.findById(productId);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    // Spares the upload for a gallery that is plainly full; the repository decides for real.
    if (product.images.length >= productConstraints.maxImagesPerProduct) {
      throw new GalleryFull();
    }

    const key = await this.media.store(bytes, `products/${productId}/${randomUUID()}`);
    let image: ProductImage | null;
    try {
      image = await this.products.addImage(productId, key, productConstraints.maxImagesPerProduct);
    } catch (error) {
      await this.discardObject(key);
      throw error;
    }
    if (image === null) {
      await this.discardObject(key);
      throw new GalleryFull();
    }
    return image;
  }

  /**
   * Best effort: the failure that led here is the one the caller has to hear about, and an object
   * nobody references costs storage, not correctness.
   */
  private async discardObject(key: string): Promise<void> {
    try {
      await this.media.remove(key);
    } catch {
      // Deliberately swallowed — see above.
    }
  }

  /**
   * The object goes before the row (ADR 0012): a failure in between leaves a frame whose object is
   * already gone, and a repeat finishes the job because deleting a missing key succeeds.
   */
  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.products.findImage(productId, imageId);
    if (image === null) {
      throw new ImageNotFound(imageId);
    }

    await this.media.remove(image.r2Key);
    await this.products.deleteImage(imageId);
  }

  /** The objects go before the row (ADR 0012): if storage fails, the card and its frames stay. */
  async deleteProduct(productId: string): Promise<void> {
    const deleted = await this.products.deleteWithObjects(productId, (keys) =>
      this.media.removeMany(keys),
    );
    if (!deleted) {
      throw new ProductNotFound(productId);
    }
  }

  async setMainImage(productId: string, imageId: string): Promise<ProductImage[]> {
    if (!(await this.products.setMainImage(productId, imageId))) {
      throw new ImageNotFound(imageId);
    }
    const product = await this.products.findById(productId);
    if (product === null) {
      throw new ProductNotFound(productId);
    }

    return product.images;
  }

  /** The price is a decimal string and never becomes a number: any non-zero digit means above zero. */
  isReady(product: Product): boolean {
    return (
      product.titleProm !== '' &&
      product.titleOlx !== '' &&
      product.descriptionProm !== '' &&
      product.descriptionOlx !== '' &&
      /[1-9]/.test(product.price) &&
      product.images.length > 0
    );
  }
}
