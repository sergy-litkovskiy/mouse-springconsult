import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A card has to exist before its first frame — the R2 key is `products/{id}/…` — while the form
 * keeps every field disabled until that frame arrives (AC-20). So the three columns that had no
 * default could never be filled at creation time.
 *
 * `down` only drops the defaults: cards created empty in the meantime still satisfy `not null`.
 */
export class DefaultEmptyProductCardFields1789651109349 implements MigrationInterface {
  name = 'DefaultEmptyProductCardFields1789651109349';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table "products"
        alter column "title_prom" set default '',
        alter column "title_olx"  set default '',
        alter column "category"   set default ''
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table "products"
        alter column "title_prom" drop default,
        alter column "title_olx"  drop default,
        alter column "category"   drop default
    `);
  }
}
