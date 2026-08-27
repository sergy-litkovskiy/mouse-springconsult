/**
 * Public API of the auth module. Other modules see it through this file only —
 * deep imports are forbidden and dependency-cruiser enforces that.
 */
export type { User } from './user.ts';
export { toAuthUser } from './user.ts';

export type {
  Clock,
  PasswordHasher,
  SessionClaims,
  SessionTokens,
  UserRepository,
} from './auth.port.ts';
export { systemClock } from './auth.port.ts';

export { InvalidCredentials, NotAuthenticated, UserDeactivated } from './auth.errors.ts';

export type { Authenticate, AuthenticatedSession } from './authenticate.use-case.ts';
export { createAuthenticate } from './authenticate.use-case.ts';
export type { Login, LoginInput, LoginOutput } from './login.use-case.ts';
export { createLogin } from './login.use-case.ts';
export type { Logout } from './logout.use-case.ts';
export { createLogout } from './logout.use-case.ts';

export { UserEntity, USERS_TABLE } from './user.entity.ts';
export { createUserRepository } from './user.repository.ts';
export { createPasswordHasher } from './password-hasher.adapter.ts';
export { createSessionTokens } from './session-token.adapter.ts';

export type { AuthRoutesDependencies, SessionCookieConfig } from './auth.routes.ts';
export { createAuthRoutes, createSessionGuard } from './auth.routes.ts';
