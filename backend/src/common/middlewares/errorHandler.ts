import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../http/ApiError.js';
import { ErrorCode } from '../http/errorCodes.js';
import { HttpStatus } from '../http/httpStatus.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

interface ErrorBody {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
  stack?: string;
}

/** Translate known framework/DB errors into a normalized ApiError. */
function normalize(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  // Mongoose schema validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest(ErrorCode.VALIDATION_ERROR, 'Validation failed', details);
  }

  // Invalid ObjectId / cast failures
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(ErrorCode.VALIDATION_ERROR, `Invalid value for "${err.path}"`);
  }

  // Duplicate key
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    const keys = Object.keys((err as { keyValue?: object }).keyValue ?? {});
    return ApiError.conflict(ErrorCode.CONFLICT, `Duplicate value for: ${keys.join(', ')}`);
  }

  return ApiError.internal();
}

/** Global error handler — the single place that renders the error envelope. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const apiError = normalize(err);

  if (apiError.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled error');
  } else {
    logger.warn(
      { errorCode: apiError.errorCode, path: req.originalUrl },
      apiError.message,
    );
  }

  const body: ErrorBody = {
    success: false,
    statusCode: apiError.statusCode,
    errorCode: apiError.errorCode,
    message: apiError.message,
  };
  if (apiError.details !== undefined) body.details = apiError.details;
  if (!env.isProd && !(err instanceof ApiError) && err instanceof Error) {
    body.stack = err.stack;
  }

  res.status(apiError.statusCode).json(body);
}
