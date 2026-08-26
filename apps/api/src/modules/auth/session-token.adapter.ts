import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { IssueTokenInput, IssuedToken, SessionClaims, SessionTokens } from './auth.port.ts';

/**
 * Implementation of the `SessionTokens` port on JWT (jose, HS256).
 *
 * The token travels in an httpOnly cookie rather than localStorage: the SPA and the API
 * live on one domain behind Caddy, so cross-origin headers are unnecessary and XSS has
 * nowhere to read it from. See ADR 0002.
 */
export type SessionTokenAdapterConfig = {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly algorithm: string;
};

export function createSessionTokens(config: SessionTokenAdapterConfig): SessionTokens {
  const key = new TextEncoder().encode(config.secret);

  return {
    async issue(input: IssueTokenInput): Promise<IssuedToken> {
      const issuedAtSeconds = Math.floor(input.now.getTime() / 1000);
      const expiresAtSeconds = issuedAtSeconds + input.ttlSeconds;

      const token = await new SignJWT({ email: input.email })
        .setProtectedHeader({ alg: config.algorithm })
        .setSubject(input.userId)
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt(issuedAtSeconds)
        .setExpirationTime(expiresAtSeconds)
        .sign(key);

      return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
    },

    async verify(token: string): Promise<SessionClaims | null> {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: config.issuer,
          audience: config.audience,
          algorithms: [config.algorithm],
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
    },
  };
}
