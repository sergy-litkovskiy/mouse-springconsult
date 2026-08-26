import argon2 from 'argon2';
import { config } from '../../config.ts';
import type { PasswordHasher } from './auth.port.ts';

/**
 * Implementation of the `PasswordHasher` port on argon2id.
 *
 * `decoyHash` is a real argon2id hash of a random string. It exists so that verifying a
 * password for a non-existent email costs the same as for an existing one; the parameters
 * match the working ones, otherwise the difference would show up in the timing.
 */
const DECOY_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$+yeFCWbaBbFtrXj9/pmEwQ$uVcqB11UO5ydN4nijwRd211WDBk7U/mtKfhO+j/hmIQ';

const hashOptions = {
  type: argon2.argon2id,
  memoryCost: config.password.memoryCost,
  timeCost: config.password.timeCost,
  parallelism: config.password.parallelism,
} as const;

export function createPasswordHasher(): PasswordHasher {
  return {
    decoyHash: DECOY_HASH,

    async hash(plainPassword: string): Promise<string> {
      return argon2.hash(plainPassword, hashOptions);
    },

    async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
      try {
        return await argon2.verify(passwordHash, plainPassword);
      } catch {
        // A corrupted hash, or one in a foreign format, means "wrong password", not a 500.
        return false;
      }
    },
  };
}
