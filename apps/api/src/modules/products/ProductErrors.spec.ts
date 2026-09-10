import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { AppError } from '../../errors.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { productConstraints } from '../../contracts/products-limits.ts';
import {
  FileTooLarge,
  GalleryFull,
  ImageNotFound,
  InvalidFile,
  InvalidPrice,
  ProductNotFound,
  StorageUnavailable,
} from './ProductErrors.ts';

/** Every delivery-1 domain code, the class that carries it, and the status openapi.yaml promises. */
const domainErrors = [
  { error: new ProductNotFound('p-1'), code: apiErrorCodes.productNotFound, statusCode: 404 },
  { error: new ImageNotFound('i-1'), code: apiErrorCodes.imageNotFound, statusCode: 404 },
  { error: new GalleryFull(), code: apiErrorCodes.galleryFull, statusCode: 409 },
  { error: new FileTooLarge(10_485_760), code: apiErrorCodes.fileTooLarge, statusCode: 413 },
  { error: new InvalidFile(), code: apiErrorCodes.invalidFile, statusCode: 422 },
  { error: new InvalidPrice(), code: apiErrorCodes.invalidPrice, statusCode: 422 },
  { error: new StorageUnavailable(), code: apiErrorCodes.storageUnavailable, statusCode: 502 },
] as const;

describe('product domain errors', () => {
  it('answers with the code and status the contract promises', () => {
    for (const { error, code, statusCode } of domainErrors) {
      assert.equal(error.code, code, `${error.name} carries the wrong code`);
      assert.equal(error.statusCode, statusCode, `${error.name} carries the wrong status`);
    }
  });

  it('reaches the error handler as an AppError, named after its own class', () => {
    // The handler in api.ts branches on `isAppError` alone — a class that misses the base
    // would leave through the 500 path instead of its own status.
    for (const { error } of domainErrors) {
      assert.ok(error instanceof AppError, `${error.constructor.name} is not an AppError`);
      assert.equal(error.name, error.constructor.name);
    }
  });

  it('covers every delivery-1 domain code declared in the contract', () => {
    const deliveryOneCodes = [
      apiErrorCodes.productNotFound,
      apiErrorCodes.imageNotFound,
      apiErrorCodes.galleryFull,
      apiErrorCodes.invalidFile,
      apiErrorCodes.fileTooLarge,
      apiErrorCodes.storageUnavailable,
      apiErrorCodes.invalidPrice,
    ];

    assert.deepEqual(
      [...domainErrors.map(({ code }) => code)].sort(),
      [...deliveryOneCodes].sort(),
      'a code without a class is a string nothing throws',
    );
  });

  it('states the gallery ceiling from the shared constraint, not a literal', () => {
    assert.deepEqual(new GalleryFull().details, {
      maxImages: productConstraints.maxImagesPerProduct,
    });
  });

  it('keeps the identifier that was not found in details', () => {
    assert.deepEqual(new ProductNotFound('p-7').details, { productId: 'p-7' });
    assert.deepEqual(new ImageNotFound('i-7').details, { imageId: 'i-7' });
  });

  it('keeps the upstream failure as the cause of StorageUnavailable', () => {
    const upstream = new Error('connection reset by peer');

    assert.equal(new StorageUnavailable(upstream).cause, upstream);
  });

  it('leaves error-codes.ts without a single import', () => {
    // Not style: one runtime import from a zod file drags the whole validation library into
    // the browser bundle — measured at ~55 KB gzip. Compiled specs live four levels below
    // dist/, so the source is resolved from here rather than from the process directory.
    const apiRoot = path.resolve(import.meta.dirname, '../../../..');
    const source = readFileSync(path.join(apiRoot, 'src/contracts/error-codes.ts'), 'utf8');

    assert.equal(
      source.split('\n').filter((line) => line.startsWith('import')).length,
      0,
      'error-codes.ts must stay dependency-free',
    );
  });
});
