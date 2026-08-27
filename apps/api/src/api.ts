import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { ApiError } from './contracts/error.contract.ts';
import { apiErrorCodes } from './contracts/error-codes.ts';
import { config, env, isProduction } from './config.ts';
import { createDataSource } from './db.ts';
import { isAppError } from './errors.ts';
import { logger } from './logger.ts';
import {
  AuthController,
  AuthService,
  PasswordHasher,
  SessionTokens,
  SystemClock,
  User,
  UserRepository,
} from './modules/auth/index.ts';
import {
  Product,
  ProductController,
  ProductImage,
  ProductRepository,
  ProductService,
} from './modules/products/index.ts';

/**
 * Composition root of the HTTP process. Repositories, services and controllers are
 * created only here; every layer below receives its collaborators through a constructor.
 */

/** The single HTTP error mapping. Stack traces and 5xx messages never leave the process. */
function toApiError(error: unknown): { statusCode: number; body: ApiError } {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  const statusCode =
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;

  if (statusCode === 429) {
    return {
      statusCode,
      body: { error: { code: apiErrorCodes.tooManyRequests, message: 'Too many requests' } },
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      statusCode,
      body: { error: { code: apiErrorCodes.validationFailed, message: 'Request is invalid' } },
    };
  }

  return {
    statusCode: 500,
    body: { error: { code: apiErrorCodes.internalError, message: 'Internal server error' } },
  };
}

/** The instance type depends on the logger passed in, so it is inferred rather than spelled out. */
function createApp() {
  return Fastify({
    loggerInstance: logger,
    bodyLimit: config.http.bodyLimitBytes,
    requestTimeout: config.http.requestTimeoutMs,
    trustProxy: true,
  });
}

export type ApiServer = ReturnType<typeof createApp>;

export async function buildServer(): Promise<ApiServer> {
  const dataSource = createDataSource({ entities: [User, Product, ProductImage] });
  await dataSource.initialize();

  const authService = new AuthService(
    new UserRepository(dataSource),
    new PasswordHasher(),
    new SessionTokens({
      secret: env.JWT_SECRET,
      issuer: config.session.issuer,
      audience: config.session.audience,
      algorithm: config.session.algorithm,
    }),
    new SystemClock(),
    {
      ttlSeconds: config.session.ttlSeconds,
      rememberMeTtlSeconds: config.session.rememberMeTtlSeconds,
    },
  );
  const authController = new AuthController(
    authService,
    {
      name: config.session.cookieName,
      path: config.session.cookiePath,
      secure: isProduction,
    },
    config.rateLimit.login,
  );

  const productController = new ProductController(
    new ProductService(new ProductRepository(dataSource)),
  );

  const app = createApp();

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: config.rateLimit.global.max,
    timeWindow: config.rateLimit.global.timeWindowMs,
  });

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.code(404).send({ error: { code: 'not_found', message: 'Route not found' } });
  });

  app.setErrorHandler(async (error, request, reply) => {
    const mapped = toApiError(error);
    if (mapped.statusCode >= 500) {
      request.log.error({ err: error }, 'unhandled error');
    } else {
      request.log.info({ code: mapped.body.error.code }, 'request rejected');
    }
    await reply.code(mapped.statusCode).send(mapped.body);
  });

  app.get('/healthz', async () => {
    await dataSource.query('select 1');
    return { status: 'ok' };
  });

  await app.register(
    async (instance) => {
      authController.register(instance);
    },
    { prefix: '/auth' },
  );

  // One guard for every protected route in every module: the cookie name is known to the
  // auth controller and nowhere else, so a new module gets the check by receiving it.
  await app.register(
    async (instance) => {
      productController.register(instance, authController.sessionGuard);
    },
    { prefix: '/products' },
  );

  app.addHook('onClose', async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  return app;
}

async function main(): Promise<void> {
  const app = await buildServer();

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'shutting down');
      void app.close().then(() => {
        process.exit(0);
      });
    });
  }

  await app.listen({ host: config.http.host, port: config.http.port });
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start api');
  process.exit(1);
});
