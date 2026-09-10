import { AppError } from '../../errors.ts';
import { apiErrorCodes } from '../../contracts/error-codes.ts';

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
