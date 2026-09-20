import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotency exists against paying twice for the same result: a double click, or a repeat while
 * the run is still going or has already succeeded. A run that ended `failed` has no result, so it
 * guards nothing — and under the full UNIQUE of T26 it held its key forever, which made a repeat of
 * the same input impossible until the person changed a photo, a title or a text. That contradicts
 * AC-10, where a repeat is the person's own action.
 *
 * The invariant stays in the database rather than in the repository: two starts of the same input
 * at once both miss any lookup, and only an index settles which of them creates the run.
 */
export class AllowRetryAfterFailedRun1789914341173 implements MigrationInterface {
  name = 'AllowRetryAfterFailedRun1789914341173';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "product_preparation_runs_idempotency_key_key"`);
    await queryRunner.query(`
      create unique index "product_preparation_runs_idempotency_key_key"
        on "product_preparation_runs" ("idempotency_key")
        where "status" <> 'failed'
    `);
  }

  /**
   * The full UNIQUE cannot come back while two runs of one key exist, and they legitimately do
   * after this migration — a failed run plus the repeat of it. Postgres refuses the index and the
   * revert stops there, which is the honest outcome: the rows are real work, and choosing which of
   * them to discard is not a migration's call.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "product_preparation_runs_idempotency_key_key"`);
    await queryRunner.query(
      `create unique index "product_preparation_runs_idempotency_key_key" on "product_preparation_runs" ("idempotency_key")`,
    );
  }
}
