import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../http/ApiError.js';
import { Permission, roleHasPermission } from '../constants/permissions.js';
import { Role } from '../constants/roles.js';

/**
 * Role gate — allows the request only if the caller's role is in `roles`.
 * Must run after `authenticate`.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(ApiError.forbidden('Your role cannot access this resource'));
    }
    next();
  };
}

/**
 * Permission gate — allows the request only if the caller's role holds EVERY listed
 * permission. Must run after `authenticate`.
 */
export function authorize(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.unauthorized());

    const ok = permissions.every((p) => roleHasPermission(req.auth!.role, p));
    if (!ok) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}
