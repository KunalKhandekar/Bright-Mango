import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async controller so any thrown error (incl. ApiError) is forwarded to the
 * global error handler instead of crashing the process or hanging the request.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
