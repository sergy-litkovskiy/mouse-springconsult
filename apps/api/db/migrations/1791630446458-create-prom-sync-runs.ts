import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One row per send of a card to Prom, a retry included (ADR 0029). `products.prom_id` is written
 * only when the draft is up with every photo; until then the Prom product id lives here, so a retry
 * after a partial result continues from it instead of creating a second product.
 *
 * A partial result — photos K of N, or a product that never became a draft — ends `failed` with
 * its own `error_code`: the card did not get onto Prom as a whole, and a retry is invited exactly
 * as after a refusal. `succeeded` therefore means one thing only, N of N with `prom_id` written.
 *
 * `images_on_prom` has no ceiling at `images_total` on purpose: a repeated import may make Prom
 * duplicate photos, and a CHECK would turn that report into a crash of the worker
 * instead of a number on the card.
 *
 * `error_code` has no CHECK, like its twin on the preparation runs: only the code writes it,
 * through a union, and a CHECK would cost a migration per new code.
 */
export class CreatePromSyncRuns1791630446458 implements MigrationInterface {
  name = 'CreatePromSyncRuns1791630446458';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table "product_prom_sync_runs" (
        "id"               uuid         primary key default uuidv7(),
        "product_id"       uuid         not null references "products" ("id") on delete cascade,
        "status"           varchar(16)  not null,
        "error_code"       varchar(64)  null,
        "prom_import_id"   varchar(64)  null,
        "prom_product_id"  varchar(32)  null,
        "images_total"     integer      not null,
        "images_on_prom"   integer      null,
        "check_count"      integer      not null default 0,
        "deadline_at"      timestamptz  null,
        "created_at"       timestamptz  not null default now(),
        "started_at"       timestamptz  null,
        "finished_at"      timestamptz  null,
        constraint "product_prom_sync_runs_status_check"
          check ("status" in ('queued', 'running', 'succeeded', 'failed')),
        constraint "product_prom_sync_runs_images_total_check" check ("images_total" > 0),
        constraint "product_prom_sync_runs_images_on_prom_check" check ("images_on_prom" >= 0),
        constraint "product_prom_sync_runs_check_count_check" check ("check_count" >= 0)
      )
    `);

    // The card reads its latest send by this column, finished ones included, which the partial
    // index below does not cover.
    await queryRunner.query(
      `create index "product_prom_sync_runs_product_id_idx" on "product_prom_sync_runs" ("product_id")`,
    );

    // A second tab must not start a second send while one is going. Two starts at once both
    // miss any lookup; only the index settles which of them creates the run.
    await queryRunner.query(`
      create unique index "product_prom_sync_runs_active_key"
        on "product_prom_sync_runs" ("product_id")
        where "status" in ('queued', 'running')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "product_prom_sync_runs"`);
  }
}
