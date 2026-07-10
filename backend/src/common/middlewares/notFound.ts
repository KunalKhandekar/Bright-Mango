import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../http/ApiError.js';
import { ErrorCode } from '../http/errorCodes.js';

/** Catch-all for unmatched routes — forwards a 404 ApiError to the error handler. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, ErrorCode.ROUTE_NOT_FOUND));
}
