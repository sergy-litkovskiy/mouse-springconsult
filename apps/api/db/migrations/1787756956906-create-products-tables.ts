import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Title, description and publication are doubled per marketplace because the card is one and
 * the marketplaces are two: they differ in length limits and in tone, and a listing goes up on
 * Prom and comes down from OLX on days of their own. Every state the glossary names — draft,
 * published-prom, published-olx — is a pair of these booleans.
 *
 * `uuidv7()` rather than a random v4: a card needs its id before its row exists — an R2 key is
 * `products/{id}/…`, written while the upload is still in flight — and v7 keeps that while
 * ordering ids by time, so inserts append to the end of the index instead of landing all over it.
 *
 * `numeric(12,2)` is the same type as `decimal(12,2)`, and it is the only thing that rounds a
 * price: the code carries the decimal string the driver returns and converts it nowhere.
 *
 * There are no secondary indexes on `products` on purpose. At 50–100 cards a month a sequential
 * scan over a few thousand rows is cheaper than indexes to maintain, and the substring filters
 * use `ilike '%…%'`, which no B-tree can serve anyway — that would take pg_trgm.
 */
export class CreateProductsTables1787756956906 implements MigrationInterface {
  name = 'CreateProductsTables1787756956906';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table "products" (
        "id"                uuid          primary key default uuidv7(),
        "title_prom"        varchar(200)  not null,
        "description_prom"  text          not null default '',
        "title_olx"         varchar(200)  not null,
        "description_olx"   text          not null default '',
        "price"             numeric(12,2) not null default 0,
        "seo_keywords"      text[]        not null default '{}',
        "category"          varchar(120)  not null,
        "published_prom"    boolean       not null default false,
        "published_olx"     boolean       not null default false,
        "condition"         varchar(8)    not null default 'used',
        "created_at"        timestamptz   not null default now(),
        "updated_at"        timestamptz   not null default now(),
        constraint "products_condition_check" check ("condition" in ('new', 'used')),
        constraint "products_price_non_negative_check" check ("price" >= 0)
      )
    `);

    /*
     * The ceiling of ten frames per gallery is not expressed here: it would take a trigger,
     * and it is enforced in `contracts/products-limits.ts` where images are added.
     */
    await queryRunner.query(`
      create table "product_images" (
        "id"          uuid    primary key default uuidv7(),
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
