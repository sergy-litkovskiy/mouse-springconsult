import type { ProductListQuery } from '../../contracts/products.contract.ts';
import type { ProductPage } from './Product.ts';
import type { ProductListCriteria, ProductRepository } from './ProductRepository.ts';

/**
 * Business logic of the catalogue. The repository comes in through the constructor and
 * is created by the composition root.
 *
 * Reading a page is the translation of a validated request into repository criteria: the
 * flat query is split into pagination, ordering and filters, and a filter that was not
 * sent does not become a condition. Silence in a request is not the same as an empty
 * string — zod leaves an absent `.optional()` field out of the object entirely, so what
 * is left after the four pagination keys are taken out is exactly the set of filters that
 * arrived.
 */
export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async list(query: ProductListQuery): Promise<ProductPage> {
    const { page, pageSize, sort, direction, ...filters } = query;
    const criteria: ProductListCriteria = { page, pageSize, sort, direction, filters };

    return this.products.list(criteria);
  }
}
