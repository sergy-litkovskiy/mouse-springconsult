import { AppError } from '../../errors.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';

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
