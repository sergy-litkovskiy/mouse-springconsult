import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { ProductImage } from '@contracts/products.contract';

/**
 * The whole gallery of one card. Opened from the catalogue by clicking the image count —
 * the table shows the main frame, the dialog shows the rest.
 */
export type ProductGalleryData = {
  readonly title: string;
  readonly images: readonly ProductImage[];
};

@Component({
  selector: 'app-product-gallery-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './product-gallery-dialog.html',
  styleUrl: './product-gallery-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGalleryDialog {
  protected readonly data = inject<ProductGalleryData>(MAT_DIALOG_DATA);
}
