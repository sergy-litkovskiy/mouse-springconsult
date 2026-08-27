import { NgOptimizedImage } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
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
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { apiErrorCodes } from '@contracts/error-codes';
import type {
  Product,
  ProductImage,
  ProductList,
  ProductListQuery,
} from '@contracts/products.contract';
import {
  productConstraints,
  productPagination,
  productSortDefaults,
  productSortDirections,
  productSortFields,
  type ProductCondition,
  type ProductSortDirection,
  type ProductSortField,
} from '@contracts/products-limits';
import { apiErrorMessage } from '../api-error-message';
import { ProductGalleryDialog, type ProductGalleryData } from './product-gallery-dialog';
import { ProductsApi } from './products-api';

/**
 * Product catalogue: a page of cards with filters, sorting and pagination.
 *
 * The state of the table is the URL. Every control writes into the address bar, the inputs
 * below are filled back from it by the router (`withComponentInputBinding`), and the request
 * follows the inputs. That is what makes F5, a link sent to the second admin and the Back
 * button behave the way the admin expects — a component signal does none of the three.
 *
 * Filters are applied by a button rather than on every keystroke: the catalogue is read
 * by one or two admins, and a debounce would only add a delay nobody asked for.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.validationFailed]: 'Перевірте значення у фільтрах.',
  [apiErrorCodes.tooManyRequests]: 'Забагато запитів. Спробуйте за хвилину.',
};

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

/**
 * A query parameter is whatever the address bar happens to hold, and the address bar is
 * typed by hand as often as it is written by the paginator. Anything the contract does not
 * accept falls back to the default here rather than travelling to the server to be refused.
 */
function toPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : productPagination.defaultPage;
}

function toPageSize(value: string | undefined): number {
  const size = Number(value);
  return Number.isInteger(size) && size > 0 && size <= productPagination.maxPageSize
    ? size
    : productPagination.defaultPageSize;
}

function isSortField(value: string | undefined): value is ProductSortField {
  return value !== undefined && (productSortFields as readonly string[]).includes(value);
}

function isSortDirection(value: string | undefined): value is ProductSortDirection {
  return value !== undefined && (productSortDirections as readonly string[]).includes(value);
}

function toSortField(value: string | undefined): ProductSortField {
  return isSortField(value) ? value : productSortDefaults.field;
}

function toSortDirection(value: string | undefined): ProductSortDirection {
  return isSortDirection(value) ? value : productSortDefaults.direction;
}

function toTextFilter(value: string | undefined): string | undefined {
  const cleaned = value?.trim() ?? '';
  return cleaned === '' ? undefined : cleaned;
}

/**
 * The bound as the contract wants it: a decimal string, unchanged all the way to the ORDER BY.
 * `productConstraints.pricePattern` is the same expression the backend validates with, applied
 * here so that "1000.555" is dropped by the page that produced it instead of coming back as a
 * generic `validation_failed` that names no field.
 */
function toPriceFilter(value: string | undefined): string | undefined {
  const cleaned = value?.trim() ?? '';
  return productConstraints.pricePattern.test(cleaned) ? cleaned : undefined;
}

function toPublishedFilter(value: string | undefined): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  return value === 'false' ? false : undefined;
}

/** An empty field is not a filter, and `null` is how the router is told to drop a parameter. */
function asParam(value: string): string | null {
  const cleaned = value.trim();
  return cleaned === '' ? null : cleaned;
}

function priceBound(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  return value === '' || productConstraints.pricePattern.test(value) ? null : { price: true };
}

/**
 * Comparing two bounds is not converting them: the strings are what travel to the API, and
 * `Number` is used here the way `Intl.NumberFormat` is used below the table — to read a value,
 * never to store or send one.
 */
function priceRange(group: AbstractControl): ValidationErrors | null {
  const min = (group.get('priceMin')?.value as string | undefined)?.trim() ?? '';
  const max = (group.get('priceMax')?.value as string | undefined)?.trim() ?? '';
  const bothValid =
    productConstraints.pricePattern.test(min) && productConstraints.pricePattern.test(max);
  if (!bothValid) {
    return null;
  }
  return Number(min) <= Number(max) ? null : { priceRange: true };
}

@Component({
  selector: 'app-product-catalog',
  imports: [
    NgOptimizedImage,
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  readonly page = input<number, string | undefined>(productPagination.defaultPage, {
    transform: toPage,
  });
  readonly pageSize = input<number, string | undefined>(productPagination.defaultPageSize, {
    transform: toPageSize,
  });
  readonly sort = input<ProductSortField, string | undefined>(productSortDefaults.field, {
    transform: toSortField,
  });
  readonly direction = input<ProductSortDirection, string | undefined>(
    productSortDefaults.direction,
    { transform: toSortDirection },
  );
  readonly title = input<string | undefined, string | undefined>(undefined, {
    transform: toTextFilter,
  });
  readonly description = input<string | undefined, string | undefined>(undefined, {
    transform: toTextFilter,
  });
  readonly priceMin = input<string | undefined, string | undefined>(undefined, {
    transform: toPriceFilter,
  });
  readonly priceMax = input<string | undefined, string | undefined>(undefined, {
    transform: toPriceFilter,
  });
  readonly category = input<string | undefined, string | undefined>(undefined, {
    transform: toTextFilter,
  });
  readonly published = input<boolean | undefined, string | undefined>(undefined, {
    transform: toPublishedFilter,
  });
  readonly accountProm = input<string | undefined, string | undefined>(undefined, {
    transform: toTextFilter,
  });
  readonly accountOlx = input<string | undefined, string | undefined>(undefined, {
    transform: toTextFilter,
  });

  /**
   * Every field is listed, so a filter added to the contract fails to compile here until it is
   * bound — the one place in this file where forgetting would be silent otherwise.
   */
  private readonly query = computed<ProductListQuery>(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort(),
    direction: this.direction(),
    title: this.title(),
    description: this.description(),
    priceMin: this.priceMin(),
    priceMax: this.priceMax(),
    category: this.category(),
    published: this.published(),
    accountProm: this.accountProm(),
    accountOlx: this.accountOlx(),
  }));

  private readonly catalogue = httpResource<ProductList>(() => this.api.listRequest(this.query()));

  protected readonly products = computed<readonly Product[]>(() =>
    this.catalogue.hasValue() ? this.catalogue.value().items : [],
  );
  protected readonly total = computed(() =>
    this.catalogue.hasValue() ? this.catalogue.value().total : 0,
  );
  protected readonly loading = this.catalogue.isLoading;
  protected readonly loadError = computed(() => {
    const error = this.catalogue.error();
    return error === undefined
      ? null
      : apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE);
  });

  protected readonly pageIndex = computed(() => this.page() - 1);
  protected readonly pageSizeOptions = [10, 20, productPagination.maxPageSize];
  protected readonly titleMaxLength = productConstraints.titleMaxLength;
  protected readonly categoryMaxLength = productConstraints.categoryMaxLength;
  protected readonly accountMaxLength = productConstraints.accountMaxLength;
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

  /**
   * The price bounds are text, not `type="number"`: a number input hands Angular a `number`,
   * and a price that has been through a float is no longer the value the admin typed. The
   * limits on the text fields are the contract's own, imported rather than restated.
   */
  protected readonly filters = this.formBuilder.nonNullable.group(
    {
      title: ['', [Validators.maxLength(productConstraints.titleMaxLength)]],
      description: ['', [Validators.maxLength(productConstraints.titleMaxLength)]],
      priceMin: ['', [priceBound]],
      priceMax: ['', [priceBound]],
      category: ['', [Validators.maxLength(productConstraints.categoryMaxLength)]],
      // '' means "not asked about", which is not the same as "unpublished".
      published: this.formBuilder.nonNullable.control<'' | 'true' | 'false'>(''),
      accountProm: ['', [Validators.maxLength(productConstraints.accountMaxLength)]],
      accountOlx: ['', [Validators.maxLength(productConstraints.accountMaxLength)]],
    },
    // The bounds are wrong as a pair, not one at a time, so the rule belongs to the group.
    { validators: [priceRange] },
  );

  /**
   * A reactive form is not a signal, and zoneless change detection does not watch one. The
   * per-field messages are `mat-form-field`'s own business; this one belongs to the group,
   * so the template reads it as a signal instead of as a method call on the form.
   */
  protected readonly priceRangeInvalid = toSignal(
    this.filters.events.pipe(map(() => this.filters.hasError('priceRange'))),
    { initialValue: false },
  );

  constructor() {
    // The form shows what the URL is asking for: after a reload, or a Back out of a filtered
    // page, the fields have to agree with the rows underneath them.
    effect(() => {
      const query = this.query();
      this.filters.setValue(
        {
          title: query.title ?? '',
          description: query.description ?? '',
          priceMin: query.priceMin ?? '',
          priceMax: query.priceMax ?? '',
          category: query.category ?? '',
          published: publishedControlValue(query.published),
          accountProm: query.accountProm ?? '',
          accountOlx: query.accountOlx ?? '',
        },
        { emitEvent: false },
      );
    });
  }

  protected applyFilters(): void {
    if (this.filters.invalid) {
      this.filters.markAllAsTouched();
      return;
    }

    const value = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        // A new filter set means a new result set, so the paginator starts over.
        page: null,
        title: asParam(value.title),
        description: asParam(value.description),
        priceMin: asParam(value.priceMin),
        priceMax: asParam(value.priceMax),
        category: asParam(value.category),
        published: value.published === '' ? null : value.published,
        accountProm: asParam(value.accountProm),
        accountOlx: asParam(value.accountOlx),
      },
    });
  }

  protected resetFilters(): void {
    this.filters.reset();
    this.applyFilters();
  }

  protected changePage(event: PageEvent): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { page: event.pageIndex + 1, pageSize: event.pageSize },
    });
  }

  /**
   * `event.active` is a plain string — the id of whichever header was clicked. Checking it
   * against the contract's list is what keeps a `mat-sort-header` added to a column the API
   * cannot sort by from turning into a request the server refuses.
   */
  protected changeSort(event: Sort): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        sort: toSortField(event.active),
        direction: toSortDirection(event.direction),
        page: null,
      },
    });
  }

  protected retry(): void {
    this.catalogue.reload();
  }

  protected mainImage(product: Product): ProductImage | null {
    return product.images.find((image) => image.isMain) ?? product.images[0] ?? null;
  }

  /** Display only: the decimal string keeps its exact value, Intl decides how it looks. */
  protected formatPrice(price: string): string {
    return priceFormat.format(Number(price));
  }

  protected conditionLabel(condition: ProductCondition): string {
    return CONDITION_LABELS[condition];
  }

  protected openGallery(product: Product): void {
    const data: ProductGalleryData = { title: product.titleProm, images: product.images };
    this.dialog.open(ProductGalleryDialog, { data, width: 'min(92vw, 60rem)' });
  }
}

function publishedControlValue(published: boolean | undefined): '' | 'true' | 'false' {
  if (published === undefined) {
    return '';
  }
  return published ? 'true' : 'false';
}
