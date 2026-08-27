import type {
  ProductImage as ProductImageResponse,
  ProductList as ProductListResponse,
  Product as ProductResponse,
} from '../../contracts/products.contract.ts';
import type { ProductCondition } from '../../contracts/products-limits.ts';

/**
 * Domain model of a product card. No I/O: no pg, no typeorm, no fastify.
 * The ORM mapping lives next door in `*.entity.ts` and stays invisible from here.
 *
 * Prom and OLX get separate title and description fields rather than one shared text:
 * the marketplaces differ in length limits and in tone, and a card is prepared for both
 * at once. `condition` is what the marketplaces call the state of the item — `published`
 * answers a different question and the two never collapse into one flag.
 */
export type ProductImage = {
  readonly id: string;
  /** Object key in R2; the bucket itself arrives with the media module. */
  readonly r2Key: string;
  readonly url: string;
  readonly position: number;
  readonly isMain: boolean;
};

export type Product = {
  readonly id: string;
  readonly titleProm: string;
  readonly descriptionProm: string;
  readonly titleOlx: string;
  readonly descriptionOlx: string;
  /** Whole kopiykas. numeric(12,2) is the storage form, never the arithmetic one. */
  readonly priceCents: number;
  readonly seoKeywords: readonly string[];
  readonly category: string;
  readonly published: boolean;
  readonly accountProm: string | null;
  readonly accountOlx: string | null;
  readonly condition: ProductCondition;
  readonly images: readonly ProductImage[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** One page of the catalogue: the rows plus how many there are in total behind them. */
export type ProductPage = {
  readonly items: readonly Product[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

function toImageResponse(image: ProductImage): ProductImageResponse {
  return {
    id: image.id,
    r2Key: image.r2Key,
    url: image.url,
    position: image.position,
    isMain: image.isMain,
  };
}

/** The API form of a card: dates as ISO 8601, gallery ordered by position. */
export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    titleProm: product.titleProm,
    descriptionProm: product.descriptionProm,
    titleOlx: product.titleOlx,
    descriptionOlx: product.descriptionOlx,
    priceCents: product.priceCents,
    seoKeywords: [...product.seoKeywords],
    category: product.category,
    published: product.published,
    accountProm: product.accountProm,
    accountOlx: product.accountOlx,
    condition: product.condition,
    images: [...product.images]
      .sort((left, right) => left.position - right.position)
      .map(toImageResponse),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function toProductListResponse(page: ProductPage): ProductListResponse {
  return {
    items: page.items.map(toProductResponse),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}
