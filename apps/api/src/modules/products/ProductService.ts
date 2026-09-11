import type {
  ProductCreate,
  ProductListQuery,
  ProductUpdate,
} from '../../contracts/products.contract.ts';
import type { Product, ProductPage } from './Product.ts';
import type { ProductListCriteria, ProductRepository } from './ProductRepository.ts';

/** Readiness is derived on read and never stored (ADR 0009). */
export type ProductReading = {
  readonly product: Product;
  readonly isReady: boolean;
};

/** Keywords past the ceiling are reported here rather than raised as an error (AC-07). */
export type ProductSaving = ProductReading & {
  readonly discardedKeywordsCount: number;
};

/**
 * A filter that was not sent does not become a condition: zod leaves an absent `.optional()`
 * field out of the object entirely, so what is left once the four pagination keys are taken out
 * is exactly the set of filters that arrived.
 */
export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async list(query: ProductListQuery): Promise<ProductPage> {
    const { page, pageSize, sort, direction, ...filters } = query;
    const criteria: ProductListCriteria = { page, pageSize, sort, direction, filters };

    return this.products.list(criteria);
  }

  async getById(id: string): Promise<ProductReading> {
    throw new Error('Not implemented');
  }

  async create(input: ProductCreate): Promise<ProductSaving> {
    throw new Error('Not implemented');
  }

  async update(id: string, changes: ProductUpdate): Promise<ProductSaving> {
    throw new Error('Not implemented');
  }

  isReady(product: Product): boolean {
    throw new Error('Not implemented');
  }
}
