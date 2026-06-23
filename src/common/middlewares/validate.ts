import { NextFunction, Request, Response } from 'express';
import { ContextRunner, validationResult } from 'express-validator';
import { ApiError } from '../http/ApiError.js';
import { ErrorCode } from '../http/errorCodes.js';

/**
 * Runs a set of express-validator chains, then collects results. On failure throws a
 * single VALIDATION_ERROR ApiError whose `details` lists each field issue.
 *
 * Usage: router.post('/x', validate(xValidators), controller.x)
 */
export function validate(validators: ContextRunner[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    for (const validator of validators) {
      await validator.run(req);
    }

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const details = result.array().map((e) => ({
      field: e.type === 'field' ? e.path : e.type,
      message: e.msg,
    }));

    next(ApiError.badRequest(ErrorCode.VALIDATION_ERROR, 'Validation failed', details));
  };
}
