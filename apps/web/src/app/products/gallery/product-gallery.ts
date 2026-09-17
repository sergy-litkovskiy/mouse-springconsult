import { NgOptimizedImage } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, type Observable } from 'rxjs';
import { apiErrorCodes } from '@contracts/error-codes';
import type { ProductImage } from '@contracts/products.contract';
import { allowedImageTypes, productConstraints } from '@contracts/products-limits';
import { apiErrorMessage } from '../../api-error-message';
import { ConfirmDialog, type ConfirmDialogData } from '../../confirm-dialog';
import { ProductsApi } from '../products-api';

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [apiErrorCodes.notAuthenticated]: 'Сесія завершилась. Увійдіть ще раз.',
  [apiErrorCodes.galleryFull]: 'Галерея вміщає щонайбільше десять кадрів.',
  [apiErrorCodes.fileTooLarge]: 'Файл більший за 10 МБ.',
  [apiErrorCodes.invalidFile]: 'Файл не є зображенням JPEG, PNG чи WebP.',
  [apiErrorCodes.storageUnavailable]: 'Сховище фото недоступне. Спробуйте за хвилину.',
  [apiErrorCodes.productNotFound]: 'Картку вже видалено.',
  [apiErrorCodes.imageNotFound]: 'Кадр уже видалено.',
};

const UNKNOWN_ERROR_MESSAGE = 'Не вдалося змінити галерею. Спробуйте ще раз.';

const DELETE_QUESTION: ConfirmDialogData = {
  title: 'Видалити фото?',
  message: 'Фото буде видалено з галереї остаточно.',
  confirmLabel: 'Видалити',
};

/** A chosen file on its way to the server, drawn from the local copy (QG-2). */
type PendingFrame = {
  readonly key: number;
  readonly name: string;
  readonly previewUrl: string;
};

function refusalOf(file: File): string | null {
  if (!(allowedImageTypes as readonly string[]).includes(file.type)) {
    return `«${file.name}» не є зображенням JPEG, PNG чи WebP.`;
  }
  if (file.size > productConstraints.maxImageBytes) {
    return `«${file.name}» більший за 10 МБ.`;
  }
  return null;
}

/**
 * The section at the top of the card dialog (mockup 2026-09-12). It owns the frames and reports
 * every change upwards: whether the rest of the card is editable is the form's decision (AC-20).
 */
@Component({
  selector: 'app-product-gallery',
  imports: [
    NgOptimizedImage,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './product-gallery.html',
  styleUrl: './product-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGallery {
  private readonly api = inject(ProductsApi);
  private readonly dialog = inject(MatDialog);

  readonly images = input.required<readonly ProductImage[]>();
  /** A new card has no id until its first frame; the form creates it on demand (T38). */
  readonly ensureProduct = input.required<() => Observable<string>>();
  readonly imagesChange = output<readonly ProductImage[]>();

  protected readonly pending = signal<readonly PendingFrame[]>([]);
  protected readonly message = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** Positions keep their gaps after a delete, so only the order is shown, never the numbers. */
  protected readonly ordered = computed(() =>
    [...this.images()].sort((left, right) => left.position - right.position),
  );
  protected readonly count = computed(() => this.images().length + this.pending().length);
  protected readonly full = computed(() => this.count() >= productConstraints.maxImagesPerProduct);
  protected readonly maxImages = productConstraints.maxImagesPerProduct;
  protected readonly accept = allowedImageTypes.join(',');

  private nextKey = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const frame of this.pending()) {
        URL.revokeObjectURL(frame.previewUrl);
      }
    });
  }

  protected choose(event: Event): void {
    const picker = event.target as HTMLInputElement;
    const files = [...(picker.files ?? [])];
    // The same file chosen twice in a row has to fire `change` again.
    picker.value = '';

    const refusals: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const refusal = refusalOf(file);
      if (refusal !== null) {
        refusals.push(refusal);
      } else if (this.count() + accepted.length >= productConstraints.maxImagesPerProduct) {
        refusals.push(ERROR_MESSAGES[apiErrorCodes.galleryFull] ?? UNKNOWN_ERROR_MESSAGE);
        break;
      } else {
        accepted.push(file);
      }
    }
    this.message.set(refusals.length === 0 ? null : refusals.join(' '));
    if (accepted.length > 0) {
      void this.upload(accepted);
    }
  }

  protected async makeMain(image: ProductImage): Promise<void> {
    await this.run(async (productId) => {
      const gallery = await firstValueFrom(this.api.setMainImage(productId, image.id));
      this.imagesChange.emit(gallery);
    });
  }

  protected async remove(image: ProductImage): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: DELETE_QUESTION })
        .afterClosed(),
    );
    if (confirmed !== true) {
      return;
    }
    await this.run(async (productId) => {
      try {
        await firstValueFrom(this.api.deleteImage(productId, image.id));
      } catch (error: unknown) {
        // Already gone is the outcome that was asked for, not a failure to report.
        if (!isImageNotFound(error)) {
          throw error;
        }
      }
      this.imagesChange.emit(this.images().filter((candidate) => candidate.id !== image.id));
    });
  }

  /**
   * One file at a time, in the order chosen: the server numbers frames as they arrive, and the
   * eleventh has to be the one it refuses.
   */
  private async upload(files: readonly File[]): Promise<void> {
    const queue = files.map((file) => ({
      file,
      frame: { key: this.nextKey++, name: file.name, previewUrl: URL.createObjectURL(file) },
    }));
    this.pending.update((current) => [...current, ...queue.map(({ frame }) => frame)]);

    let gallery = this.images();
    try {
      const productId = await firstValueFrom(this.ensureProduct()());
      for (const { file, frame } of queue) {
        const image = await firstValueFrom(this.api.uploadImage(productId, file));
        gallery = [...gallery, image];
        this.imagesChange.emit(gallery);
        this.settle(frame);
      }
    } catch (error: unknown) {
      this.message.set(apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE));
    } finally {
      // Whatever did not make it is dropped together with its local copy.
      for (const { frame } of queue) {
        this.settle(frame);
      }
    }
  }

  private settle(frame: PendingFrame): void {
    if (!this.pending().includes(frame)) {
      return;
    }
    URL.revokeObjectURL(frame.previewUrl);
    this.pending.update((current) => current.filter((candidate) => candidate !== frame));
  }

  private async run(action: (productId: string) => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    try {
      await action(await firstValueFrom(this.ensureProduct()()));
    } catch (error: unknown) {
      this.message.set(apiErrorMessage(error, ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE));
    } finally {
      this.busy.set(false);
    }
  }
}

function isImageNotFound(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 404 &&
    (error.error as { error?: { code?: string } } | null)?.error?.code ===
      apiErrorCodes.imageNotFound
  );
}
