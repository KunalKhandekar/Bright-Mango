import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { redisKeys } from '../../common/constants/redisKeys.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { generateOtp, normalizeEmail } from '../../common/utils/otp.util.js';
import { hashOtp, verifyOtpHash } from '../../common/utils/crypto.util.js';

interface StoredActionOtp {
  otpHash: string;
  attempts: number;
}

/**
 * Generic action-confirmation OTP (e.g. confirming a course deletion), distinct from the
 * login OTP. Keyed by purpose so multiple pending confirmations don't collide.
 * Returns the raw OTP so the caller can enqueue delivery.
 */
export async function requestActionOtp(rawEmail: string, purpose: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const otp = generateOtp();
  const record: StoredActionOtp = { otpHash: hashOtp(otp), attempts: 0 };
  await redis.set(redisKeys.otpAction(purpose, email), JSON.stringify(record), 'EX', env.otpTtlSeconds);
  return otp;
}

/** Verify (and consume) an action OTP. Throws typed OTP errors on failure. */
export async function verifyActionOtp(rawEmail: string, purpose: string, otp: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const key = redisKeys.otpAction(purpose, email);
  const raw = await redis.get(key);
  if (!raw) {
    throw ApiError.badRequest(ErrorCode.OTP_EXPIRED, 'Confirmation code expired or never requested');
  }

  const record = JSON.parse(raw) as StoredActionOtp;
  if (verifyOtpHash(otp, record.otpHash)) {
    await redis.del(key);
    return;
  }

  const attempts = record.attempts + 1;
  if (attempts >= env.otpMaxAttempts) {
    await redis.del(key);
    throw ApiError.badRequest(ErrorCode.OTP_MAX_ATTEMPTS, 'Too many incorrect attempts');
  }
  await redis.set(key, JSON.stringify({ ...record, attempts }), 'KEEPTTL');
  throw ApiError.badRequest(ErrorCode.OTP_INVALID, 'Incorrect confirmation code');
}
