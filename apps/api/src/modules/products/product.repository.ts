import { In, type DataSource, type SelectQueryBuilder } from 'typeorm';
import type { ProductSortField } from '../../contracts/products-limits.ts';
import type { Product, ProductImage, ProductPage } from './product.ts';
import { numericFromKopiykas, ProductEntity, type ProductRow } from './product.entity.ts';
import { ProductImageEntity, type ProductImageRow } from './product-image.entity.ts';
import type { ProductFilters, ProductListCriteria, ProductRepository } from './products.port.ts';

/**
 * Implementation of the `ProductRepository` port on TypeORM — the only place in the
 * module where the ORM is mentioned. Instantiated by the composition root alone.
 */

/** A closed map instead of interpolation: the value goes straight into an ORDER BY. */
const SORT_COLUMNS: Readonly<Record<ProductSortField, string>> = {
  titleProm: 'product.titleProm',
  titleOlx: 'product.titleOlx',
  price: 'product.priceCents',
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

function applyFilters(query: SelectQueryBuilder<ProductRow>, filters: ProductFilters): void {
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
  if (filters.priceMinCents !== undefined) {
    query.andWhere('product.priceCents >= :priceMin', {
      priceMin: numericFromKopiykas(filters.priceMinCents),
    });
  }
  if (filters.priceMaxCents !== undefined) {
    query.andWhere('product.priceCents <= :priceMax', {
      priceMax: numericFromKopiykas(filters.priceMaxCents),
    });
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

function toDomainImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    r2Key: row.r2Key,
    url: row.url,
    position: row.position,
    isMain: row.isMain,
  };
}

export function createProductRepository(dataSource: DataSource): ProductRepository {
  const products = dataSource.getRepository(ProductEntity);
  const images = dataSource.getRepository(ProductImageEntity);

  async function galleriesOf(productIds: readonly string[]): Promise<Map<string, ProductImage[]>> {
    const grouped = new Map<string, ProductImage[]>();
    if (productIds.length === 0) {
      return grouped;
    }

    const rows = await images.find({
      where: { productId: In([...productIds]) },
      order: { position: 'ASC' },
    });

    for (const row of rows) {
      const gallery = grouped.get(row.productId);
      if (gallery === undefined) {
        grouped.set(row.productId, [toDomainImage(row)]);
      } else {
        gallery.push(toDomainImage(row));
      }
    }
    return grouped;
  }

  return {
    async list(criteria: ProductListCriteria): Promise<ProductPage> {
      const query = products.createQueryBuilder('product');
      applyFilters(query, criteria.filters);

      const [rows, total] = await query
        .orderBy(SORT_COLUMNS[criteria.sort], criteria.direction === 'asc' ? 'ASC' : 'DESC')
        // A tie on the sort column would otherwise let the same card show up on two
        // pages and another one on none: LIMIT without a total order is not stable.
        .addOrderBy('product.id', 'ASC')
        .skip((criteria.page - 1) * criteria.pageSize)
        .take(criteria.pageSize)
        .getManyAndCount();

      const galleries = await galleriesOf(rows.map((row) => row.id));
      const items: Product[] = rows.map((row) => ({
        ...row,
        images: galleries.get(row.id) ?? [],
      }));

      return { items, total, page: criteria.page, pageSize: criteria.pageSize };
    },
  };
}
