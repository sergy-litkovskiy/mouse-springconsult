import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product cards and their galleries.
 *
 * Prom and OLX get their own title and description columns: the marketplaces differ in
 * length limits and in tone, and a card is prepared for both in one pass. `condition` is
 * the state of the item as the marketplaces name it — `published` answers a different
 * question, so the two never collapse into one column.
 *
 * The price is `numeric(12,2)`; the code counts in whole kopiykas and converts at the ORM
 * boundary. Money never becomes a float.
 *
 * There are no secondary indexes on `products` on purpose. At 50–100 cards a month a
 * sequential scan over a few thousand rows is cheaper than indexes to maintain, and the
 * substring filters use `ilike '%…%'`, which no B-tree can serve anyway — that would take
 * pg_trgm, and it is not worth an extension yet.
 */
export class CreateProductsTables1787756956906 implements MigrationInterface {
  name = 'CreateProductsTables1787756956906';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table "products" (
        "id"                uuid          primary key default gen_random_uuid(),
        "title_prom"        varchar(200)  not null,
        "description_prom"  text          not null default '',
        "title_olx"         varchar(200)  not null,
        "description_olx"   text          not null default '',
        "price"             numeric(12,2) not null default 0,
        "seo_keywords"      text[]        not null default '{}',
        "category"          varchar(120)  not null,
        "published"         boolean       not null default false,
        "account_prom"      varchar(120),
        "account_olx"       varchar(120),
        "condition"         varchar(8)    not null default 'used',
        "created_at"        timestamptz   not null default now(),
        "updated_at"        timestamptz   not null default now(),
        constraint "products_condition_check" check ("condition" in ('new', 'used')),
        constraint "products_price_non_negative_check" check ("price" >= 0)
      )
    `);

    /*
     * A gallery holds at most ten frames — the ceiling lives as a constant in
     * `contracts/products-limits.ts` and is enforced where images are added. Expressing
     * it here would take a trigger, and there is nothing to guard yet: uploading arrives
     * with the media module.
     */
    await queryRunner.query(`
      create table "product_images" (
        "id"          uuid    primary key default gen_random_uuid(),
        "product_id"  uuid    not null references "products" ("id") on delete cascade,
        "r2_key"      text    not null,
        "url"         text    not null,
        "position"    integer not null default 0,
        "is_main"     boolean not null default false,
        constraint "product_images_position_non_negative_check" check ("position" >= 0)
      )
    `);

    await queryRunner.query(
      `create index "product_images_product_id_idx" on "product_images" ("product_id")`,
    );

    // One object in R2 belongs to one card: a shared key would make deleting a card
    // silently break someone else's gallery.
    await queryRunner.query(
      `create unique index "product_images_r2_key_key" on "product_images" ("r2_key")`,
    );

    // Exactly one main frame per card, guaranteed by the database rather than by care.
    await queryRunner.query(
      `create unique index "product_images_main_key" on "product_images" ("product_id") where "is_main"`,
    );

    // Order within a gallery is unique, but deferred: swapping two frames passes through
    // a state where two rows share a position, and an immediate constraint would reject
    // the whole reorder.
    await queryRunner.query(`
      alter table "product_images"
        add constraint "product_images_position_key" unique ("product_id", "position")
        deferrable initially deferred
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop table if exists "product_images"`);
    await queryRunner.query(`drop table if exists "products"`);
  }
}
