import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { z } from 'zod';
import { loginRequestSchema, type Session } from '../../contracts/auth.contract.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { AppError } from '../../errors.ts';
import { NotAuthenticated } from './AuthErrors.ts';
import type { AuthService, AuthenticatedSession } from './AuthService.ts';

declare module 'fastify' {
  // Augmenting a foreign type is only possible through an interface — declaration
  // merging does not work on type aliases.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyRequest {
    /** Filled in by `AuthController.sessionGuard`; absent on public routes. */
    session?: AuthenticatedSession;
  }
}

/**
 * HTTP layer of the auth module: input validation, cookie handling, mapping into DTOs.
 * There is no business logic here — it lives in `AuthService`.
 */
export type SessionCookieConfig = {
  readonly name: string;
  readonly path: string;
  readonly secure: boolean;
};

export type LoginRateLimit = {
  readonly max: number;
  readonly timeWindowMs: number;
};

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookieConfig,
    private readonly loginRateLimit: LoginRateLimit,
  ) {}

  /**
   * preHandler for protected routes. The composition root hands the same function to
   * every module; nobody outside this file needs to know the cookie name.
   */
  readonly sessionGuard: preHandlerAsyncHookHandler = async (request) => {
    request.session = await this.auth.authenticate(this.readSessionToken(request));
  };

  register(app: FastifyInstance): void {
    app.post(
      '/login',
      {
        config: {
          rateLimit: {
            max: this.loginRateLimit.max,
            timeWindow: this.loginRateLimit.timeWindowMs,
          },
        },
      },
      this.login,
    );
    app.post('/logout', this.logout);
    app.get('/me', { preHandler: this.sessionGuard }, this.me);
  }

  // Arrow fields rather than methods: Fastify calls a handler on its own, and a method
  // handed over as a value would lose `this`.
  private readonly login = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<Session> => {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError({
        code: apiErrorCodes.validationFailed,
        statusCode: 400,
        message: 'Request body is invalid',
        details: { fields: z.flattenError(parsed.error).fieldErrors },
      });
    }

    const result = await this.auth.login(parsed.data);
    this.setSessionCookie(reply, result.token, result.rememberMe ? result.ttlSeconds : null);

    return { user: result.user, expiresAt: result.expiresAt.toISOString() };
  };

  private readonly logout = async (request: FastifyRequest, reply: FastifyReply): Promise<null> => {
    try {
      const session = await this.auth.authenticate(this.readSessionToken(request));
      await this.auth.logout(session.user.id);
    } catch (error) {
      // Signing out has to be idempotent: an expired or forged cookie is no reason to
      // answer with an error — it simply gets cleared.
      if (!(error instanceof NotAuthenticated)) {
        throw error;
      }
    }

    // The attributes must match those the cookie was set with, otherwise the browser
    // treats this as a different cookie and keeps the old one.
    reply.clearCookie(this.cookie.name, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.cookie.secure,
      path: this.cookie.path,
    });
    reply.code(204);
    return null;
  };

  private readonly me = async (request: FastifyRequest): Promise<Session> => {
    if (request.session === undefined) {
      throw new NotAuthenticated();
    }
    return this.toSessionResponse(request.session);
  };

  private readSessionToken(request: FastifyRequest): string | undefined {
    return request.cookies[this.cookie.name];
  }

  private setSessionCookie(reply: FastifyReply, token: string, maxAgeSeconds: number | null): void {
    reply.setCookie(this.cookie.name, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.cookie.secure,
      path: this.cookie.path,
      // Without maxAge the cookie is a session cookie: it lives until the browser closes.
      // That is exactly what an unchecked "remember me" box means.
      ...(maxAgeSeconds === null ? {} : { maxAge: maxAgeSeconds }),
    });
  }

  private toSessionResponse(session: AuthenticatedSession): Session {
    return { user: session.user, expiresAt: session.expiresAt.toISOString() };
  }
}
