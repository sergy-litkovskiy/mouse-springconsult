import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { apiErrorCodes } from '@contracts/error-codes';
import type { Product, ProductImage, ProductListQuery } from '@contracts/products.contract';
import {
  productPagination,
  productSortDefaults,
  type ProductCondition,
  type ProductSortField,
} from '@contracts/products-limits';
import { ProductGalleryDialog, type ProductGalleryData } from './product-gallery-dialog';
import { ProductsApi } from './products-api';

/**
 * Product catalogue: a page of cards with filters, sorting and pagination. The state of
 * the table is one signal holding the very query the API takes — every control writes
 * into it and every write is followed by exactly one request.
 *
 * Filters are applied by a button rather than on every keystroke: the catalogue is read
 * by one or two admins, and a debounce would only add a delay nobody asked for.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.validationFailed]: 'Перевірте значення у фільтрах.',
  [apiErrorCodes.tooManyRequests]: 'Забагато запитів. Спробуйте за хвилину.',
};

const NETWORK_ERROR_MESSAGE = 'Немає зв’язку із сервером. Перевірте мережу і спробуйте ще раз.';
const UNKNOWN_ERROR_MESSAGE = 'Не вдалося завантажити каталог. Спробуйте ще раз.';

const CONDITION_LABELS: Readonly<Record<ProductCondition, string>> = {
  new: 'Новий',
  used: 'Вживаний',
};

const priceFormat = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 2,
});

/** The paginator ships with English labels; the admin panel is Ukrainian throughout. */
function ukrainianPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Товарів на сторінці:';
  intl.nextPageLabel = 'Наступна сторінка';
  intl.previousPageLabel = 'Попередня сторінка';
  intl.firstPageLabel = 'Перша сторінка';
  intl.lastPageLabel = 'Остання сторінка';
  intl.getRangeLabel = (page, pageSize, length): string => {
    if (length === 0) {
      return '0 з 0';
    }
    const start = page * pageSize + 1;
    const end = Math.min(start + pageSize - 1, length);
    return `${String(start)}–${String(end)} з ${String(length)}`;
  };
  return intl;
}

/** Kopiykas in the contract, hryvnias in the form: the admin types what is on the price tag. */
function toKopiykas(hryvnias: number | null): number | undefined {
  return hryvnias === null || Number.isNaN(hryvnias) ? undefined : Math.round(hryvnias * 100);
}

function trimmed(value: string): string | undefined {
  const cleaned = value.trim();
  return cleaned === '' ? undefined : cleaned;
}

function toMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return UNKNOWN_ERROR_MESSAGE;
  }
  if (error.status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }
  const code = (error.error as { error?: { code?: string } } | null)?.error?.code;
  return (code === undefined ? undefined : ERROR_MESSAGES[code]) ?? UNKNOWN_ERROR_MESSAGE;
}

@Component({
  selector: 'app-product-catalog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: ukrainianPaginatorIntl }],
  templateUrl: './product-catalog.html',
  styleUrl: './product-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCatalog {
  private readonly api = inject(ProductsApi);
  private readonly dialog = inject(MatDialog);

  private readonly query = signal<ProductListQuery>({
    page: productPagination.defaultPage,
    pageSize: productPagination.defaultPageSize,
    sort: productSortDefaults.field,
    direction: productSortDefaults.direction,
  });

  protected readonly products = signal<readonly Product[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly pageIndex = computed(() => this.query().page - 1);
  protected readonly pageSize = computed(() => this.query().pageSize);
  protected readonly sortField = computed<ProductSortField>(() => this.query().sort);
  protected readonly sortDirection = computed(() => this.query().direction);

  protected readonly pageSizeOptions = [10, 20, productPagination.maxPageSize];
  protected readonly columns = [
    'gallery',
    'titleProm',
    'titleOlx',
    'price',
    'category',
    'condition',
    'published',
    'accountProm',
    'accountOlx',
  ];

  protected readonly filters = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    priceMin: new FormControl<number | null>(null),
    priceMax: new FormControl<number | null>(null),
    category: new FormControl('', { nonNullable: true }),
    // '' means "not asked about", which is not the same as "unpublished".
    published: new FormControl<'' | 'true' | 'false'>('', { nonNullable: true }),
    accountProm: new FormControl('', { nonNullable: true }),
    accountOlx: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    void this.load();
  }

  protected applyFilters(): void {
    const value = this.filters.getRawValue();
    const query: ProductListQuery = {
      // A new filter set means a new result set, so the paginator starts over.
      page: 1,
      pageSize: this.query().pageSize,
      sort: this.query().sort,
      direction: this.query().direction,
      ...(trimmed(value.title) === undefined ? {} : { title: trimmed(value.title) }),
      ...(trimmed(value.description) === undefined
        ? {}
        : { description: trimmed(value.description) }),
      ...(toKopiykas(value.priceMin) === undefined
        ? {}
        : { priceMinCents: toKopiykas(value.priceMin) }),
      ...(toKopiykas(value.priceMax) === undefined
        ? {}
        : { priceMaxCents: toKopiykas(value.priceMax) }),
      ...(trimmed(value.category) === undefined ? {} : { category: trimmed(value.category) }),
      ...(value.published === '' ? {} : { published: value.published === 'true' }),
      ...(trimmed(value.accountProm) === undefined
        ? {}
        : { accountProm: trimmed(value.accountProm) }),
      ...(trimmed(value.accountOlx) === undefined ? {} : { accountOlx: trimmed(value.accountOlx) }),
    };

    this.query.set(query);
    void this.load();
  }

  protected resetFilters(): void {
    this.filters.reset({
      title: '',
      description: '',
      priceMin: null,
      priceMax: null,
      category: '',
      published: '',
      accountProm: '',
      accountOlx: '',
    });
    this.applyFilters();
  }

  protected changePage(event: PageEvent): void {
    this.query.update((query) => ({
      ...query,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    }));
    void this.load();
  }

  protected changeSort(event: Sort): void {
    const field = (
      event.direction === '' ? productSortDefaults.field : event.active
    ) as ProductSortField;
    const direction = event.direction === '' ? productSortDefaults.direction : event.direction;

    this.query.update((query) => ({ ...query, sort: field, direction, page: 1 }));
    void this.load();
  }

  protected mainImage(product: Product): ProductImage | null {
    return product.images.find((image) => image.isMain) ?? product.images[0] ?? null;
  }

  protected formatPrice(cents: number): string {
    return priceFormat.format(cents / 100);
  }

  protected conditionLabel(condition: ProductCondition): string {
    return CONDITION_LABELS[condition];
  }

  protected openGallery(product: Product): void {
    const data: ProductGalleryData = { title: product.titleProm, images: product.images };
    this.dialog.open(ProductGalleryDialog, { data, width: 'min(92vw, 60rem)' });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const page = await firstValueFrom(this.api.list(this.query()));
      this.products.set(page.items);
      this.total.set(page.total);
    } catch (error: unknown) {
      this.products.set([]);
      this.total.set(0);
      this.loadError.set(toMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
