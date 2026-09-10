import type { ProductListQuery } from '../../contracts/products.contract.ts';
import type { ProductPage } from './Product.ts';
import type { ProductListCriteria, ProductRepository } from './ProductRepository.ts';

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
}
