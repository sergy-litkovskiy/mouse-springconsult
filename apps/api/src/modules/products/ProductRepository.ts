import { In, type DataSource, type SelectQueryBuilder } from 'typeorm';
import type { ProductSortDirection, ProductSortField } from '../../contracts/products-limits.ts';
import { Product, type ProductPage } from './Product.ts';
import { ProductImage } from './ProductImage.ts';

/**
 * Persistence of the catalogue — the only place in the module where TypeORM is mentioned.
 * Instantiated by the composition root alone.
 */

/**
 * Every filter is optional and they combine with AND. `title` and `description` are
 * substring matches over both marketplaces at once: the admin looks for a card, not for
 * a Prom field or an OLX field.
 */
export type ProductFilters = {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  /** Inclusive bounds as decimal strings; SQL compares them against the column. */
  readonly priceMin?: string | undefined;
  readonly priceMax?: string | undefined;
  readonly category?: string | undefined;
  readonly published?: boolean | undefined;
  readonly accountProm?: string | undefined;
  readonly accountOlx?: string | undefined;
};

export type ProductListCriteria = {
  /** 1-based: what the paginator shows is what the API takes. */
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ProductSortField;
  readonly direction: ProductSortDirection;
  readonly filters: ProductFilters;
};

/** A closed map instead of interpolation: the value goes straight into an ORDER BY. */
const SORT_COLUMNS: Readonly<Record<ProductSortField, string>> = {
  titleProm: 'product.titleProm',
  titleOlx: 'product.titleOlx',
  price: 'product.price',
};

/**
 * `%` and `_` inside a filter are the user's characters, not wildcards. Without escaping,
 * a search for "MX_Master" would silently match "MX-Master" as well. Postgres treats a
 * backslash as the escape character by default, so no ESCAPE clause is needed.
 */
function toLikePattern(value: string): string {
  const escaped = value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
  return `%${escaped}%`;
}

function applyFilters(query: SelectQueryBuilder<Product>, filters: ProductFilters): void {
  if (filters.title !== undefined) {
    query.andWhere('(product.titleProm ilike :title or product.titleOlx ilike :title)', {
      title: toLikePattern(filters.title),
    });
  }
  if (filters.description !== undefined) {
    query.andWhere(
      '(product.descriptionProm ilike :description or product.descriptionOlx ilike :description)',
      { description: toLikePattern(filters.description) },
    );
  }
  // The bound goes to Postgres as the decimal string it already is; comparing it with a
  // numeric column is a numeric comparison, not a textual one.
  if (filters.priceMin !== undefined) {
    query.andWhere('product.price >= :priceMin', { priceMin: filters.priceMin });
  }
  if (filters.priceMax !== undefined) {
    query.andWhere('product.price <= :priceMax', { priceMax: filters.priceMax });
  }
  if (filters.category !== undefined) {
    query.andWhere('product.category = :category', { category: filters.category });
  }
  if (filters.published !== undefined) {
    query.andWhere('product.published = :published', { published: filters.published });
  }
  if (filters.accountProm !== undefined) {
    query.andWhere('product.accountProm = :accountProm', { accountProm: filters.accountProm });
  }
  if (filters.accountOlx !== undefined) {
    query.andWhere('product.accountOlx = :accountOlx', { accountOlx: filters.accountOlx });
  }
}

export class ProductRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** One page plus the total count behind it — both come from a single query. */
  async list(criteria: ProductListCriteria): Promise<ProductPage> {
    const query = this.dataSource.getRepository(Product).createQueryBuilder('product');
    applyFilters(query, criteria.filters);

    const [products, total] = await query
      .orderBy(SORT_COLUMNS[criteria.sort], criteria.direction === 'asc' ? 'ASC' : 'DESC')
      // A tie on the sort column would otherwise let the same card show up on two
      // pages and another one on none: LIMIT without a total order is not stable.
      .addOrderBy('product.id', 'ASC')
      .skip((criteria.page - 1) * criteria.pageSize)
      .take(criteria.pageSize)
      .getManyAndCount();

    const galleries = await this.galleriesOf(products.map((product) => product.id));
    for (const product of products) {
      product.images = galleries.get(product.id) ?? [];
    }

    return { items: products, total, page: criteria.page, pageSize: criteria.pageSize };
  }

  /**
   * `getRepository` is called here rather than kept in a field: a stub subclass in a spec
   * overrides every method, so it must be constructible without a live DataSource.
   */
  private async galleriesOf(productIds: readonly string[]): Promise<Map<string, ProductImage[]>> {
    const grouped = new Map<string, ProductImage[]>();
    if (productIds.length === 0) {
      return grouped;
    }

    const images = await this.dataSource.getRepository(ProductImage).find({
      where: { productId: In([...productIds]) },
      order: { position: 'ASC' },
    });

    for (const image of images) {
      const gallery = grouped.get(image.productId);
      if (gallery === undefined) {
        grouped.set(image.productId, [image]);
      } else {
        gallery.push(image);
      }
    }
    return grouped;
  }
}
