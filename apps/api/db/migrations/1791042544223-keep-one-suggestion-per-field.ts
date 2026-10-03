import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A suggestion is no longer accepted or rejected (ADR 0017): the person copies it into the form,
 * and the next generation of the field replaces it. One row per card and field is then all there
 * is, so `product_id` moves onto the row — the run that wrote it changes with every generation, and
 * uniqueness has to hold across runs.
 *
 * Idempotency narrows to the runs that are still going. A repeat of a finished input is the person
 * asking for another generation (AC-82), and it pays again; a double click while the run is queued
 * or running still finds that run.
 */
export class KeepOneSuggestionPerField1791042544223 implements MigrationInterface {
  name = 'KeepOneSuggestionPerField1791042544223';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `alter table "product_field_suggestions" add column "product_id" uuid null`,
    );
    await queryRunner.query(`
      update "product_field_suggestions" "suggestion"
         set "product_id" = "run"."product_id"
        from "product_preparation_runs" "run"
       where "run"."id" = "suggestion"."run_id"
    `);
    await queryRunner.query(
      `alter table "product_field_suggestions" alter column "product_id" set not null`,
    );
    await queryRunner.query(`
      alter table "product_field_suggestions"
        add constraint "product_field_suggestions_product_id_fkey"
        foreign key ("product_id") references "products" ("id") on delete cascade
    `);

    await queryRunner.query(`
      delete from "product_field_suggestions"
       where "id" in (
         select "id"
           from (
             select "id",
                    row_number() over (
                      partition by "product_id", "field"
                      order by "created_at" desc, "id" desc
                    ) as "rank"
               from "product_field_suggestions"
           ) "ranked"
          where "rank" > 1
       )
    `);

    await queryRunner.query(
      `alter table "product_field_suggestions" drop constraint "product_field_suggestions_resolution_check"`,
    );
    await queryRunner.query(`alter table "product_field_suggestions" drop column "resolution"`);
    await queryRunner.query(`alter table "product_field_suggestions" drop column "resolved_at"`);

    await queryRunner.query(`drop index "product_field_suggestions_run_field_key"`);
    await queryRunner.query(
      `create unique index "product_field_suggestions_product_field_key" on "product_field_suggestions" ("product_id", "field")`,
    );

    await queryRunner.query(`drop index "product_preparation_runs_idempotency_key_key"`);
    await queryRunner.query(`
      create unique index "product_preparation_runs_idempotency_key_key"
        on "product_preparation_runs" ("idempotency_key")
        where "status" in ('queued', 'running')
    `);
  }

  /**
   * The deleted history does not come back: there is nowhere to take it from. And after `up` two
   * succeeded runs of one key are normal, which the old predicate refuses — so every older
   * duplicate gets its id appended to the key first. A finished run's key guards nothing, while
   * its status and usage stay as they were.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index "product_preparation_runs_idempotency_key_key"`);
    await queryRunner.query(`
      update "product_preparation_runs" "run"
         set "idempotency_key" = "run"."idempotency_key" || '#' || "run"."id"
        from (
          select "id",
                 row_number() over (
                   partition by "idempotency_key"
                   order by "created_at" desc, "id" desc
                 ) as "rank"
            from "product_preparation_runs"
           where "status" <> 'failed'
        ) "ranked"
       where "ranked"."id" = "run"."id"
         and "ranked"."rank" > 1
    `);
    await queryRunner.query(`
      create unique index "product_preparation_runs_idempotency_key_key"
        on "product_preparation_runs" ("idempotency_key")
        where "status" <> 'failed'
    `);

    await queryRunner.query(`drop index "product_field_suggestions_product_field_key"`);
    await queryRunner.query(
      `create unique index "product_field_suggestions_run_field_key" on "product_field_suggestions" ("run_id", "field")`,
    );

    await queryRunner.query(
      `alter table "product_field_suggestions" add column "resolution" varchar(16) null`,
    );
    await queryRunner.query(
      `alter table "product_field_suggestions" add column "resolved_at" timestamptz null`,
    );
    await queryRunner.query(`
      alter table "product_field_suggestions"
        add constraint "product_field_suggestions_resolution_check"
        check ("resolution" in ('accepted', 'rejected'))
    `);

    await queryRunner.query(`alter table "product_field_suggestions" drop column "product_id"`);
  }
}
