import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';

/**
 * Session tokens on JWT (jose, HS256).
 *
 * The token travels in an httpOnly cookie rather than localStorage: the SPA and the API
 * live on one domain behind Caddy, so cross-origin headers are unnecessary and XSS has
 * nowhere to read it from. See ADR 0002.
 */
export type SessionTokensConfig = {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly algorithm: string;
};

export type SessionClaims = {
  readonly userId: string;
  readonly email: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
};

export type IssueTokenInput = {
  readonly userId: string;
  readonly email: string;
  readonly ttlSeconds: number;
  readonly now: Date;
};

export type IssuedToken = {
  readonly token: string;
  readonly expiresAt: Date;
};

export class SessionTokens {
  private readonly key: Uint8Array;

  constructor(private readonly config: SessionTokensConfig) {
    this.key = new TextEncoder().encode(config.secret);
  }

  async issue(input: IssueTokenInput): Promise<IssuedToken> {
    const issuedAtSeconds = Math.floor(input.now.getTime() / 1000);
    const expiresAtSeconds = issuedAtSeconds + input.ttlSeconds;

    const token = await new SignJWT({ email: input.email })
      .setProtectedHeader({ alg: this.config.algorithm })
      .setSubject(input.userId)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(expiresAtSeconds)
      .sign(this.key);

    return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
  }

  /** Returns null for an expired, forged or foreign token. */
  async verify(token: string): Promise<SessionClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm],
      });

      const { sub, iat, exp, email } = payload;
      if (typeof sub !== 'string' || typeof iat !== 'number' || typeof exp !== 'number') {
        return null;
      }
      if (typeof email !== 'string') {
        return null;
      }

      return {
        userId: sub,
        email,
        issuedAt: new Date(iat * 1000),
        expiresAt: new Date(exp * 1000),
      };
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        return null;
      }
      throw error;
    }
  }
}
