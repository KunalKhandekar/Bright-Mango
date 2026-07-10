import { NextFunction, Request, Response } from 'express';
import { redis } from '../../config/redis.js';
import { ApiError } from '../http/ApiError.js';
import { ErrorCode } from '../http/errorCodes.js';

interface RateLimitOptions {
  /** Window length in seconds. */
  windowSeconds: number;
  /** Max requests allowed per key per window. */
  max: number;
  /** Key namespace, e.g. "otp" or "global". */
  prefix: string;
  /** Derives the rate-limit subject from the request (default: client IP). */
  keyBy?: (req: Request) => string;
  message?: string;
}

/**
 * Redis fixed-window rate limiter. Atomic INCR + EXPIRE; first hit in a window sets TTL.
 * Use `keyBy` to limit per-email (OTP) instead of per-IP.
 */
export function rateLimiter(options: RateLimitOptions) {
  const { windowSeconds, max, prefix, keyBy, message } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subject = keyBy ? keyBy(req) : req.ip ?? 'unknown';
      const key = `rl:${prefix}:${subject}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', ttl);

      if (count > max) {
        throw new ApiError(
          429,
          ErrorCode.RATE_LIMITED,
          message ?? 'Too many requests, please try again later',
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
