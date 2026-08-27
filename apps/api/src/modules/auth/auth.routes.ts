import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { z } from 'zod';
import { loginRequestSchema, type Session } from '../../contracts/auth.contract.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { AppError } from '../../errors.ts';
import { NotAuthenticated } from './auth.errors.ts';
import type { AuthenticatedSession, Authenticate } from './authenticate.use-case.ts';
import type { Login } from './login.use-case.ts';
import type { Logout } from './logout.use-case.ts';

declare module 'fastify' {
  // Augmenting a foreign type is only possible through an interface — declaration
  // merging does not work on type aliases.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyRequest {
    /** Filled in by `createSessionGuard`; absent on public routes. */
    session?: AuthenticatedSession;
  }
}

/**
 * HTTP layer of the auth module: input validation, cookie handling, mapping into DTOs.
 * There is no business logic here — it lives in the use-cases.
 */
export type SessionCookieConfig = {
  readonly name: string;
  readonly path: string;
  readonly secure: boolean;
};

export type AuthRoutesDependencies = {
  readonly login: Login;
  readonly logout: Logout;
  readonly authenticate: Authenticate;
  readonly cookie: SessionCookieConfig;
  readonly loginRateLimit: { readonly max: number; readonly timeWindowMs: number };
};

function readSessionToken(request: FastifyRequest, cookieName: string): string | undefined {
  return request.cookies[cookieName];
}

function toSessionResponse(session: AuthenticatedSession): Session {
  return { user: session.user, expiresAt: session.expiresAt.toISOString() };
}

/**
 * preHandler for protected routes. Other modules take it through `index.ts`.
 */
export function createSessionGuard(
  authenticate: Authenticate,
  cookieName: string,
): preHandlerAsyncHookHandler {
  return async function sessionGuard(request: FastifyRequest): Promise<void> {
    request.session = await authenticate(readSessionToken(request, cookieName));
  };
}

export function createAuthRoutes(dependencies: AuthRoutesDependencies): FastifyPluginAsync {
  const { login, logout, authenticate, cookie } = dependencies;
  const guard = createSessionGuard(authenticate, cookie.name);

  function setSessionCookie(
    reply: FastifyReply,
    token: string,
    maxAgeSeconds: number | null,
  ): void {
    reply.setCookie(cookie.name, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: cookie.secure,
      path: cookie.path,
      // Without maxAge the cookie is a session cookie: it lives until the browser closes.
      // That is exactly what an unchecked "remember me" box means.
      ...(maxAgeSeconds === null ? {} : { maxAge: maxAgeSeconds }),
    });
  }

  return async function authRoutes(app): Promise<void> {
    app.post(
      '/login',
      {
        config: {
          rateLimit: {
            max: dependencies.loginRateLimit.max,
            timeWindow: dependencies.loginRateLimit.timeWindowMs,
          },
        },
      },
      async (request, reply): Promise<Session> => {
        const parsed = loginRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new AppError({
            code: apiErrorCodes.validationFailed,
            statusCode: 400,
            message: 'Request body is invalid',
            details: { fields: z.flattenError(parsed.error).fieldErrors },
          });
        }

        const result = await login(parsed.data);
        setSessionCookie(reply, result.token, result.rememberMe ? result.ttlSeconds : null);

        return { user: result.user, expiresAt: result.expiresAt.toISOString() };
      },
    );

    app.post('/logout', async (request, reply): Promise<null> => {
      try {
        const session = await authenticate(readSessionToken(request, cookie.name));
        await logout(session.user.id);
      } catch (error) {
        // Signing out has to be idempotent: an expired or forged cookie is no reason to
        // answer with an error — it simply gets cleared.
        if (!(error instanceof NotAuthenticated)) {
          throw error;
        }
      }

      // The attributes must match those the cookie was set with, otherwise the browser
      // treats this as a different cookie and keeps the old one.
      reply.clearCookie(cookie.name, {
        httpOnly: true,
        sameSite: 'strict',
        secure: cookie.secure,
        path: cookie.path,
      });
      reply.code(204);
      return null;
    });

    app.get('/me', { preHandler: guard }, async (request): Promise<Session> => {
      if (request.session === undefined) {
        throw new NotAuthenticated();
      }
      return toSessionResponse(request.session);
    });
  };
}
