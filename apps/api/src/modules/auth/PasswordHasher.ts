import argon2 from 'argon2';
import { config } from '../../config.ts';

/**
 * Password hashing on argon2id, with the parameters from `config.ts`. The migration that
 * creates the first user hashes with the same ones: otherwise the very first sign-in
 * would cost a different amount of time and give itself away.
 */
const hashOptions = {
  type: argon2.argon2id,
  memoryCost: config.password.memoryCost,
  timeCost: config.password.timeCost,
  parallelism: config.password.parallelism,
} as const;

export class PasswordHasher {
  /**
   * Hash of a password that does not exist. Verifying against it for an unknown email
   * levels the response time, so brute force cannot tell "no such user" from "wrong
   * password". It is a real argon2id hash with the working parameters — a cheaper one
   * would show up in the timing.
   */
  readonly decoyHash =
    '$argon2id$v=19$m=19456,p=1,t=2$+yeFCWbaBbFtrXj9/pmEwQ$uVcqB11UO5ydN4nijwRd211WDBk7U/mtKfhO+j/hmIQ';

  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, hashOptions);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      // A corrupted hash, or one in a foreign format, means "wrong password", not a 500.
      return false;
    }
  }
}
