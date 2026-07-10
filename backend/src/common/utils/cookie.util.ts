import { CookieOptions, Response, Request } from 'express';
import { env } from '../../config/env.js';

const DEVICE_COOKIE = 'bm_device';
const DEVICE_TTL_MS = env.trustedDeviceTtlSeconds * 1000;

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    domain: env.isProd ? env.cookieDomain : undefined,
    path: '/',
  };
}

/** Set the HttpOnly session cookie. TTL matches the Redis session TTL. */
export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(env.cookieName, sessionId, {
    ...baseCookieOptions(),
    maxAge: env.sessionTtlSeconds * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.cookieName, baseCookieOptions());
}

export function getSessionId(req: Request): string | undefined {
  return req.cookies?.[env.cookieName];
}

/** Persist a stable device id cookie (used for trusted-device login). */
export function setDeviceCookie(res: Response, deviceId: string): void {
  res.cookie(DEVICE_COOKIE, deviceId, {
    ...baseCookieOptions(),
    maxAge: DEVICE_TTL_MS,
  });
}

export function getDeviceId(req: Request): string | undefined {
  return req.cookies?.[DEVICE_COOKIE];
}
