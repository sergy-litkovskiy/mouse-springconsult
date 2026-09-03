import { NgOptimizedImage } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  type ProductCondition,
  type ProductSortDirection,
  type ProductSortField,
} from '@contracts/products-limits';
import { apiErrorMessage } from '../../api-error-message';
import {
  asQueryParam,
  priceBound,
  priceRange,
  publishedControlValue,
  toPage,
  toPageSize,
  toPriceFilter,
  toPublishedFilter,
  textFilter,
  toSortDirection,
  toSortField,
} from './product-catalog-query';
import { ProductGalleryDialog, type ProductGalleryData } from '../gallery/product-gallery-dialog';
import { ProductsApi } from '../products-api';
import { itemsPaginatorIntl } from './items-paginator-intl';

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
 *
 * What a filter value may be — coming from the URL and coming from the form — lives in
 * `product-catalog-query.ts`, because neither an `input()` transform nor a `ValidatorFn`
 * can be a member of this class.
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
  providers: [{ provide: MatPaginatorIntl, useFactory: itemsPaginatorIntl }],
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
    transform: textFilter(productConstraints.titleMaxLength),
  });
  readonly description = input<string | undefined, string | undefined>(undefined, {
    transform: textFilter(productConstraints.titleMaxLength),
  });
  readonly priceMin = input<string | undefined, string | undefined>(undefined, {
    transform: toPriceFilter,
  });
  readonly priceMax = input<string | undefined, string | undefined>(undefined, {
    transform: toPriceFilter,
  });
  readonly category = input<string | undefined, string | undefined>(undefined, {
    transform: textFilter(productConstraints.categoryMaxLength),
  });
  readonly publishedProm = input<boolean | undefined, string | undefined>(undefined, {
    transform: toPublishedFilter,
  });
  readonly publishedOlx = input<boolean | undefined, string | undefined>(undefined, {
    transform: toPublishedFilter,
  });

  /**
   * The seven filters on their own, apart from paging and ordering. The form mirrors these and
   * only these: a click on the paginator or a sort header is not a reason to wipe text the
   * admin has typed into a filter and not yet applied.
   */
  private readonly appliedFilters = computed(() => ({
    title: this.title(),
    description: this.description(),
    priceMin: this.priceMin(),
    priceMax: this.priceMax(),
    category: this.category(),
    publishedProm: this.publishedProm(),
    publishedOlx: this.publishedOlx(),
  }));

  /** Every field in one place: an optional filter added to the contract is visible here. */
  private readonly query = computed<ProductListQuery>(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
    sort: this.sort(),
    direction: this.direction(),
    ...this.appliedFilters(),
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
  protected readonly columns = [
    'gallery',
    'titleProm',
    'titleOlx',
    'price',
    'category',
    'condition',
    'publishedProm',
    'publishedOlx',
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
      // '' means "not asked about", which is not the same as "not published there".
      publishedProm: this.formBuilder.nonNullable.control<'' | 'true' | 'false'>(''),
      publishedOlx: this.formBuilder.nonNullable.control<'' | 'true' | 'false'>(''),
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
      const applied = this.appliedFilters();
      // The write is not silenced: `events` is what feeds `priceRangeInvalid`, so a range the
      // URL got backwards has to reach the message rather than only the validator.
      this.filters.setValue({
        title: applied.title ?? '',
        description: applied.description ?? '',
        priceMin: applied.priceMin ?? '',
        priceMax: applied.priceMax ?? '',
        category: applied.category ?? '',
        publishedProm: publishedControlValue(applied.publishedProm),
        publishedOlx: publishedControlValue(applied.publishedOlx),
      });
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
        title: asQueryParam(value.title),
        description: asQueryParam(value.description),
        priceMin: asQueryParam(value.priceMin),
        priceMax: asQueryParam(value.priceMax),
        category: asQueryParam(value.category),
        publishedProm: value.publishedProm === '' ? null : value.publishedProm,
        publishedOlx: value.publishedOlx === '' ? null : value.publishedOlx,
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
      // What the defaults already say is left unsaid, so one view has one URL however the
      // admin arrived at it — otherwise Back steps through states that render identically.
      queryParams: {
        page: event.pageIndex === 0 ? null : event.pageIndex + 1,
        pageSize: event.pageSize === productPagination.defaultPageSize ? null : event.pageSize,
      },
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
