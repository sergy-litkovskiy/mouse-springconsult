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
import type { PreparationRun } from './PreparationRun.ts';
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
    const params = parseParams(startParamsSchema, request.params);
    const body = startBodySchema.safeParse(request.body);
    if (!body.success) {
      throw new AppError({
        code: apiErrorCodes.validationFailed,
        statusCode: 400,
        message: 'Request body is invalid',
        details: { fields: z.flattenError(body.error).fieldErrors },
      });
    }

    const { run, created } = await this.preparations.start(params.productId, body.data);
    reply.code(created ? 201 : 200);
    return toRunResponse(run);
  };

  private readonly getRun = async (request: FastifyRequest) => {
    const params = parseParams(runParamsSchema, request.params);
    const run = await this.preparations.getRun(params.productId, params.runId);
    return toRunResponse(run);
  };
}

/** A malformed identifier names nothing, so it is answered as missing, like the product routes. */
function parseParams<Params>(schema: z.ZodType<Params>, params: unknown): Params {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new ProductNotFound(String((params as { productId?: unknown }).productId));
  }
  return parsed.data;
}

function toRunResponse(run: PreparationRun) {
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
}
