import type { AuthUser } from '../../contracts/auth.contract.ts';
import { NotAuthenticated } from './auth.errors.ts';
import type { SessionTokens, UserRepository } from './auth.port.ts';
import { toAuthUser } from './user.ts';

/**
 * Session check. Used both by the guard of protected routes and by `GET /auth/me`.
 *
 * A valid signature is not enough: the user is read from the database so that
 * deactivation and logout take effect immediately, not "once the token expires".
 */
export type AuthenticateDependencies = {
  readonly users: UserRepository;
  readonly sessionTokens: SessionTokens;
};

export type AuthenticatedSession = {
  readonly user: AuthUser;
  readonly expiresAt: Date;
};

export type Authenticate = (token: string | undefined) => Promise<AuthenticatedSession>;

export function createAuthenticate(dependencies: AuthenticateDependencies): Authenticate {
  const { users, sessionTokens } = dependencies;

  return async function authenticate(token: string | undefined): Promise<AuthenticatedSession> {
    if (token === undefined || token === '') {
      throw new NotAuthenticated();
    }

    const claims = await sessionTokens.verify(token);
    if (claims === null) {
      throw new NotAuthenticated();
    }

    const user = await users.findById(claims.userId);
    if (user?.isActive !== true) {
      throw new NotAuthenticated();
    }

    if (claims.issuedAt.getTime() < user.tokensValidFrom.getTime()) {
      throw new NotAuthenticated();
    }

    return { user: toAuthUser(user), expiresAt: claims.expiresAt };
  };
}
