import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The address of a frame follows from its key and the bucket's public domain, so storing it
 * meant rewriting every row the day the bucket moves (ADR 0007). The controller composes it from
 * `R2_PUBLIC_BASE_URL` on every read instead.
 *
 * `down` cannot recover the addresses that were dropped, only the column's shape: the empty
 * default exists so the column can come back `not null` over rows that already exist, and it is
 * removed right after, as the original column had none.
 */
export class DropProductImageUrl1789642335874 implements MigrationInterface {
  name = 'DropProductImageUrl1789642335874';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`alter table "product_images" drop column "url"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `alter table "product_images" add column "url" text not null default ''`,
    );
    await queryRunner.query(`alter table "product_images" alter column "url" drop default`);
  }
}
