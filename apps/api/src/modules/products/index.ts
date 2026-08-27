/**
 * Public API of the products module. Other modules see it through this file only —
 * deep imports are forbidden and dependency-cruiser enforces that.
 */
export { Product, PRODUCTS_TABLE } from './Product.ts';
export type { ProductPage } from './Product.ts';
export { ProductImage, PRODUCT_IMAGES_TABLE } from './ProductImage.ts';

export { ProductRepository } from './ProductRepository.ts';
export type { ProductFilters, ProductListCriteria } from './ProductRepository.ts';

export { ProductService } from './ProductService.ts';
export { ProductController } from './ProductController.ts';
