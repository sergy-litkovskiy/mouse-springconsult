import argon2 from 'argon2';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { config, env } from '../../src/config.ts';

/**
 * The first administrator. Login and password come from `ADMIN_BOOTSTRAP_EMAIL` and
 * `ADMIN_BOOTSTRAP_PASSWORD`: neither the password nor its hash lives in the repository.
 *
 * Hashing happens right here with the same argon2id parameters as in
 * `password-hasher.adapter.ts` — otherwise the first sign-in would cost differently and
 * give itself away through the response time.
 *
 * `down` removes exactly this user, by email.
 */
export class CreateFirstUser1787738400000 implements MigrationInterface {
  name = 'CreateFirstUser1787738400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const password = env.ADMIN_BOOTSTRAP_PASSWORD;
    if (password === undefined) {
      throw new Error(
        'ADMIN_BOOTSTRAP_PASSWORD is required to create the first user. ' +
          'Set it in .env (openssl rand -base64 24) and run migrations again.',
      );
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: config.password.memoryCost,
      timeCost: config.password.timeCost,
      parallelism: config.password.parallelism,
    });

    await queryRunner.query(
      `insert into "users" ("email", "display_name", "password_hash")
       values ($1, $2, $3)
       on conflict ("email") do nothing`,
      [env.ADMIN_BOOTSTRAP_EMAIL, env.ADMIN_BOOTSTRAP_NAME, passwordHash],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from "users" where "email" = $1`, [env.ADMIN_BOOTSTRAP_EMAIL]);
  }
}
