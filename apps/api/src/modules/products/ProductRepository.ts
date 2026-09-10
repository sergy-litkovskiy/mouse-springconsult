import { In, type DataSource, type SelectQueryBuilder } from 'typeorm';
import type { ProductSortDirection, ProductSortField } from '../../contracts/products-limits.ts';
import { Product, type ProductPage } from './Product.ts';
import { ProductImage } from './ProductImage.ts';

/**
 * Filters combine with AND. `title` and `description` are substring matches over both
 * marketplaces at once: the admin looks for a card, not for a Prom field or an OLX field.
 */
export type ProductFilters = {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  /** Inclusive bounds as decimal strings; SQL compares them against the column. */
  readonly priceMin?: string | undefined;
  readonly priceMax?: string | undefined;
  readonly category?: string | undefined;
  readonly publishedProm?: boolean | undefined;
  readonly publishedOlx?: boolean | undefined;
};

/** `id` comes from `uuidv7()` in the database and the timestamps from TypeORM — none of the three is a caller's to set. */
type ProductWritable = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'images'>;

/**
 * Only `title_prom`, `title_olx` and `category` have no column default, and that is what
 * lets a card exist before its texts, price and frames do — the R2 key of a frame is
 * `products/{id}/…`, so the id has to come first.
 */
export type ProductDraft = Pick<ProductWritable, 'titleProm' | 'titleOlx' | 'category'> &
  Partial<ProductWritable>;

export type ProductChanges = Partial<ProductWritable>;

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
  if (filters.publishedProm !== undefined) {
    query.andWhere('product.publishedProm = :publishedProm', {
      publishedProm: filters.publishedProm,
    });
  }
  if (filters.publishedOlx !== undefined) {
    query.andWhere('product.publishedOlx = :publishedOlx', { publishedOlx: filters.publishedOlx });
  }
}

export class ProductRepository {
  constructor(private readonly dataSource: DataSource) {}

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

  async findById(id: string): Promise<Product | null> {
    const product = await this.dataSource.getRepository(Product).findOneBy({ id });
    if (product === null) {
      return null;
    }

    product.images = (await this.galleriesOf([id])).get(id) ?? [];
    return product;
  }

  /**
   * The row is read back instead of being returned from the insert: an empty card is mostly
   * column defaults, and decimal(12,2) rounds the price itself — reading it back is what
   * makes both visible to the caller.
   */
  async create(draft: ProductDraft): Promise<Product> {
    const repository = this.dataSource.getRepository(Product);
    const { id } = await repository.save(repository.create(draft));

    const created = await this.findById(id);
    if (created === null) {
      throw new Error(`card ${id} disappeared between its insert and the read after it`);
    }
    return created;
  }

  /**
   * Null means there is no such card — whether that is an error is the service's question,
   * not this layer's.
   */
  async update(id: string, changes: ProductChanges): Promise<Product | null> {
    // An empty set is not an error: the caller changed nothing and the card comes back as it is.
    if (Object.keys(changes).length > 0) {
      const result = await this.dataSource.getRepository(Product).update({ id }, changes);
      if (result.affected === 0) {
        return null;
      }
    }

    return this.findById(id);
  }

  /**
   * The frames go with the card: `product_images.product_id` is declared `on delete cascade`.
   * Objects in R2 are another matter and another layer — see T17.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.dataSource.getRepository(Product).delete({ id });
    return (result.affected ?? 0) > 0;
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
