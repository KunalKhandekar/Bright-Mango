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
  revokeSession,
  sessionBelongsToUser,
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

/** Normalized set of emails eligible for the master-OTP bypass (empties dropped). */
function bypassEmails(): Set<string> {
  return new Set(
    [env.seedMentorEmail, env.otpBypass.demoStudentEmail]
      .filter(Boolean)
      .map((e) => normalizeEmail(e)),
  );
}

/** Whether OTP issuance should be skipped for this (already-normalized) email. */
function isBypassEmail(email: string): boolean {
  return env.otpBypass.enabled && bypassEmails().has(email);
}

/** Whether this (email, otp) pair is a valid master-OTP login. */
function isMasterOtpLogin(email: string, otp: string): boolean {
  return (
    env.otpBypass.enabled &&
    env.otpBypass.masterOtp !== '' &&
    otp === env.otpBypass.masterOtp &&
    bypassEmails().has(email)
  );
}

// ── OTP request / resend ────────────────────────────────────────────────────────

/**
 * Generate + store an OTP and enqueue the delivery email. Enforces a per-email resend
 * cooldown on top of the route-level IP/email rate limits.
 */
export async function requestOtp(rawEmail: string, _ctx: RequestContext): Promise<{ cooldown: number }> {
  const email = normalizeEmail(rawEmail);
  await assertEmailAllowed(email);

  if (isBypassEmail(email)) {
    return { cooldown: 0 };
  }

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

  // DEV ONLY: stash the plaintext OTP so the dev-only /auth/dev/otp route can return it
  // for local testing. This key is never written in production.
  if (!env.isProd) {
    await redis.set(redisKeys.otpDev(email), otp, 'EX', env.otpTtlSeconds);
  }

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
  ctx: RequestContext & { rememberDevice?: boolean; revokeSessionId?: string },
): Promise<VerifyOtpResult> {
  const email = normalizeEmail(rawEmail);
  await assertEmailAllowed(email);

  const bypass = isMasterOtpLogin(email, otp);

  let otpKey = '';
  if (!bypass) {
    otpKey = redisKeys.otp(email);
    const raw = await redis.get(otpKey);
    if (!raw) {
      throw ApiError.badRequest(ErrorCode.OTP_EXPIRED, 'Code expired or never requested');
    }

    const record = JSON.parse(raw) as StoredOtp;

    if (!verifyOtpHash(otp, record.otpHash)) {
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

  // After a prior SESSION_LIMIT_EXCEEDED response the client may retry with a
  // session the user chose to sign out; revoke it (ownership-checked) first.
  const userId = user._id.toString();
  if (ctx.revokeSessionId && (await sessionBelongsToUser(ctx.revokeSessionId, userId))) {
    await revokeSession(ctx.revokeSessionId, userId);
  }

  // Session limit (students only). The OTP is intentionally NOT consumed yet so
  // the same code can be retried with `revokeSessionId` (still TTL/attempt-bound).
  if (await isSessionLimitReached(userId, user.role)) {
    const activeSessions = await getActiveSessions(userId);
    return { kind: 'session_limit', activeSessions };
  }

  // Login succeeds — consume the OTP now to prevent replay (no-op for the bypass path).
  if (!bypass && otpKey) await redis.del(otpKey);

  const session = await createSession(user._id, user.role, ctx);
  await markLoggedIn(user._id);

  if (ctx.rememberDevice) {
    await markTrustedDevice(userId, session.deviceId);
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
  ctx: RequestContext & { revokeSessionId?: string },
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

  // Same retry contract as verifyOtp: revoke a user-chosen session after a 409.
  const userId = user._id.toString();
  if (ctx.revokeSessionId && (await sessionBelongsToUser(ctx.revokeSessionId, userId))) {
    await revokeSession(ctx.revokeSessionId, userId);
  }

  if (await isSessionLimitReached(userId, user.role)) {
    const activeSessions = await getActiveSessions(userId);
    return { kind: 'session_limit', activeSessions };
  }

  const session = await createSession(user._id, user.role, { ...ctx, deviceId });
  await markLoggedIn(user._id);
  await markTrustedDevice(user._id.toString(), deviceId); // refresh window

  return { kind: 'session', user: toPublicUser(user), session };
}

// ── Current user ────────────────────────────────────────────────────────────────

/** DEV ONLY — fetch the last plaintext OTP for an email (local testing convenience). */
export async function getDevOtp(rawEmail: string): Promise<string | null> {
  if (env.isProd) return null;
  return redis.get(redisKeys.otpDev(normalizeEmail(rawEmail)));
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findById(userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status === 'banned') {
    throw ApiError.forbidden('This account has been suspended', ErrorCode.ACCOUNT_BANNED);
  }
  return toPublicUser(user);
}

export { ROLES };
