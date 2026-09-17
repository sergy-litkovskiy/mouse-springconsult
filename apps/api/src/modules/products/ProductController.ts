import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { z } from 'zod';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import {
  productCreateSchema,
  productListQuerySchema,
  productUpdateSchema,
  type ProductCard,
  type ProductImage as ProductImageResponse,
  type ProductList,
  type Product as ProductResponse,
  type ProductUpdateResponse,
} from '../../contracts/products.contract.ts';
import { AppError } from '../../errors.ts';
import type { Product, ProductPage } from './Product.ts';
import { InvalidPrice, ProductNotFound } from './ProductErrors.ts';
import type { ProductImage } from './ProductImage.ts';
import type { ProductReading, ProductSaving, ProductService } from './ProductService.ts';

const productParamsSchema = z.object({ productId: z.uuid() });

/**
 * The session guard arrives ready-made from the composition root: how a session is recognised is
 * the business of `modules/auth`, and this module does not even learn the cookie name.
 */
export class ProductController {
  constructor(private readonly products: ProductService) {}

  register(app: FastifyInstance, sessionGuard: preHandlerAsyncHookHandler): void {
    app.get('/', { preHandler: sessionGuard }, this.list);
    app.post('/', { preHandler: sessionGuard }, this.create);
    app.get('/:productId', { preHandler: sessionGuard }, this.getById);
    app.patch('/:productId', { preHandler: sessionGuard }, this.update);
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

  private readonly getById = async (request: FastifyRequest): Promise<ProductCard> => {
    return this.toCardResponse(await this.products.getById(this.readProductId(request)));
  };

  private readonly create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<ProductUpdateResponse> => {
    const input = parseBody(productCreateSchema, request.body);
    reply.code(201);
    return this.toSavingResponse(await this.products.create(input));
  };

  private readonly update = async (request: FastifyRequest): Promise<ProductUpdateResponse> => {
    const productId = this.readProductId(request);
    const changes = parseBody(productUpdateSchema, request.body);
    return this.toSavingResponse(await this.products.update(productId, changes));
  };

  /**
   * A malformed identifier names no card, so it is answered as one that does not exist — the
   * contract promises 404 here, not 400, and Postgres would reject the value as a uuid anyway.
   */
  private readProductId(request: FastifyRequest): string {
    const parsed = productParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new ProductNotFound(String((request.params as { productId?: unknown }).productId));
    }
    return parsed.data.productId;
  }

  private toCardResponse({ product, isReady }: ProductReading): ProductCard {
    return { ...this.toProductResponse(product), isReady };
  }

  private toSavingResponse(saving: ProductSaving): ProductUpdateResponse {
    return {
      ...this.toCardResponse(saving),
      discardedKeywordsCount: saving.discardedKeywordsCount,
    };
  }

  private toListResponse(page: ProductPage): ProductList {
    return {
      items: page.items.map((product) => this.toProductResponse(product)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  /** The gallery reaches the API ordered by position. */
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
      publishedProm: product.publishedProm,
      publishedOlx: product.publishedOlx,
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

/**
 * A price that is the only thing wrong is reported as `invalid_price` (AC-09): the frontend puts
 * that code on the price field. Anything else wrong makes it a plain `validation_failed` with the
 * price listed among the other fields.
 */
function parseBody<Schema extends z.ZodType>(schema: Schema, body: unknown): z.output<Schema> {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }

  const fields = z.flattenError(parsed.error).fieldErrors as Record<string, unknown>;
  const invalidFields = Object.keys(fields);
  if (invalidFields.length === 1 && invalidFields[0] === 'price') {
    throw new InvalidPrice();
  }

  throw new AppError({
    code: apiErrorCodes.validationFailed,
    statusCode: 400,
    message: 'Request body is invalid',
    details: { fields },
  });
}
