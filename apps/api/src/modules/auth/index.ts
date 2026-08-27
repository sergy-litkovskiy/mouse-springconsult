/**
 * Public API of the auth module. Other modules see it through this file only —
 * deep imports are forbidden and dependency-cruiser enforces that.
 */
export { User, USERS_TABLE } from './User.ts';
export { UserRepository } from './UserRepository.ts';
export { PasswordHasher } from './PasswordHasher.ts';
export { SessionTokens } from './SessionTokens.ts';
export type {
  IssuedToken,
  IssueTokenInput,
  SessionClaims,
  SessionTokensConfig,
} from './SessionTokens.ts';
export { SystemClock } from './SystemClock.ts';

export { InvalidCredentials, NotAuthenticated, UserDeactivated } from './AuthErrors.ts';

export { AuthService } from './AuthService.ts';
export type {
  AuthenticatedSession,
  AuthServiceConfig,
  LoginInput,
  LoginOutput,
} from './AuthService.ts';

export { AuthController } from './AuthController.ts';
export type { LoginRateLimit, SessionCookieConfig } from './AuthController.ts';
