import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, map, type Observable, of, tap } from 'rxjs';
import { apiErrorCodes } from '@contracts/error-codes';
import type {
  Product,
  ProductCard,
  ProductImage,
  ProductUpdate,
} from '@contracts/products.contract';
import { productConstraints, type ProductCondition } from '@contracts/products-limits';
import { apiErrorMessage } from '../../api-error-message';
import { priceBound } from '../catalog/product-catalog-query';
import { ProductGallery } from '../gallery/product-gallery';
import { missingFieldsHint } from '../missing-fields-hint';
import { ProductsApi } from '../products-api';

/** `null` opens an empty dialog: the card itself is created once the first frame is chosen. */
export type ProductFormData = {
  readonly product: ProductCard | null;
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.validationFailed]: 'Сервер не прийняв значення. Перевірте поля, зокрема ціну.',
  [apiErrorCodes.invalidPrice]: 'Ціна виглядає як 2499 або 2499.00.',
  [apiErrorCodes.productNotFound]: 'Картку вже видалено.',
};

const UNKNOWN_ERROR_MESSAGE = 'Не вдалося зберегти картку. Спробуйте ще раз.';

/** "0.00" is how the column says "not priced yet", so the field shows it as empty. */
const UNPRICED = '0.00';

const CONDITION_OPTIONS: readonly { value: ProductCondition; label: string }[] = [
  { value: 'used', label: 'Вживаний' },
  { value: 'new', label: 'Новий' },
];

function parseKeywords(text: string): string[] {
  return text
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== '');
}

function keywordsBound(control: AbstractControl): ValidationErrors | null {
  const tooLong = parseKeywords(control.value as string).some(
    (keyword) => keyword.length > productConstraints.keywordMaxLength,
  );
  return tooLong ? { keywordLength: true } : null;
}

/**
 * One dialog for both a new card and an existing one (mockup 2026-09-12). The manual path has no
 * route of its own: saving is the same `PATCH` that accepting a suggestion will use (AC-12).
 */
@Component({
  selector: 'app-product-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    ProductGallery,
  ],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm {
  private readonly api = inject(ProductsApi);
  private readonly formBuilder = inject(FormBuilder);
  private readonly data = inject<ProductFormData>(MAT_DIALOG_DATA);

  private readonly productId = signal<string | null>(this.data.product?.id ?? null);
  protected readonly images = signal<readonly ProductImage[]>(this.data.product?.images ?? []);

  /** Every field waits for the first frame (AC-20): the texts are written about the photos. */
  protected readonly hasFrames = computed(() => this.images().length > 0);
  /** The card as the server last answered it: the gaps describe the saved state, not the fields. */
  private readonly savedCard = signal<ProductCard | null>(this.data.product);
  /** Derived by the server (ADR 0009) and only shown here: there is no "mark as ready". */
  protected readonly ready = computed(() => this.savedCard()?.isReady ?? false);
  protected readonly missingFields = computed(() => {
    const product = this.savedCard();
    return product === null ? '' : missingFieldsHint(product);
  });
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly discardedKeywords = signal(0);
  protected readonly formError = signal<string | null>(null);
  /** The catalogue re-reads its page only when the dialog changed something. */
  protected readonly changed = signal(false);

  protected readonly titleMaxLength = productConstraints.titleMaxLength;
  protected readonly descriptionMaxLength = productConstraints.descriptionMaxLength;
  protected readonly categoryMaxLength = productConstraints.categoryMaxLength;
  protected readonly keywordMaxLength = productConstraints.keywordMaxLength;
  protected readonly maxKeywords = productConstraints.maxKeywords;
  protected readonly conditionOptions = CONDITION_OPTIONS;

  /**
   * The price is text, not `type="number"`: a number input hands Angular a float, and a price
   * that has been through one is no longer the value the admin typed.
   */
  protected readonly form = this.formBuilder.nonNullable.group({
    titleProm: ['', [Validators.maxLength(productConstraints.titleMaxLength)]],
    titleOlx: ['', [Validators.maxLength(productConstraints.titleMaxLength)]],
    descriptionProm: ['', [Validators.maxLength(productConstraints.descriptionMaxLength)]],
    descriptionOlx: ['', [Validators.maxLength(productConstraints.descriptionMaxLength)]],
    seoKeywords: ['', [keywordsBound]],
    price: ['', [priceBound]],
    category: ['', [Validators.maxLength(productConstraints.categoryMaxLength)]],
    condition: this.formBuilder.nonNullable.control<ProductCondition>('used'),
    publishedProm: [false],
    publishedOlx: [false],
  });

  /** Zoneless change detection does not watch a reactive form, so the template reads a signal. */
  protected readonly formInvalid = toSignal(this.form.events.pipe(map(() => this.form.invalid)), {
    initialValue: this.form.invalid,
  });

  /** Handed to the gallery section, which needs the card to exist before its first upload. */
  protected readonly ensureProductForGallery = (): Observable<string> => this.ensureProduct();

  protected readonly canSave = computed(
    () => this.hasFrames() && !this.formInvalid() && !this.saving(),
  );

  constructor() {
    if (this.data.product !== null) {
      this.fill(this.data.product);
    }

    effect(() => {
      if (this.hasFrames()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });

    // A message about the last save no longer describes fields the admin has since edited.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.saved.set(false);
    });
  }

  /**
   * The gallery section reports every change of the frames here. That is what lifts AC-20 for a
   * card that had none.
   */
  imagesChanged(images: readonly ProductImage[]): void {
    this.images.set(images);
    this.changed.set(true);
  }

  /**
   * A frame is stored under `products/{id}/…`, so a new card has to exist before its first frame
   * is uploaded. It is created empty (T38) and from then on edited like any other card.
   */
  ensureProduct(): Observable<string> {
    const id = this.productId();
    if (id !== null) {
      return of(id);
    }
    return this.api.create({}).pipe(
      tap((product) => {
        this.productId.set(product.id);
        this.changed.set(true);
      }),
      map((product) => product.id),
    );
  }

  protected async save(): Promise<void> {
    const id = this.productId();
    if (!this.canSave() || id === null) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    try {
      const response = await firstValueFrom(this.api.update(id, this.changes()));
      this.fill(response);
      this.images.set(response.images);
      this.savedCard.set(response);
      this.discardedKeywords.set(response.discardedKeywordsCount);
      this.saved.set(true);
      this.changed.set(true);
    } catch (error: unknown) {
      // What the admin typed stays in the fields (AC-09): only the message changes.
      this.formError.set(apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE));
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * A blank title or category is left out rather than sent: a card starts with both empty, and
   * the `PATCH` schema refuses a blank one.
   */
  private changes(): ProductUpdate {
    const value = this.form.getRawValue();
    const price = value.price.trim();
    const changes: ProductUpdate = {
      descriptionProm: value.descriptionProm,
      descriptionOlx: value.descriptionOlx,
      seoKeywords: parseKeywords(value.seoKeywords),
      price: price === '' ? UNPRICED : price,
      condition: value.condition,
      publishedProm: value.publishedProm,
      publishedOlx: value.publishedOlx,
    };
    const titleProm = value.titleProm.trim();
    const titleOlx = value.titleOlx.trim();
    const category = value.category.trim();
    return {
      ...changes,
      ...(titleProm === '' ? {} : { titleProm }),
      ...(titleOlx === '' ? {} : { titleOlx }),
      ...(category === '' ? {} : { category }),
    };
  }

  private fill(product: Product): void {
    this.form.setValue(
      {
        titleProm: product.titleProm,
        titleOlx: product.titleOlx,
        descriptionProm: product.descriptionProm,
        descriptionOlx: product.descriptionOlx,
        seoKeywords: product.seoKeywords.join(', '),
        price: product.price === UNPRICED ? '' : product.price,
        category: product.category,
        condition: product.condition,
        publishedProm: product.publishedProm,
        publishedOlx: product.publishedOlx,
      },
      { emitEvent: false },
    );
  }
}
