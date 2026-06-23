import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { rateLimiter } from '../../common/middlewares/rateLimiter.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { normalizeEmail } from '../../common/utils/otp.util.js';
import { env } from '../../config/env.js';
import * as ctrl from './auth.controller.js';
import {
  requestOtpValidators,
  resendOtpValidators,
  verifyOtpValidators,
  trustedLoginValidators,
  sessionIdParamValidators,
  studentIdParamValidators,
  studentSessionParamValidators,
} from './auth.validation.js';

const router = Router();

// Per-email limiter for OTP issuance (on top of the per-IP global limiter).
const otpEmailLimiter = rateLimiter({
  prefix: 'otp-email',
  windowSeconds: 15 * 60,
  max: 5,
  keyBy: (req) => normalizeEmail(String(req.body?.email ?? 'unknown')),
  message: 'Too many OTP requests for this email. Try again later.',
});

const verifyLimiter = rateLimiter({
  prefix: 'otp-verify',
  windowSeconds: 15 * 60,
  max: 20,
  keyBy: (req) => normalizeEmail(String(req.body?.email ?? req.ip ?? 'unknown')),
});

// ── Public ──────────────────────────────────────────────────────────────────────
router.post('/otp/request', otpEmailLimiter, validate(requestOtpValidators), asyncHandler(ctrl.requestOtp));
router.post('/otp/resend', otpEmailLimiter, validate(resendOtpValidators), asyncHandler(ctrl.resendOtp));
router.post('/otp/verify', verifyLimiter, validate(verifyOtpValidators), asyncHandler(ctrl.verifyOtp));
router.post('/login/trusted', validate(trustedLoginValidators), asyncHandler(ctrl.trustedLogin));

// ── Dev only — never mounted in production ─────────────────────────────────────
if (env.nodeEnv !== 'production') {
  router.get('/dev/otp', asyncHandler(ctrl.devOtp));
}

// ── Protected (self) ──────────────────────────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(ctrl.me));
router.post('/logout', authenticate, asyncHandler(ctrl.logout));
router.post('/logout-all', authenticate, asyncHandler(ctrl.logoutAll));
router.get('/sessions', authenticate, asyncHandler(ctrl.listSessions));
router.delete(
  '/sessions/:sessionId',
  authenticate,
  validate(sessionIdParamValidators),
  asyncHandler(ctrl.revokeSession),
);
router.post('/session/heartbeat', authenticate, asyncHandler(ctrl.heartbeat));

// ── Mentor session management ──────────────────────────────────────────────────
router.get(
  '/admin/students/:studentId/sessions',
  authenticate,
  authorize(PERMISSIONS.SESSION_MANAGE),
  validate(studentIdParamValidators),
  asyncHandler(ctrl.listStudentSessions),
);
router.delete(
  '/admin/students/:studentId/sessions/:sessionId',
  authenticate,
  authorize(PERMISSIONS.SESSION_MANAGE),
  validate(studentSessionParamValidators),
  asyncHandler(ctrl.revokeStudentSession),
);
router.delete(
  '/admin/students/:studentId/sessions',
  authenticate,
  authorize(PERMISSIONS.SESSION_MANAGE),
  validate(studentIdParamValidators),
  asyncHandler(ctrl.revokeAllStudentSessions),
);

export default router;
