import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { productListQuerySchema, type ProductList } from '../../contracts/products.contract.ts';
import { AppError } from '../../errors.ts';
import { createSessionGuard, type Authenticate } from '../auth/index.ts';
import type { ListProducts } from './list-products.use-case.ts';
import { toProductListResponse } from './product.ts';

/**
 * HTTP layer of the products module: query validation, the session check, mapping into
 * the DTO. No business logic — that lives in the use-case.
 *
 * The catalogue is admin-only, so the route sits behind the auth guard, taken through
 * `modules/auth/index.ts` — the public API of the module, never a deep import.
 */
export type ProductsRoutesDependencies = {
  readonly listProducts: ListProducts;
  readonly authenticate: Authenticate;
  readonly sessionCookieName: string;
};

export function createProductsRoutes(dependencies: ProductsRoutesDependencies): FastifyPluginAsync {
  const { listProducts, authenticate, sessionCookieName } = dependencies;
  const guard = createSessionGuard(authenticate, sessionCookieName);

  return async function productsRoutes(app): Promise<void> {
    app.get('/', { preHandler: guard }, async (request): Promise<ProductList> => {
      const parsed = productListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError({
          code: apiErrorCodes.validationFailed,
          statusCode: 400,
          message: 'Query parameters are invalid',
          details: { fields: z.flattenError(parsed.error).fieldErrors },
        });
      }

      return toProductListResponse(await listProducts(parsed.data));
    });
  };
}
