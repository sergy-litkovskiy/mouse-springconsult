import type { Clock, UserRepository } from './auth.port.ts';

/**
 * Signing out. The cookie is cleared by the HTTP layer, while the real revocation
 * happens here: `tokensValidFrom` moves to "now", so a copy of the token that someone
 * managed to lift from the browser is no longer accepted.
 */
export type LogoutDependencies = {
  readonly users: UserRepository;
  readonly clock: Clock;
};

export type Logout = (userId: string) => Promise<void>;

export function createLogout(dependencies: LogoutDependencies): Logout {
  const { users, clock } = dependencies;

  return async function logout(userId: string): Promise<void> {
    await users.revokeTokensIssuedBefore(userId, clock.now());
  };
}
