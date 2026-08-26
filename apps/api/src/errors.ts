/**
 * Base application error. Domain errors are declared by the module they belong to;
 * this file holds only the contract shared with the error handler in api.ts.
 *
 * Technical service: knows nothing about modules/.
 */
export type AppErrorInit = {
  readonly code: string;
  readonly statusCode: number;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(init: AppErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = new.target.name;
    this.code = init.code;
    this.statusCode = init.statusCode;
    this.details = init.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
