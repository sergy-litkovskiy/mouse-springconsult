import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, map, type Observable, of, tap } from 'rxjs';
import { apiErrorCodes } from '@contracts/error-codes';
import type { PreparationRunRequest, RewritableField } from '@contracts/ai.contract';
import type {
  FieldSuggestion,
  Product,
  ProductCardRead,
  ProductImage,
  ProductUpdate,
} from '@contracts/products.contract';
import { productConstraints, type ProductCondition } from '@contracts/products-limits';
import { apiErrorMessage } from '../../api-error-message';
import { priceBound } from '../catalog/product-catalog-query';
import { ProductGallery } from '../gallery/product-gallery';
import { missingFieldsHint } from '../missing-fields-hint';
import { PreparationRunPoller } from '../preparation-run-poller';
import { ProductsApi } from '../products-api';
import { runFailureMessages } from '../run-failure-messages';
import { PromDescriptionEditor } from './prom-description-editor';
import { SuggestionField } from './suggestion-field';

/**
 * `null` opens an empty dialog: the card itself is created once the first frame is chosen.
 *
 * An identifier rather than the card the catalogue already holds: the suggestions waiting for a
 * decision and the cost of the card ride only with the read of one card (T31, T53), and a row of
 * the list carries neither. The dialog therefore reads the card it was given.
 */
export type ProductFormData = {
  readonly productId: string | null;
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.validationFailed]: 'Сервер не прийняв значення. Перевірте поля, зокрема ціну.',
  [apiErrorCodes.invalidPrice]: 'Ціна виглядає як 2499 або 2499.00.',
  [apiErrorCodes.productNotFound]: 'Картку вже видалено.',
};

/** No raw `code` ever reaches the screen: the server sends one, the wording lives here. */
const PREPARATION_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.preparationRateLimited]:
    'Забагато запусків підготовки для цієї картки. Спробуйте за годину.',
  [apiErrorCodes.preparationInputIncomplete]:
    'Для пошуку ціни потрібен хоча б один заголовок. Заповніть назву для Prom або для OLX.',
  [apiErrorCodes.tooManyRequests]: 'Забагато запитів. Зачекайте трохи і спробуйте ще раз.',
  [apiErrorCodes.productNotFound]: 'Картку вже видалено.',
  [apiErrorCodes.suggestionNotFound]: 'Пропозиції вже немає — перечитайте картку.',
  [apiErrorCodes.suggestionAlreadyResolved]: 'Цю пропозицію вже прийнято або відхилено.',
  [apiErrorCodes.priceSuggestionReadonly]: 'Ціну вписують у поле руками — вона не переноситься.',
};

const UNAVAILABLE_MODEL_MESSAGE = 'Модель зараз недоступна. Спробуйте ще раз трохи пізніше.';

const UNKNOWN_ERROR_MESSAGE = 'Не вдалося зберегти картку. Спробуйте ще раз.';
const UNKNOWN_READ_MESSAGE = 'Не вдалося прочитати картку. Закрийте вікно і спробуйте ще раз.';

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
    PromDescriptionEditor,
    SuggestionField,
  ],
  /**
   * Not `providedIn: 'root'`: the poller must die with the dialog. A timer left running polls a
   * card nobody is looking at any more, and every ask spends the rate limit of that card.
   */
  providers: [PreparationRunPoller],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm {
  private readonly api = inject(ProductsApi);
  private readonly formBuilder = inject(FormBuilder);
  private readonly data = inject<ProductFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ProductForm, boolean>>(MatDialogRef);
  private readonly snackBar = inject(MatSnackBar);

  private readonly productId = signal<string | null>(this.data.productId);
  protected readonly card = signal<ProductCardRead | null>(null);
  protected readonly images = signal<readonly ProductImage[]>([]);

  /** Every field waits for the first frame (AC-20): the texts are written about the photos. */
  protected readonly hasFrames = computed(() => this.images().length > 0);
  /**
   * Derived by the server (ADR 0009) and only shown here: there is no "mark as ready". The badge
   * describes the card as it was read, not the fields being edited.
   */
  protected readonly ready = computed(() => this.card()?.isReady ?? false);
  protected readonly missingFields = computed(() => {
    const card = this.card();
    return card === null ? '' : missingFieldsHint(card);
  });
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** The catalogue re-reads its page only when the dialog changed something. */
  protected readonly changed = signal(false);

  protected readonly titleMaxLength = productConstraints.titleMaxLength;
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
    descriptionProm: [''],
    descriptionOlx: [''],
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

  /** Same reason, for the disabled states of AC-22 and AC-24, which read what is typed. */
  private readonly draft = toSignal(this.form.events.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  private readonly poller = inject(PreparationRunPoller);

  /** One rate limit for the whole card, so one run at a time (PRD §6.1). */
  protected readonly preparing = computed(() => {
    const status = this.poller.run()?.status;
    return status === 'queued' || status === 'running';
  });

  /**
   * Turned off until [T54]: measured 2026-09-20, `scope: price` returns an empty range for every
   * item and costs $0.27-$0.77 a call, twenty times the texts of the whole card. The button is
   * what spends the money, so the button is what goes; the code behind it stays for T54 to fix.
   */
  protected readonly priceLookupEnabled = false;

  protected readonly preparingNotice = computed(() =>
    this.poller.run()?.scope === 'price' ? 'Модель шукає ціну…' : 'Модель готує тексти…',
  );

  protected readonly suggestions = computed<Partial<Record<string, FieldSuggestion>>>(() => {
    const pending: Partial<Record<string, FieldSuggestion>> = {};
    for (const suggestion of this.card()?.pendingSuggestions ?? []) {
      pending[suggestion.field] = suggestion;
    }
    return pending;
  });

  protected readonly totalTokens = computed(() => {
    const card = this.card();
    return card === null ? null : { input: card.totalInputTokens, output: card.totalOutputTokens };
  });

  /** «Generate all» writes about the photos, so it waits for the same first frame as the fields. */
  protected readonly canGenerateAll = computed(
    () => this.hasFrames() && this.productId() !== null && !this.preparing(),
  );

  /** AC-24: a description alone does not enable the price button — the server gates on a title. */
  protected readonly canLookUpPrice = computed(() => {
    const value = this.draft();
    return (
      this.productId() !== null &&
      !this.preparing() &&
      (value.titleProm.trim() !== '' || value.titleOlx.trim() !== '')
    );
  });

  /** Handed to the gallery section, which needs the card to exist before its first upload. */
  protected readonly ensureProductForGallery = (): Observable<string> => this.ensureProduct();

  protected readonly canSave = computed(
    () => this.hasFrames() && !this.formInvalid() && !this.saving(),
  );

  constructor() {
    if (this.data.productId !== null) {
      void this.read(this.data.productId);
    }

    effect(() => {
      if (this.hasFrames()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });

    effect(() => {
      const run = this.poller.run();
      if (run === null || run.status === 'queued' || run.status === 'running') {
        return;
      }
      if (this.settledRunId === run.id) {
        return;
      }
      this.settledRunId = run.id;
      if (run.status === 'failed') {
        this.formError.set(
          run.errorCode === null ? UNAVAILABLE_MODEL_MESSAGE : runFailureMessages[run.errorCode],
        );
      }
      // Even a failed run may have left texts behind: the price alone can be what went missing
      // (AC-10b), and the suggestions are counted by the read of the card, never by this screen.
      void this.reread();
    });
  }

  /** A finished run is reconciled once: the effect re-runs whenever the polled state changes. */
  private settledRunId: string | null = null;

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

  /** Recognises the item from the main frame and fills every text at once (ADR 0014). */
  protected generateAll(): Promise<void> {
    return this.startRun({ scope: 'texts' });
  }

  /** One field, rewritten from the draft on the left, without the photos (ADR 0015, AC-21). */
  protected rewriteField(field: RewritableField): Promise<void> {
    return this.startRun({ scope: 'field', field, draftText: this.draft()[field] });
  }

  /** The price never reads the draft — it searches the web, so it is a scope of its own. */
  protected lookUpPrice(): Promise<void> {
    return this.startRun({ scope: 'price' });
  }

  protected canRewrite(field: RewritableField): boolean {
    return this.productId() !== null && !this.preparing() && this.draft()[field].trim() !== '';
  }

  protected suggestionFor(field: string): FieldSuggestion | null {
    return this.suggestions()[field] ?? null;
  }

  /**
   * Copies what the server stored into the field on the left, and only that field: the rest of the
   * form may hold edits of its own, and a suggestion decides nothing about them (AC-11).
   */
  protected async acceptSuggestion(field: RewritableField): Promise<void> {
    const id = this.productId();
    const suggestion = this.suggestionFor(field);
    if (id === null || suggestion === null) {
      return;
    }

    this.formError.set(null);
    try {
      const card = await firstValueFrom(this.api.acceptSuggestion(id, suggestion.id));
      this.card.set(card);
      this.images.set(card.images);
      this.form.controls[field].setValue(
        field === 'seoKeywords' ? card.seoKeywords.join(', ') : card[field],
      );
      this.changed.set(true);
    } catch (error: unknown) {
      this.formError.set(apiErrorMessage(error, PREPARATION_MESSAGES, UNAVAILABLE_MODEL_MESSAGE));
    }
  }

  private async startRun(request: PreparationRunRequest): Promise<void> {
    const id = this.productId();
    if (id === null || this.preparing()) {
      return;
    }

    this.formError.set(null);
    try {
      const run = await firstValueFrom(this.api.startPreparationRun(id, request));
      this.poller.watch(id, run.id);
    } catch (error: unknown) {
      this.formError.set(apiErrorMessage(error, PREPARATION_MESSAGES, UNAVAILABLE_MODEL_MESSAGE));
    }
  }

  /**
   * Re-reads the card without touching the fields: what the admin typed while the run was going
   * stays (AC-11), and the suggestions arrive beside it.
   */
  private async reread(): Promise<void> {
    const id = this.productId();
    if (id === null) {
      return;
    }
    try {
      const card = await firstValueFrom(this.api.getById(id));
      this.card.set(card);
      this.images.set(card.images);
      this.changed.set(true);
    } catch {
      // The run is already reported; a failed re-read would only replace that message with a
      // vaguer one, and the card on screen is still the one the admin is editing.
    }
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
      const discarded = response.discardedKeywordsCount;
      this.snackBar.open(
        discarded > 0
          ? `Картку збережено. Понад ліміт відкинуто ключових слів: ${String(discarded)}.`
          : 'Картку збережено.',
        undefined,
        { duration: 4000, panelClass: 'snack-bar--success', verticalPosition: 'top' },
      );
      this.dialogRef.close(true);
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

  private async read(productId: string): Promise<void> {
    this.loading.set(true);
    this.formError.set(null);
    try {
      this.take(await firstValueFrom(this.api.getById(productId)));
    } catch (error: unknown) {
      this.formError.set(apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_READ_MESSAGE));
    } finally {
      this.loading.set(false);
    }
  }

  /** Both the read and every answer that recounts the card land here, so neither can drift. */
  private take(card: ProductCardRead): void {
    this.card.set(card);
    this.images.set(card.images);
    this.fill(card);
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
