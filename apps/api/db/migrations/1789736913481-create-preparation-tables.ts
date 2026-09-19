import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The model never writes into `products` (ADR 0006): whatever it returns lands here as a
 * suggestion, one row per field, and only a person moves a value into the card. That is what
 * makes a manual edit safe from the next run (AC-11) without any check at all.
 *
 * A partial failure of `scope: both` has no column of its own: the run ends `failed` with
 * `price_unavailable`, and which part is missing is read from the absence of a `price`
 * suggestion (data-model.md, Open items).
 *
 * `resolution` has no `pending`: NULL already says "not decided", and a third word would be a
 * second way to say it.
 */
export class CreatePreparationTables1789736913481 implements MigrationInterface {
  name = 'CreatePreparationTables1789736913481';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table "product_preparation_runs" (
        "id"               uuid         primary key default uuidv7(),
        "product_id"       uuid         not null references "products" ("id") on delete cascade,
        "scope"            varchar(8)   not null,
        "idempotency_key"  text         not null,
        "status"           varchar(16)  not null,
        "error_code"       varchar(64)  null,
        "model"            varchar(64)  not null,
        "input_tokens"     integer      not null default 0,
        "output_tokens"    integer      not null default 0,
        "created_at"       timestamptz  not null default now(),
        "started_at"       timestamptz  null,
        "finished_at"      timestamptz  null,
        constraint "product_preparation_runs_scope_check"
          check ("scope" in ('texts', 'price', 'both', 'field')),
        constraint "product_preparation_runs_status_check"
          check ("status" in ('queued', 'running', 'succeeded', 'failed'))
      )
    `);

    // Also the input of the run-rate limit, which counts a card's runs by `created_at`: at tens
    // of runs a month the index on the card alone is enough for that scan.
    await queryRunner.query(
      `create index "product_preparation_runs_product_id_idx" on "product_preparation_runs" ("product_id")`,
    );

    // A repeated click on an unchanged input finds the run it already paid for instead of paying
    // again: the key is card + scope + input version, computed by the server.
    await queryRunner.query(
      `create unique index "product_preparation_runs_idempotency_key_key" on "product_preparation_runs" ("idempotency_key")`,
    );

    await queryRunner.query(`
      create table "product_field_suggestions" (
        "id"           uuid         primary key default uuidv7(),
        "run_id"       uuid         not null references "product_preparation_runs" ("id") on delete cascade,
        "field"        varchar(32)  not null,
        "value"        jsonb        not null,
        "resolution"   varchar(16)  null,
        "resolved_at"  timestamptz  null,
        "created_at"   timestamptz  not null default now(),
        constraint "product_field_suggestions_field_check"
          check ("field" in ('title_prom', 'title_olx', 'description_prom', 'description_olx', 'seo_keywords', 'price')),
        constraint "product_field_suggestions_resolution_check"
          check ("resolution" in ('accepted', 'rejected'))
      )
    `);

    // `run_id` leads, so the same index serves the join from runs as well as uniqueness.
    await queryRunner.query(
      `create unique index "product_field_suggestions_run_field_key" on "product_field_suggestions" ("run_id", "field")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "product_field_suggestions"`);
    await queryRunner.query(`drop table if exists "product_preparation_runs"`);
  }
}
