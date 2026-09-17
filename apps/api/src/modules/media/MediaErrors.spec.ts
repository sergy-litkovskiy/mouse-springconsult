import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../errors.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';
import { FileTooLarge, InvalidFile, StorageUnavailable } from './MediaErrors.ts';

/** Every file-and-storage code, the class that carries it, and the status openapi.yaml promises. */
const mediaErrors = [
  { error: new FileTooLarge(10_485_760), code: apiErrorCodes.fileTooLarge, statusCode: 413 },
  { error: new InvalidFile(), code: apiErrorCodes.invalidFile, statusCode: 422 },
  { error: new StorageUnavailable(), code: apiErrorCodes.storageUnavailable, statusCode: 502 },
] as const;

describe('media errors', () => {
  it('answers with the code and status the contract promises', () => {
    for (const { error, code, statusCode } of mediaErrors) {
      assert.equal(error.code, code, `${error.name} carries the wrong code`);
      assert.equal(error.statusCode, statusCode, `${error.name} carries the wrong status`);
    }
  });

  it('reaches the error handler as an AppError, named after its own class', () => {
    for (const { error } of mediaErrors) {
      assert.ok(error instanceof AppError, `${error.constructor.name} is not an AppError`);
      assert.equal(error.name, error.constructor.name);
    }
  });

  it('keeps the upstream failure as the cause of StorageUnavailable', () => {
    const upstream = new Error('connection reset by peer');

    assert.equal(new StorageUnavailable(upstream).cause, upstream);
  });
});
