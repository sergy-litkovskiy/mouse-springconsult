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
  createAuthenticate,
  createAuthRoutes,
  createLogin,
  createLogout,
  createPasswordHasher,
  createSessionTokens,
  createUserRepository,
  systemClock,
  UserEntity,
} from './modules/auth/index.ts';
import {
  createListProducts,
  createProductRepository,
  createProductsRoutes,
  ProductEntity,
  ProductImageEntity,
} from './modules/products/index.ts';

/**
 * Composition root of the HTTP process. Port implementations are created only here and
 * wired to the use-cases; everything deeper receives ready-made functions.
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
  const dataSource = createDataSource({
    entities: [UserEntity, ProductEntity, ProductImageEntity],
  });
  await dataSource.initialize();

  const users = createUserRepository(dataSource);
  const passwordHasher = createPasswordHasher();
  const sessionTokens = createSessionTokens({
    secret: env.JWT_SECRET,
    issuer: config.session.issuer,
    audience: config.session.audience,
    algorithm: config.session.algorithm,
  });

  const login = createLogin({
    users,
    passwordHasher,
    sessionTokens,
    clock: systemClock,
    ttlSeconds: config.session.ttlSeconds,
    rememberMeTtlSeconds: config.session.rememberMeTtlSeconds,
  });
  const logout = createLogout({ users, clock: systemClock });
  const authenticate = createAuthenticate({ users, sessionTokens });

  const products = createProductRepository(dataSource);
  const listProducts = createListProducts({ products });

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
    createAuthRoutes({
      login,
      logout,
      authenticate,
      cookie: {
        name: config.session.cookieName,
        path: config.session.cookiePath,
        secure: isProduction,
      },
      loginRateLimit: config.rateLimit.login,
    }),
    { prefix: '/auth' },
  );

  await app.register(
    createProductsRoutes({
      listProducts,
      authenticate,
      sessionCookieName: config.session.cookieName,
    }),
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
