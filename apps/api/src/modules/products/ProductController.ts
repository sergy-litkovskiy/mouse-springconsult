import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import {
  productListQuerySchema,
  type ProductImage as ProductImageResponse,
  type ProductList,
  type Product as ProductResponse,
} from '../../contracts/products.contract.ts';
import { AppError } from '../../errors.ts';
import type { Product, ProductPage } from './Product.ts';
import type { ProductImage } from './ProductImage.ts';
import type { ProductService } from './ProductService.ts';

/**
 * HTTP layer of the products module: query validation, the session check, mapping into
 * the DTO. No business logic — that lives in the service.
 *
 * The catalogue is admin-only, so the route sits behind the session guard. The guard
 * arrives ready-made from the composition root: how a session is recognised is the
 * business of `modules/auth`, and this module does not even learn the cookie name.
 */
export class ProductController {
  constructor(private readonly products: ProductService) {}

  register(app: FastifyInstance, sessionGuard: preHandlerAsyncHookHandler): void {
    app.get('/', { preHandler: sessionGuard }, this.list);
  }

  // An arrow field rather than a method: Fastify calls the handler on its own, and a
  // method handed over as a value would lose `this`.
  private readonly list = async (request: FastifyRequest): Promise<ProductList> => {
    const parsed = productListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError({
        code: apiErrorCodes.validationFailed,
        statusCode: 400,
        message: 'Query parameters are invalid',
        details: { fields: z.flattenError(parsed.error).fieldErrors },
      });
    }

    return this.toListResponse(await this.products.list(parsed.data));
  };

  private toListResponse(page: ProductPage): ProductList {
    return {
      items: page.items.map((product) => this.toProductResponse(product)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  /** The API form of a card: dates as ISO 8601, gallery ordered by position. */
  private toProductResponse(product: Product): ProductResponse {
    return {
      id: product.id,
      titleProm: product.titleProm,
      descriptionProm: product.descriptionProm,
      titleOlx: product.titleOlx,
      descriptionOlx: product.descriptionOlx,
      price: product.price,
      seoKeywords: [...product.seoKeywords],
      category: product.category,
      published: product.published,
      accountProm: product.accountProm,
      accountOlx: product.accountOlx,
      condition: product.condition,
      images: [...product.images]
        .sort((left, right) => left.position - right.position)
        .map((image) => this.toImageResponse(image)),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private toImageResponse(image: ProductImage): ProductImageResponse {
    return {
      id: image.id,
      r2Key: image.r2Key,
      url: image.url,
      position: image.position,
      isMain: image.isMain,
    };
  }
}
