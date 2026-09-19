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

/** One code for both gates (AC-06, AC-27): `details.missing` names what the card lacks. */
export class PreparationInputIncomplete extends AppError {
  constructor(missing: 'gallery' | 'title') {
    super({
      code: apiErrorCodes.preparationInputIncomplete,
      statusCode: 409,
      message: 'The card lacks the input this preparation needs',
      details: { missing: [missing] },
    });
  }
}

/** Kept apart from `too_many_requests`: this window counts paid runs of a card, not sign-ins. */
export class PreparationRateLimited extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.preparationRateLimited,
      statusCode: 429,
      message: 'Too many preparation runs for this card, try again later',
    });
  }
}
