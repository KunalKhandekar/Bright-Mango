import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { redisKeys } from '../../common/constants/redisKeys.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { generateOtp, normalizeEmail } from '../../common/utils/otp.util.js';
import { hashOtp, verifyOtpHash } from '../../common/utils/crypto.util.js';
import { RequestContext } from '../../common/types/common.types.js';
import { ROLES } from '../../common/constants/roles.js';
import {
  isEmailBlacklisted,
  resolveOrCreateStudent,
  getDefaultMentor,
  findById,
  markLoggedIn,
} from '../user/user.service.js';
import { enqueueEmail } from '../../jobs/queues.js';
import {
  createSession,
  isSessionLimitReached,
  getActiveSessions,
  markTrustedDevice,
  isTrustedDevice,
} from './session.service.js';
import { PublicUser, VerifyOtpResult } from './auth.types.js';
import type { UserDoc } from '../user/user.model.js';

interface StoredOtp {
  otpHash: string;
  attempts: number;
  requestedAt: string;
}

function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name ?? '',
    avatar: user.avatar ?? '',
    role: user.role,
    emailVerified: user.emailVerified ?? false,
    status: user.status ?? 'active',
  };
}

/** Guard: blacklist + banned checks shared by request and verify. */
async function assertEmailAllowed(email: string): Promise<void> {
  if (await isEmailBlacklisted(email)) {
    throw ApiError.forbidden('This email is not allowed', ErrorCode.EMAIL_BLACKLISTED);
  }
}

// ── OTP request / resend ────────────────────────────────────────────────────────

/**
 * Generate + store an OTP and enqueue the delivery email. Enforces a per-email resend
 * cooldown on top of the route-level IP/email rate limits.
 */
export async function requestOtp(rawEmail: string, _ctx: RequestContext): Promise<{ cooldown: number }> {
  const email = normalizeEmail(rawEmail);
  await assertEmailAllowed(email);

  const cooldownKey = redisKeys.otpCooldown(email);
  if (await redis.exists(cooldownKey)) {
    const ttl = await redis.ttl(cooldownKey);
    throw new ApiError(
      429,
      ErrorCode.OTP_RATE_LIMITED,
      `Please wait ${ttl}s before requesting another code`,
    );
  }

  const otp = generateOtp();
  const record: StoredOtp = {
    otpHash: hashOtp(otp),
    attempts: 0,
    requestedAt: new Date().toISOString(),
  };

  await redis.set(redisKeys.otp(email), JSON.stringify(record), 'EX', env.otpTtlSeconds);
  await redis.set(cooldownKey, '1', 'EX', env.otpResendCooldownSeconds);

  await enqueueEmail({
    type: 'otp',
    to: email,
    otp,
    ttlMinutes: Math.round(env.otpTtlSeconds / 60),
  });

  return { cooldown: env.otpResendCooldownSeconds };
}

export async function resendOtp(email: string, ctx: RequestContext): Promise<{ cooldown: number }> {
  // Same path — cooldown guard in requestOtp prevents abuse.
  return requestOtp(email, ctx);
}

// ── OTP verify ───────────────────────────────────────────────────────────────────

/**
 * Verify an OTP and, on success, create a session (unless the session limit blocks it).
 * Edge cases all map to typed ApiErrors:
 *   OTP_NOT_REQUESTED / OTP_EXPIRED / OTP_INVALID / OTP_MAX_ATTEMPTS / EMAIL_BLACKLISTED /
 *   ACCOUNT_BANNED / SESSION_LIMIT_EXCEEDED.
 */
export async function verifyOtp(
  rawEmail: string,
  otp: string,
  ctx: RequestContext & { rememberDevice?: boolean },
): Promise<VerifyOtpResult> {
  const email = normalizeEmail(rawEmail);
  await assertEmailAllowed(email);

  const otpKey = redisKeys.otp(email);
  const raw = await redis.get(otpKey);
  if (!raw) {
    throw ApiError.badRequest(ErrorCode.OTP_EXPIRED, 'Code expired or never requested');
  }

  const record = JSON.parse(raw) as StoredOtp;

  if (verifyOtpHash(otp, record.otpHash)) {
    // Correct — consume the OTP immediately to prevent replay.
    await redis.del(otpKey);
  } else {
    const attempts = record.attempts + 1;
    if (attempts >= env.otpMaxAttempts) {
      await redis.del(otpKey);
      throw ApiError.badRequest(
        ErrorCode.OTP_MAX_ATTEMPTS,
        'Too many incorrect attempts. Please request a new code.',
      );
    }
    // Preserve TTL while bumping the attempt counter.
    await redis.set(otpKey, JSON.stringify({ ...record, attempts }), 'KEEPTTL');
    throw ApiError.badRequest(ErrorCode.OTP_INVALID, 'Incorrect code');
  }

  // Resolve mentor + student account.
  const mentor = await getDefaultMentor();
  if (!mentor) {
    throw ApiError.internal('No mentor configured. Run the mentor seed first.');
  }
  const { user } = await resolveOrCreateStudent(email, mentor._id);

  if (user.status === 'banned') {
    throw ApiError.forbidden('This account has been suspended', ErrorCode.ACCOUNT_BANNED);
  }

  // Session limit (students only).
  if (await isSessionLimitReached(user._id.toString(), user.role)) {
    const activeSessions = await getActiveSessions(user._id.toString());
    return { kind: 'session_limit', activeSessions };
  }

  const session = await createSession(user._id, user.role, ctx);
  await markLoggedIn(user._id);

  if (ctx.rememberDevice) {
    await markTrustedDevice(user._id.toString(), session.deviceId);
  }

  return { kind: 'session', user: toPublicUser(user), session };
}

// ── Trusted-device login (skip OTP) ────────────────────────────────────────────

/**
 * Create a session without OTP when the browser presents a device id trusted within the
 * trusted-device window. Falls back (throws TRUSTED_DEVICE_INVALID) so the client can
 * start the normal OTP flow.
 */
export async function loginWithTrustedDevice(
  rawEmail: string,
  deviceId: string,
  ctx: RequestContext,
): Promise<VerifyOtpResult> {
  const email = normalizeEmail(rawEmail);
  await assertEmailAllowed(email);

  const mentor = await getDefaultMentor();
  if (!mentor) throw ApiError.internal('No mentor configured');

  const { user } = await resolveOrCreateStudent(email, mentor._id);

  if (user.status === 'banned') {
    throw ApiError.forbidden('This account has been suspended', ErrorCode.ACCOUNT_BANNED);
  }

  if (!(await isTrustedDevice(user._id.toString(), deviceId))) {
    throw ApiError.unauthorized('Device not trusted, OTP required', ErrorCode.TRUSTED_DEVICE_INVALID);
  }

  if (await isSessionLimitReached(user._id.toString(), user.role)) {
    const activeSessions = await getActiveSessions(user._id.toString());
    return { kind: 'session_limit', activeSessions };
  }

  const session = await createSession(user._id, user.role, { ...ctx, deviceId });
  await markLoggedIn(user._id);
  await markTrustedDevice(user._id.toString(), deviceId); // refresh window

  return { kind: 'session', user: toPublicUser(user), session };
}

// ── Current user ────────────────────────────────────────────────────────────────

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findById(userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status === 'banned') {
    throw ApiError.forbidden('This account has been suspended', ErrorCode.ACCOUNT_BANNED);
  }
  return toPublicUser(user);
}

export { ROLES };
