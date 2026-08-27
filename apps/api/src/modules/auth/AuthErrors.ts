import { AppError } from '../../errors.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';

/**
 * Domain errors are declared by the module they belong to. The HTTP status is stated
 * here, while the mapping into a response is done by the single error handler in `src/api.ts`.
 *
 * User-facing text is composed by the frontend from `code`: the server does not do UI.
 */
export class InvalidCredentials extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.invalidCredentials,
      statusCode: 401,
      message: 'Email or password is incorrect',
    });
  }
}

export class UserDeactivated extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.userDeactivated,
      statusCode: 403,
      message: 'User account is deactivated',
    });
  }
}

export class NotAuthenticated extends AppError {
  constructor() {
    super({
      code: apiErrorCodes.notAuthenticated,
      statusCode: 401,
      message: 'Authentication required',
    });
  }
}
