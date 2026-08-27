/**
 * Public API of the products module. Other modules see it through this file only —
 * deep imports are forbidden and dependency-cruiser enforces that.
 */
export type { Product, ProductImage, ProductPage } from './product.ts';
export { toProductListResponse, toProductResponse } from './product.ts';

export type { ProductFilters, ProductListCriteria, ProductRepository } from './products.port.ts';

export type { ListProducts, ListProductsDependencies } from './list-products.use-case.ts';
export { createListProducts } from './list-products.use-case.ts';

export { ProductEntity, PRODUCTS_TABLE } from './product.entity.ts';
export { ProductImageEntity, PRODUCT_IMAGES_TABLE } from './product-image.entity.ts';
export { createProductRepository } from './product.repository.ts';

export type { ProductsRoutesDependencies } from './products.routes.ts';
export { createProductsRoutes } from './products.routes.ts';
