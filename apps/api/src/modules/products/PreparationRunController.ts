import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { z } from 'zod';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { AppError } from '../../errors.ts';
import { ProductNotFound } from './ProductErrors.ts';
import type { PreparationRunService } from './PreparationRunService.ts';

const startParamsSchema = z.object({ productId: z.uuid() });
const runParamsSchema = z.object({ productId: z.uuid(), runId: z.uuid() });
const startBodySchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.enum(['texts', 'price', 'both']) }),
  z.object({
    scope: z.literal('field'),
    field: z.enum(['titleProm', 'titleOlx', 'descriptionProm', 'descriptionOlx', 'seoKeywords']),
    draftText: z.string(),
  }),
]);

export class PreparationRunController {
  constructor(private readonly preparations: PreparationRunService) {}

  register(app: FastifyInstance, sessionGuard: preHandlerAsyncHookHandler): void {
    app.post('/:productId/preparation-runs', { preHandler: sessionGuard }, this.start);
    app.get('/:productId/preparation-runs/:runId', { preHandler: sessionGuard }, this.getRun);
  }

  // Arrow fields: Fastify calls the handler on its own, and a method would lose `this`.
  private readonly start = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = startParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ProductNotFound(String((request.params as { productId?: unknown }).productId));
    }
    const body = startBodySchema.safeParse(request.body);
    if (!body.success) {
      throw new AppError({
        code: apiErrorCodes.validationFailed,
        statusCode: 400,
        message: 'Request body is invalid',
        details: { fields: z.flattenError(body.error).fieldErrors },
      });
    }

    const { run, created } = await this.preparations.start(params.data.productId, body.data);
    reply.code(created ? 201 : 200);
    return {
      id: run.id,
      productId: run.productId,
      scope: run.scope,
      status: run.status,
      errorCode: run.errorCode,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  };

  /** A malformed identifier names nothing, so it is answered as missing, like the product routes. */
  private readonly getRun = async (request: FastifyRequest) => {
    const params = runParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ProductNotFound(String((request.params as { productId?: unknown }).productId));
    }

    const run = await this.preparations.getRun(params.data.productId, params.data.runId);
    return {
      id: run.id,
      productId: run.productId,
      scope: run.scope,
      status: run.status,
      errorCode: run.errorCode,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  };
}
