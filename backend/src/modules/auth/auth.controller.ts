import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { HttpStatus } from '../../common/http/httpStatus.js';
import { RequestContext } from '../../common/types/common.types.js';
import {
  setSessionCookie,
  clearSessionCookie,
  setDeviceCookie,
  getDeviceId,
} from '../../common/utils/cookie.util.js';
import * as authService from './auth.service.js';
import * as sessionService from './session.service.js';
import { VerifyOtpResult } from './auth.types.js';

/** Derive ip / user-agent / device context from the request. */
function requestContext(req: Request): RequestContext {
  return {
    ip: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
    deviceId: getDeviceId(req),
    deviceName: typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined,
  };
}

/** Shared handler for verify / trusted-login results (issues cookies or 409). */
function sendAuthResult(res: Response, result: VerifyOtpResult): Response {
  if (result.kind === 'session_limit') {
    throw ApiError.conflict(
      ErrorCode.SESSION_LIMIT_EXCEEDED,
      'Maximum active sessions reached. Log out of another device to continue.',
      { activeSessions: result.activeSessions },
    );
  }

  setSessionCookie(res, result.session.sessionId);
  setDeviceCookie(res, result.session.deviceId);
  return new ApiResponse(HttpStatus.OK, 'Logged in successfully', {
    user: result.user,
  }).send(res);
}

// ── Public ──────────────────────────────────────────────────────────────────────

export async function requestOtp(req: Request, res: Response): Promise<Response> {
  const data = await authService.requestOtp(req.body.email, requestContext(req));
  return ApiResponse.ok(res, 'OTP sent to your email', data);
}

export async function resendOtp(req: Request, res: Response): Promise<Response> {
  const data = await authService.resendOtp(req.body.email, requestContext(req));
  return ApiResponse.ok(res, 'OTP resent', data);
}

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.verifyOtp(req.body.email, req.body.otp, {
    ...requestContext(req),
    rememberDevice: req.body.rememberDevice === true,
    revokeSessionId:
      typeof req.body.revokeSessionId === 'string' ? req.body.revokeSessionId : undefined,
  });
  return sendAuthResult(res, result);
}

export async function trustedLogin(req: Request, res: Response): Promise<Response> {
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    throw ApiError.unauthorized('No trusted device', ErrorCode.TRUSTED_DEVICE_INVALID);
  }
  const result = await authService.loginWithTrustedDevice(req.body.email, deviceId, {
    ...requestContext(req),
    revokeSessionId:
      typeof req.body.revokeSessionId === 'string' ? req.body.revokeSessionId : undefined,
  });
  return sendAuthResult(res, result);
}

// ── Dev only ──────────────────────────────────────────────────────────────────────

/** Returns the last OTP for an email so local testing doesn't need real email. */
export async function devOtp(req: Request, res: Response): Promise<Response> {
  const email = typeof req.query.email === 'string' ? req.query.email : '';
  if (!email) throw ApiError.badRequest(ErrorCode.VALIDATION_ERROR, 'email query param required');
  const otp = await authService.getDevOtp(email);
  if (!otp) throw ApiError.notFound('No OTP found — request one first');
  return ApiResponse.ok(res, 'Dev OTP', { otp });
}

// ── Protected (self) ──────────────────────────────────────────────────────────────

export async function me(req: Request, res: Response): Promise<Response> {
  const user = await authService.getCurrentUser(req.auth!.userId);
  return ApiResponse.ok(res, 'Current user', { user, sessionId: req.auth!.sessionId });
}

export async function logout(req: Request, res: Response): Promise<Response> {
  await sessionService.revokeSession(req.auth!.sessionId, req.auth!.userId);
  clearSessionCookie(res);
  return ApiResponse.ok(res, 'Logged out');
}

export async function logoutAll(req: Request, res: Response): Promise<Response> {
  await sessionService.destroyAllSessions(req.auth!.userId);
  clearSessionCookie(res);
  return ApiResponse.ok(res, 'Logged out of all devices');
}

export async function listSessions(req: Request, res: Response): Promise<Response> {
  const sessions = await sessionService.getActiveSessions(req.auth!.userId, req.auth!.sessionId);
  return ApiResponse.ok(res, 'Active sessions', { sessions });
}

export async function revokeSession(req: Request, res: Response): Promise<Response> {
  const { sessionId } = req.params;
  const owned = await sessionService.sessionBelongsToUser(sessionId, req.auth!.userId);
  if (!owned) {
    throw ApiError.notFound('Session not found', ErrorCode.SESSION_NOT_FOUND);
  }
  await sessionService.revokeSession(sessionId, req.auth!.userId);
  // If revoking the current session, clear the cookie too.
  if (sessionId === req.auth!.sessionId) clearSessionCookie(res);
  return ApiResponse.ok(res, 'Session revoked');
}

export async function heartbeat(req: Request, res: Response): Promise<Response> {
  await sessionService.touchSession(req.auth!.sessionId);
  return ApiResponse.ok(res, 'Session refreshed');
}

// ── Mentor session management ──────────────────────────────────────────────────

export async function listStudentSessions(req: Request, res: Response): Promise<Response> {
  const sessions = await sessionService.getActiveSessions(req.params.studentId);
  return ApiResponse.ok(res, 'Student sessions', { sessions });
}

export async function revokeStudentSession(req: Request, res: Response): Promise<Response> {
  const { studentId, sessionId } = req.params;
  const owned = await sessionService.sessionBelongsToUser(sessionId, studentId);
  if (!owned) throw ApiError.notFound('Session not found', ErrorCode.SESSION_NOT_FOUND);
  await sessionService.revokeSession(sessionId, studentId);
  return ApiResponse.ok(res, 'Student session revoked');
}

export async function revokeAllStudentSessions(req: Request, res: Response): Promise<Response> {
  const count = await sessionService.destroyAllSessions(req.params.studentId);
  return ApiResponse.ok(res, 'Student logged out of all devices', { revoked: count });
}
