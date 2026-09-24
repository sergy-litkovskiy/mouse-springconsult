import { NgOptimizedImage } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  type Resource,
  resourceFromSnapshots,
  type ResourceSnapshot,
  signal,
} from '@angular/core';
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
import { firstValueFrom, map } from 'rxjs';
import { apiErrorCodes } from '@contracts/error-codes';
import type {
  ProductCard,
  ProductImage,
  ProductList,
  ProductListItem,
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
import { ConfirmDialog, type ConfirmDialogData } from '../../confirm-dialog';
import {
  asQueryParam,
  priceBound,
  priceRange,
  flagControlValue,
  toPage,
  toPageSize,
  toPriceFilter,
  toFlagFilter,
  textFilter,
  toCategoryFilter,
  toSortDirection,
  toSortField,
} from './product-catalog-query';
import { ProductForm, type ProductFormData } from '../form/product-form';
import { ImageViewer, type ImageViewerData } from '../gallery/image-viewer';
import { missingFieldsHint } from '../missing-fields-hint';
import { ProductsApi } from '../products-api';
import { itemsPaginatorIntl } from './items-paginator-intl';
import { PreparationFailures, type PreparationFailuresData } from './preparation-failures';

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.validationFailed]: 'Перевірте значення у фільтрах.',
  [apiErrorCodes.tooManyRequests]: 'Забагато запитів. Спробуйте за хвилину.',
};

const UNKNOWN_ERROR_MESSAGE = 'Не вдалося завантажити каталог. Спробуйте ще раз.';

const DELETE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.storageUnavailable]:
    'Сховище фото недоступне, картку не видалено. Спробуйте за хвилину.',
};

const UNKNOWN_DELETE_MESSAGE = 'Не вдалося видалити картку. Спробуйте ще раз.';

function isProductNotFound(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.error as { error?: { code?: string } } | null)?.error?.code ===
      apiErrorCodes.productNotFound
  );
}

/**
 * A resource whose params change drops its value until the new answer arrives. For the table
 * that means an empty page for the length of a request: the page shrinks under the filters and
 * grows back. The recipe is Angular's own ("Resource composition with snapshots").
 */
function withPreviousValue<T>(input: Resource<T>): Resource<T> {
  const derived = linkedSignal<ResourceSnapshot<T>, ResourceSnapshot<T>>({
    source: input.snapshot,
    computation: (snapshot, previous) =>
      snapshot.status === 'loading' && previous !== undefined && previous.value.status !== 'error'
        ? { status: 'loading', value: previous.value.value }
        : snapshot,
  });
  return resourceFromSnapshots(derived);
}

const CONDITION_LABELS: Readonly<Record<ProductCondition, string>> = {
  new: 'Новий',
  used: 'Вживаний',
};

const priceFormat = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 2,
});

/**
 * The state of the table is the URL: every control writes into the address bar, the inputs
 * are filled back from it by the router (`withComponentInputBinding`), and the request follows
 * the inputs. That is what makes F5, a link sent to the second admin and the Back button
 * behave the way the admin expects — a component signal does none of the three.
 */
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
  readonly category = input<string | undefined, string | readonly string[] | undefined>(undefined, {
    transform: toCategoryFilter,
  });
  readonly publishedProm = input<boolean | undefined, string | undefined>(undefined, {
    transform: toFlagFilter,
  });
  readonly publishedOlx = input<boolean | undefined, string | undefined>(undefined, {
    transform: toFlagFilter,
  });
  readonly ready = input<boolean | undefined, string | undefined>(undefined, {
    transform: toFlagFilter,
  });

  /**
   * Apart from paging and ordering, because the form mirrors these and only these: a click on
   * the paginator or a sort header is not a reason to wipe text the admin has typed into a
   * filter and not yet applied.
   */
  private readonly appliedFilters = computed(() => ({
    title: this.title(),
    description: this.description(),
    priceMin: this.priceMin(),
    priceMax: this.priceMax(),
    category: this.category(),
    publishedProm: this.publishedProm(),
    publishedOlx: this.publishedOlx(),
    ready: this.ready(),
  }));

  private readonly query = computed<ProductListQuery>(() => {
    const category = this.category();
    return {
      page: this.page(),
      pageSize: this.pageSize(),
      sort: this.sort(),
      direction: this.direction(),
      ...this.appliedFilters(),
      category: category === undefined ? undefined : [category],
    };
  });

  private readonly catalogue = httpResource<ProductList>(() => this.api.listRequest(this.query()));
  private readonly shown = withPreviousValue(this.catalogue);

  protected readonly products = computed<readonly ProductListItem[]>(() =>
    this.shown.hasValue() ? this.shown.value().items : [],
  );
  protected readonly total = computed(() => (this.shown.hasValue() ? this.shown.value().total : 0));
  protected readonly loading = this.catalogue.isLoading;
  protected readonly loadError = computed(() => {
    const error = this.catalogue.error();
    return error === undefined
      ? null
      : apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE);
  });

  protected readonly deleteError = signal<string | null>(null);
  protected readonly pageIndex = computed(() => this.page() - 1);
  protected readonly pageSizeOptions = [10, 20, productPagination.maxPageSize];
  protected readonly titleMaxLength = productConstraints.titleMaxLength;
  protected readonly categoryMaxLength = productConstraints.categoryMaxLength;
  // The two publication columns stay side by side, so they read as a pair; the action goes last.
  protected readonly columns = [
    'gallery',
    'readiness',
    'failures',
    'titleProm',
    'titleOlx',
    'price',
    'category',
    'condition',
    'publishedProm',
    'publishedOlx',
    'actions',
  ];

  /**
   * The price bounds are text, not `type="number"`: a number input hands Angular a `number`,
   * and a price that has been through a float is no longer the value the admin typed.
   */
  protected readonly filters = this.formBuilder.nonNullable.group(
    {
      title: ['', [Validators.maxLength(productConstraints.titleMaxLength)]],
      description: ['', [Validators.maxLength(productConstraints.titleMaxLength)]],
      priceMin: ['', [priceBound]],
      priceMax: ['', [priceBound]],
      category: ['', [Validators.maxLength(productConstraints.categoryMaxLength)]],
      // '' means "not asked about", which is not the same as "no" (not published, not ready).
      publishedProm: this.formBuilder.nonNullable.control<'' | 'true' | 'false'>(''),
      publishedOlx: this.formBuilder.nonNullable.control<'' | 'true' | 'false'>(''),
      ready: this.formBuilder.nonNullable.control<'' | 'true' | 'false'>(''),
    },
    // The bounds are wrong as a pair, not one at a time, so the rule belongs to the group.
    { validators: [priceRange] },
  );

  /**
   * A reactive form is not a signal, and zoneless change detection does not watch one. The
   * per-field messages are `mat-form-field`'s own business; this one belongs to the group,
   * so the template has to read it as a signal.
   */
  protected readonly priceRangeInvalid = toSignal(
    this.filters.events.pipe(map(() => this.filters.hasError('priceRange'))),
    { initialValue: false },
  );

  constructor() {
    // After a reload, or a Back out of a filtered page, the fields have to agree with the
    // rows underneath them.
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
        publishedProm: flagControlValue(applied.publishedProm),
        publishedOlx: flagControlValue(applied.publishedOlx),
        ready: flagControlValue(applied.ready),
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
        publishedProm: asQueryParam(value.publishedProm),
        publishedOlx: asQueryParam(value.publishedOlx),
        ready: asQueryParam(value.ready),
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
   * against the contract's list keeps a `mat-sort-header` on a column the API cannot sort by
   * from turning into a request the server refuses.
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

  protected mainImage(product: ProductCard): ProductImage | null {
    return product.images.find((image) => image.isMain) ?? product.images[0] ?? null;
  }

  /** Display only: the decimal string keeps its exact value, Intl decides how it looks. */
  protected formatPrice(price: string): string {
    return priceFormat.format(Number(price));
  }

  protected conditionLabel(condition: ProductCondition): string {
    return CONDITION_LABELS[condition];
  }

  protected openViewer(product: ProductCard): void {
    const data: ImageViewerData = { title: product.titleProm, images: product.images };
    this.dialog.open<ImageViewer, ImageViewerData>(ImageViewer, {
      data,
      width: '56rem',
      maxWidth: '92vw',
    });
  }

  protected openFailures(product: ProductListItem): void {
    const data: PreparationFailuresData = { productId: product.id, title: product.titleProm };
    this.dialog.open<PreparationFailures, PreparationFailuresData>(PreparationFailures, {
      data,
      width: '40rem',
      maxWidth: '92vw',
    });
  }

  /** `null` is a new card. The dialog reads the card itself: a row of the list carries neither
   * the suggestions waiting for a decision nor the cost of the card. */
  protected openForm(product: ProductCard | null): void {
    const data: ProductFormData = { productId: product?.id ?? null };
    // Material 3 caps a dialog at 560px unless maxWidth says otherwise.
    this.dialog
      .open<ProductForm, ProductFormData, boolean>(ProductForm, {
        data,
        width: '64rem',
        maxWidth: '92vw',
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) {
          this.catalogue.reload();
        }
      });
  }

  protected readonly missingFields = missingFieldsHint;

  protected async deleteProduct(product: ProductCard): Promise<void> {
    const question: ConfirmDialogData = {
      title: 'Видалити картку?',
      message: `Картку «${product.titleProm}» разом з її фото буде видалено назавжди.`,
      confirmLabel: 'Видалити',
    };
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: question })
        .afterClosed(),
    );
    if (confirmed !== true) {
      return;
    }
    this.deleteError.set(null);
    try {
      await firstValueFrom(this.api.delete(product.id));
    } catch (error: unknown) {
      // A card someone else already deleted is the outcome that was asked for.
      if (!isProductNotFound(error)) {
        this.deleteError.set(apiErrorMessage(error, DELETE_ERROR_MESSAGES, UNKNOWN_DELETE_MESSAGE));
        return;
      }
    }
    this.catalogue.reload();
  }
}
