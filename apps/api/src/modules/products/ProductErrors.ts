import { AppError } from '../../errors.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { productConstraints } from '../../contracts/products-limits.ts';

/** Each status below is the one the contract promises for that code (contracts/openapi.yaml). */
export class ProductNotFound extends AppError {
  constructor(productId: string) {
    super({
      code: apiErrorCodes.productNotFound,
      statusCode: 404,
      message: 'Product not found',
      details: { productId },
    });
  }
}

export class ImageNotFound extends AppError {
  constructor(imageId: string) {
    super({
      code: apiErrorCodes.imageNotFound,
      statusCode: 404,
      message: 'Image not found',
      details: { imageId },
    });
  }
}

/**
 * The ceiling travels in `details` because the frontend states it in the message, and a number
 * duplicated in two languages drifts.
 */
export class GalleryFull extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.galleryFull,
      statusCode: 409,
      message: 'Gallery already holds the maximum number of images',
      details: { maxImages: productConstraints.maxImagesPerProduct },
    });
  }
}

/** Not the declared MIME type but the decoded content: see ADR 0004. */
export class InvalidFile extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.invalidFile,
      statusCode: 422,
      message: 'File content is not an image',
    });
  }
}

export class FileTooLarge extends AppError {
  constructor(maxBytes: number) {
    super({
      code: apiErrorCodes.fileTooLarge,
      statusCode: 413,
      message: 'File exceeds the upload size limit',
      details: { maxBytes },
    });
  }
}

/**
 * Raised after the S3 client has exhausted its own retries (sad.md scenario 2). 502 rather than
 * 500: the fault is upstream, and everything already entered on the card survives it.
 */
export class StorageUnavailable extends AppError {
  constructor(cause?: unknown) {
    super({
      code: apiErrorCodes.storageUnavailable,
      statusCode: 502,
      message: 'File storage is temporarily unavailable',
      cause,
    });
  }
}

/**
 * Kept apart from `validation_failed` because the frontend puts it on the price field rather
 * than on the form.
 */
export class InvalidPrice extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.invalidPrice,
      statusCode: 422,
      message: 'Price must be a non-negative number with at most two decimals',
    });
  }
}
