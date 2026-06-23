import { HttpStatus } from './httpStatus.js';
import { ErrorCode, ErrorCodeValue } from './errorCodes.js';

/**
 * Operational error carrying everything the global error handler needs to render
 * the normalized error envelope. Throw these from services/controllers.
 */
export class ApiError extends Error {
  readonly success = false as const;
  readonly isOperational = true;

  constructor(
    public readonly statusCode: number,
    public readonly errorCode: ErrorCodeValue | string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(code: ErrorCodeValue | string, message: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, code, message, details);
  }

  static unauthorized(
    message = 'Authentication required',
    code: ErrorCodeValue | string = ErrorCode.UNAUTHENTICATED,
  ): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
    code: ErrorCodeValue | string = ErrorCode.FORBIDDEN,
  ): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(
    message = 'Resource not found',
    code: ErrorCodeValue | string = ErrorCode.NOT_FOUND,
  ): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, code, message);
  }

  static conflict(code: ErrorCodeValue | string, message: string, details?: unknown): ApiError {
    return new ApiError(HttpStatus.CONFLICT, code, message, details);
  }

  static tooMany(
    message = 'Too many requests',
    code: ErrorCodeValue | string = ErrorCode.RATE_LIMITED,
  ): ApiError {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, code, message);
  }

  static internal(message = 'Something went wrong'): ApiError {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, message);
  }
}
