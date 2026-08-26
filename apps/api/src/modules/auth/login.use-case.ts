import type { AuthUser } from '../../contracts/auth.contract.ts';
import { InvalidCredentials, UserDeactivated } from './auth.errors.ts';
import type { Clock, PasswordHasher, SessionTokens, UserRepository } from './auth.port.ts';
import { toAuthUser } from './user.ts';

/**
 * Signing in. Depends on ports only — Postgres, argon2 and jose are supplied by the
 * composition root, while tests supply in-memory implementations.
 */
export type LoginDependencies = {
  readonly users: UserRepository;
  readonly passwordHasher: PasswordHasher;
  readonly sessionTokens: SessionTokens;
  readonly clock: Clock;
  readonly ttlSeconds: number;
  readonly rememberMeTtlSeconds: number;
};

export type LoginInput = {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
};

export type LoginOutput = {
  readonly token: string;
  readonly expiresAt: Date;
  readonly ttlSeconds: number;
  readonly rememberMe: boolean;
  readonly user: AuthUser;
};

export type Login = (input: LoginInput) => Promise<LoginOutput>;

export function createLogin(dependencies: LoginDependencies): Login {
  const { users, passwordHasher, sessionTokens, clock } = dependencies;

  return async function login(input: LoginInput): Promise<LoginOutput> {
    const email = input.email.trim().toLowerCase();
    const user = await users.findByEmail(email);

    if (user === null) {
      // Verify against a decoy hash so that an unknown email costs as much time as a known
      // one. Otherwise the duration of the response becomes an oracle in its own right.
      await passwordHasher.verify(passwordHasher.decoyHash, input.password);
      throw new InvalidCredentials();
    }

    const passwordMatches = await passwordHasher.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new InvalidCredentials();
    }

    if (!user.isActive) {
      throw new UserDeactivated();
    }

    const now = clock.now();
    const ttlSeconds = input.rememberMe
      ? dependencies.rememberMeTtlSeconds
      : dependencies.ttlSeconds;

    const issued = await sessionTokens.issue({
      userId: user.id,
      email: user.email,
      ttlSeconds,
      now,
    });

    await users.recordLogin(user.id, now);

    return {
      token: issued.token,
      expiresAt: issued.expiresAt,
      ttlSeconds,
      rememberMe: input.rememberMe,
      user: toAuthUser(user),
    };
  };
}
