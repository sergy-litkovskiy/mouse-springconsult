import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { ProductImage } from '@contracts/products.contract';

export type ImageViewerData = {
  readonly title: string;
  readonly images: readonly ProductImage[];
};

/** Looking only: editing the gallery stays in the card form. */
@Component({
  selector: 'app-image-viewer',
  imports: [NgOptimizedImage, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './image-viewer.html',
  styleUrl: './image-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageViewer {
  protected readonly data = inject<ImageViewerData>(MAT_DIALOG_DATA);

  /** The catalogue shows the main frame as the thumbnail, so the viewer opens on it. */
  protected readonly frames: readonly ProductImage[] = [
    ...this.data.images.filter((image) => image.isMain),
    ...this.data.images
      .filter((image) => !image.isMain)
      .sort((left, right) => left.position - right.position),
  ];

  protected readonly index = signal(0);
  protected readonly current = computed(() => this.frames[this.index()] ?? null);
  protected readonly isFirst = computed(() => this.index() === 0);
  protected readonly isLast = computed(() => this.index() >= this.frames.length - 1);

  constructor() {
    // The dialog container holds the focus, so the keys are read from it rather than the host.
    inject(MatDialogRef)
      .keydownEvents()
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event.key === 'ArrowLeft') {
          this.previous();
        } else if (event.key === 'ArrowRight') {
          this.next();
        }
      });
  }

  protected previous(): void {
    this.index.update((index) => Math.max(index - 1, 0));
  }

  protected next(): void {
    this.index.update((index) => Math.min(index + 1, this.frames.length - 1));
  }

  protected show(index: number): void {
    this.index.set(index);
  }
}
