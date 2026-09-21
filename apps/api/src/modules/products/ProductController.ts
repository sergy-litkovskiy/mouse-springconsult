import type {} from '@fastify/multipart';
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
  type FieldSuggestion as FieldSuggestionResponse,
  type ProductCard,
  type ProductCardRead,
  type ProductImage as ProductImageResponse,
  type ProductList,
  type ProductListItem,
  type Product as ProductResponse,
  type ProductUpdateResponse,
} from '../../contracts/products.contract.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import { config } from '../../config.ts';
import { AppError } from '../../errors.ts';
import { FileTooLarge } from '../media/index.ts';
import type { FieldSuggestion, SuggestionField } from './FieldSuggestion.ts';
import type { Product, ProductPage } from './Product.ts';
import {
  ImageNotFound,
  InvalidPrice,
  ProductNotFound,
  SuggestionNotFound,
} from './ProductErrors.ts';
import type { ProductImage } from './ProductImage.ts';
import type {
  ProductCardReading,
  ProductReading,
  ProductSaving,
  ProductService,
} from './ProductService.ts';

const productParamsSchema = z.object({ productId: z.uuid() });

/** The column spells a field the way SQL does; the contract spells it the way the card does. */
const suggestionFieldNames = {
  title_prom: 'titleProm',
  title_olx: 'titleOlx',
  description_prom: 'descriptionProm',
  description_olx: 'descriptionOlx',
  seo_keywords: 'seoKeywords',
  price: 'price',
} as const satisfies Record<SuggestionField, FieldSuggestionResponse['field']>;

/**
 * The session guard arrives ready-made from the composition root: how a session is recognised is
 * the business of `modules/auth`, and this module does not even learn the cookie name.
 */
export class ProductController {
  /** `imagePublicBaseUrl` is the bucket's public address, validated without a trailing slash. */
  constructor(
    private readonly products: ProductService,
    private readonly imagePublicBaseUrl: string,
  ) {}

  register(app: FastifyInstance, sessionGuard: preHandlerAsyncHookHandler): void {
    app.get('/', { preHandler: sessionGuard }, this.list);
    app.post('/', { preHandler: sessionGuard }, this.create);
    app.get('/:productId', { preHandler: sessionGuard }, this.getById);
    app.patch('/:productId', { preHandler: sessionGuard }, this.update);
    app.delete('/:productId', { preHandler: sessionGuard }, this.deleteProduct);
    app.post(
      '/:productId/images',
      { preHandler: sessionGuard, bodyLimit: config.http.imageUpload.bodyLimitBytes },
      this.uploadImage,
    );
    app.delete('/:productId/images/:imageId', { preHandler: sessionGuard }, this.deleteImage);
    app.put('/:productId/images/:imageId/main', { preHandler: sessionGuard }, this.setMainImage);
    app.post(
      '/:productId/suggestions/:suggestionId/accept',
      { preHandler: sessionGuard },
      this.acceptSuggestion,
    );
    app.post(
      '/:productId/suggestions/:suggestionId/reject',
      { preHandler: sessionGuard },
      this.rejectSuggestion,
    );
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

  private readonly getById = async (request: FastifyRequest): Promise<ProductCardRead> => {
    return this.toCardReadResponse(await this.products.getById(this.readProductId(request)));
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

  private readonly uploadImage = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<ProductImageResponse> => {
    const productId = this.readProductId(request);
    const bytes = await readUploadedFile(request);
    const image = await this.products.addImage(productId, bytes);
    reply.code(201);
    return this.toImageResponse(image);
  };

  private readonly deleteImage = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const productId = this.readProductId(request);
    const imageId = this.readImageId(request);
    await this.products.deleteImage(productId, imageId);
    return reply.code(204).send();
  };

  private readonly deleteProduct = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    await this.products.deleteProduct(this.readProductId(request));
    return reply.code(204).send();
  };

  private readonly acceptSuggestion = async (request: FastifyRequest): Promise<ProductCardRead> => {
    const productId = this.readProductId(request);
    const suggestionId = this.readSuggestionId(request);
    return this.toCardReadResponse(await this.products.acceptSuggestion(productId, suggestionId));
  };

  private readonly rejectSuggestion = async (request: FastifyRequest): Promise<ProductCardRead> => {
    const productId = this.readProductId(request);
    const suggestionId = this.readSuggestionId(request);
    return this.toCardReadResponse(await this.products.rejectSuggestion(productId, suggestionId));
  };

  private readonly setMainImage = async (
    request: FastifyRequest,
  ): Promise<ProductImageResponse[]> => {
    const productId = this.readProductId(request);
    const imageId = this.readImageId(request);
    return this.toGalleryResponse(await this.products.setMainImage(productId, imageId));
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

  /** A malformed frame identifier names no frame, so it is answered as one that does not exist. */
  private readImageId(request: FastifyRequest): string {
    const rawImageId = (request.params as { imageId?: unknown }).imageId;
    const parsed = z.uuid().safeParse(rawImageId);
    if (!parsed.success) {
      throw new ImageNotFound(String(rawImageId));
    }
    return parsed.data;
  }

  /** A malformed identifier names no suggestion, so it is answered as one that does not exist. */
  private readSuggestionId(request: FastifyRequest): string {
    const rawSuggestionId = (request.params as { suggestionId?: unknown }).suggestionId;
    const parsed = z.uuid().safeParse(rawSuggestionId);
    if (!parsed.success) {
      throw new SuggestionNotFound(String(rawSuggestionId));
    }
    return parsed.data;
  }

  private toCardReadResponse(reading: ProductCardReading): ProductCardRead {
    return {
      ...this.toCardResponse(reading),
      pendingSuggestions: reading.pendingSuggestions.map((suggestion) =>
        this.toSuggestionResponse(suggestion),
      ),
      totalInputTokens: reading.tokens.inputTokens,
      totalOutputTokens: reading.tokens.outputTokens,
    };
  }

  /** `resolution` and `resolvedAt` are left out: everything answered here is still undecided. */
  private toSuggestionResponse(suggestion: FieldSuggestion): FieldSuggestionResponse {
    return {
      id: suggestion.id,
      runId: suggestion.runId,
      field: suggestionFieldNames[suggestion.field],
      value: suggestion.value,
      createdAt: suggestion.createdAt.toISOString(),
    };
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
      items: page.items.map((product): ProductListItem => ({
        ...this.toCardResponse({ product, isReady: this.products.isReady(product) }),
        failedRuns: page.failedRuns.get(product.id) ?? 0,
      })),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

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
      images: this.toGalleryResponse(product.images),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  /** The gallery reaches the API ordered by position. */
  private toGalleryResponse(images: readonly ProductImage[]): ProductImageResponse[] {
    return [...images]
      .sort((left, right) => left.position - right.position)
      .map((image) => this.toImageResponse(image));
  }

  private toImageResponse(image: ProductImage): ProductImageResponse {
    return {
      id: image.id,
      r2Key: image.r2Key,
      // The only place a frame's address is composed (ADR 0007).
      url: `${this.imagePublicBaseUrl}/${image.r2Key}`,
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

function missingFile(): AppError {
  return new AppError({
    code: apiErrorCodes.validationFailed,
    statusCode: 400,
    message: 'Request body is invalid',
    details: { fields: { file: ['A single file in the "file" field is required'] } },
  });
}

/**
 * The declared type is not read here at all: `MediaService` decides by the content (ADR 0004).
 * busboy truncates a file at `maxFileBytes`, and the plugin reports that with its own error,
 * which the error handler would otherwise answer as a generic 4xx.
 */
async function readUploadedFile(request: FastifyRequest): Promise<Uint8Array> {
  if (!request.isMultipart()) {
    throw missingFile();
  }

  const part = await request.file();
  if (part?.fieldname !== 'file') {
    throw missingFile();
  }

  try {
    return await part.toBuffer();
  } catch (error) {
    if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
      throw new FileTooLarge(productConstraints.maxImageBytes);
    }
    throw error;
  }
}
