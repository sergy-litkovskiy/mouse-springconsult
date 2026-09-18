import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The ids a card carries on each marketplace. Both are null until the card is known there, and a
 * unique index lets any number of nulls through — it is what makes a repeated Prom import find the
 * card it created last time instead of creating a second one.
 */
export class AddProductMarketplaceIds1789712541026 implements MigrationInterface {
  name = 'AddProductMarketplaceIds1789712541026';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table "products"
        add column "prom_id" varchar(32) null,
        add column "olx_id"  varchar(32) null
    `);
    await queryRunner.query(`create unique index "products_prom_id_key" on "products" ("prom_id")`);
    await queryRunner.query(`create unique index "products_olx_id_key" on "products" ("olx_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table "products"
        drop column "olx_id",
        drop column "prom_id"
    `);
  }
}
