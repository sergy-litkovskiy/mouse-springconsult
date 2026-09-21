import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `error_code` says which of two outcomes a failed run had, and that is all the person needs in
 * the card dialog. The catalogue lists failures after the fact (T50), and there "the preparation
 * failed" without the reason — a refused region, a timeout, a malformed answer — leaves nothing to
 * act on. The reason is the English message of the error that closed the run; the Ukrainian text
 * is still composed by the frontend from `error_code`.
 *
 * Nullable with no backfill: the runs that failed before this column have no message anywhere —
 * the worker only logged it.
 */
export class AddPreparationRunErrorDetail1790004050193 implements MigrationInterface {
  name = 'AddPreparationRunErrorDetail1790004050193';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `alter table "product_preparation_runs" add column "error_detail" text null`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table "product_preparation_runs" drop column "error_detail"`);
  }
}
