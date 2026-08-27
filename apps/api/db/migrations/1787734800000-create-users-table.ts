import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Users of the admin panel.
 *
 * `email` is stored lowercase, and a CHECK guarantees it rather than a convention: a
 * unique index over the raw value would otherwise let `Admin@` sit next to `admin@`.
 *
 * `tokens_valid_from` is the validity boundary of session tokens. Logout moves it to
 * "now", and every JWT issued so far stops being accepted — with no revocation table.
 */
export class CreateUsersTable1787734800000 implements MigrationInterface {
  name = 'CreateUsersTable1787734800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table "users" (
        "id"                uuid         primary key default gen_random_uuid(),
        "email"             varchar(320) not null,
        "display_name"      varchar(120) not null,
        "password_hash"     text         not null,
        "is_active"         boolean      not null default true,
        "tokens_valid_from" timestamptz  not null default now(),
        "last_login_at"     timestamptz,
        "created_at"        timestamptz  not null default now(),
        "updated_at"        timestamptz  not null default now(),
        constraint "users_email_lowercase_check" check ("email" = lower("email"))
      )
    `);

    await queryRunner.query(`create unique index "users_email_key" on "users" ("email")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "users_email_key"`);
    await queryRunner.query(`drop table if exists "users"`);
  }
}
