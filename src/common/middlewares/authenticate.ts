import { NextFunction, Request, Response } from 'express';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { redisKeys } from '../constants/redisKeys.js';
import { getSessionId } from '../utils/cookie.util.js';
import { ApiError } from '../http/ApiError.js';
import { Role } from '../constants/roles.js';

interface StoredSession {
  userId: string;
  role: Role;
  deviceId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

/**
 * Session-cookie → Redis lookup → req.auth.
 * Reads the opaque session id from the HttpOnly cookie, validates it against Redis
 * (the source of truth), and slides the TTL on each authenticated request.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      throw ApiError.unauthorized('No active session');
    }

    const key = redisKeys.session(sessionId);
    const raw = await redis.get(key);
    if (!raw) {
      // Cookie present but session gone (expired / revoked / tampered).
      throw ApiError.unauthorized('Session expired or revoked');
    }

    const session = JSON.parse(raw) as StoredSession;

    req.auth = {
      sessionId,
      userId: session.userId,
      role: session.role,
      deviceId: session.deviceId,
    };

    // Sliding expiry: extend TTL to keep active users logged in.
    await redis.expire(key, env.sessionTtlSeconds);

    next();
  } catch (err) {
    next(err);
  }
}
