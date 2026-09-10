import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { ProductImage } from '@contracts/products.contract';

export type ProductGalleryData = {
  readonly title: string;
  readonly images: readonly ProductImage[];
};

@Component({
  selector: 'app-product-gallery-dialog',
  imports: [NgOptimizedImage, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './product-gallery-dialog.html',
  styleUrl: './product-gallery-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGalleryDialog {
  protected readonly data = inject<ProductGalleryData>(MAT_DIALOG_DATA);
}
