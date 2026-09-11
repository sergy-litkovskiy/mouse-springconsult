import type {
  ProductCreate,
  ProductListQuery,
  ProductUpdate,
} from '../../contracts/products.contract.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import type { Product, ProductPage } from './Product.ts';
import { ProductNotFound } from './ProductErrors.ts';
import type {
  ProductChanges,
  ProductListCriteria,
  ProductRepository,
} from './ProductRepository.ts';

/** Readiness is derived on read and never stored (ADR 0009). */
export type ProductReading = {
  readonly product: Product;
  readonly isReady: boolean;
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
  constructor(private readonly products: ProductRepository) {}

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

  async getById(id: string): Promise<ProductReading> {
    const product = await this.products.findById(id);
    if (product === null) {
      throw new ProductNotFound(id);
    }

    return { product, isReady: this.isReady(product) };
  }

  async create(input: ProductCreate): Promise<ProductSaving> {
    const { seoKeywords, discardedKeywordsCount } = capKeywords(input.seoKeywords);
    const product = await this.products.create({ ...input, seoKeywords });

    return { product, isReady: this.isReady(product), discardedKeywordsCount };
  }

  async update(id: string, changes: ProductUpdate): Promise<ProductSaving> {
    const { seoKeywords, discardedKeywordsCount } = capKeywords(changes.seoKeywords ?? []);
    // zod leaves an absent `.optional()` field out of the object rather than setting it to
    // `undefined`, so no key here holds `undefined` — its inferred type just cannot say so
    // under `exactOptionalPropertyTypes`.
    const product = await this.products.update(
      id,
      (changes.seoKeywords === undefined ? changes : { ...changes, seoKeywords }) as ProductChanges,
    );
    if (product === null) {
      throw new ProductNotFound(id);
    }

    return { product, isReady: this.isReady(product), discardedKeywordsCount };
  }

  /** The price is a decimal string and never becomes a number: any non-zero digit means above zero. */
  isReady(product: Product): boolean {
    return (
      product.descriptionProm !== '' &&
      product.descriptionOlx !== '' &&
      /[1-9]/.test(product.price) &&
      product.images.length > 0
    );
  }
}
