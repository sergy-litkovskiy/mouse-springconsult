import type { AuthUser } from '../../contracts/auth.contract.ts';
import { InvalidCredentials, NotAuthenticated, UserDeactivated } from './AuthErrors.ts';
import type { PasswordHasher } from './PasswordHasher.ts';
import type { SessionTokens } from './SessionTokens.ts';
import type { SystemClock } from './SystemClock.ts';
import type { User } from './User.ts';
import type { UserRepository } from './UserRepository.ts';

/**
 * Business logic of a session: signing in, checking a session, signing out. The
 * repository, the hasher, the tokens and the clock come in through the constructor and
 * are created by the composition root.
 */
export type AuthServiceConfig = {
  /** Regular sign-in. */
  readonly ttlSeconds: number;
  /** "Remember me": the token lives as long as the cookie does. */
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

export type AuthenticatedSession = {
  readonly user: AuthUser;
  readonly expiresAt: Date;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokens: SessionTokens,
    private readonly clock: SystemClock,
    private readonly config: AuthServiceConfig,
  ) {}

  async login(input: LoginInput): Promise<LoginOutput> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (user === null) {
      // Verify against a decoy hash so that an unknown email costs as much time as a known
      // one. Otherwise the duration of the response becomes an oracle in its own right.
      await this.passwordHasher.verify(this.passwordHasher.decoyHash, input.password);
      throw new InvalidCredentials();
    }

    const passwordMatches = await this.passwordHasher.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new InvalidCredentials();
    }

    if (!user.isActive) {
      throw new UserDeactivated();
    }

    const now = this.clock.now();
    const ttlSeconds = input.rememberMe ? this.config.rememberMeTtlSeconds : this.config.ttlSeconds;

    const issued = await this.sessionTokens.issue({
      userId: user.id,
      email: user.email,
      ttlSeconds,
      now,
    });

    await this.users.recordLogin(user.id, now);

    return {
      token: issued.token,
      expiresAt: issued.expiresAt,
      ttlSeconds,
      rememberMe: input.rememberMe,
      user: this.toAuthUser(user),
    };
  }

  /**
   * Session check. Used both by the guard of protected routes and by `GET /auth/me`.
   *
   * A valid signature is not enough: the user is read from the database so that
   * deactivation and logout take effect immediately, not "once the token expires".
   */
  async authenticate(token: string | undefined): Promise<AuthenticatedSession> {
    if (token === undefined || token === '') {
      throw new NotAuthenticated();
    }

    const claims = await this.sessionTokens.verify(token);
    if (claims === null) {
      throw new NotAuthenticated();
    }

    const user = await this.users.findById(claims.userId);
    if (user?.isActive !== true) {
      throw new NotAuthenticated();
    }

    if (claims.issuedAt.getTime() < user.tokensValidFrom.getTime()) {
      throw new NotAuthenticated();
    }

    return { user: this.toAuthUser(user), expiresAt: claims.expiresAt };
  }

  /**
   * Signing out. The cookie is cleared by the controller, while the real revocation
   * happens here: `tokensValidFrom` moves to "now", so a copy of the token that someone
   * managed to lift from the browser is no longer accepted.
   */
  async logout(userId: string): Promise<void> {
    await this.users.revokeTokensIssuedBefore(userId, this.clock.now());
  }

  /**
   * What is safe to hand out: no password hash, no internal fields. The narrowing happens
   * here rather than in the controller — who may see what is not a formatting question.
   */
  private toAuthUser(user: User): AuthUser {
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
