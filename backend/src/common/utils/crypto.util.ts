import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/** Cryptographically-strong opaque session id (no JWT). 64 hex chars. */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Stable per-browser device id, issued once and stored in a long-lived cookie. */
export function generateDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** HMAC-SHA256 hash of an OTP. We never store the raw OTP anywhere. */
export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', env.otpHmacSecret).update(otp).digest('hex');
}

/** Constant-time comparison to avoid timing attacks on OTP / signature checks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verify an OTP against its stored HMAC hash in constant time. */
export function verifyOtpHash(otp: string, storedHash: string): boolean {
  return safeEqual(hashOtp(otp), storedHash);
}

/**
 * Verify a Razorpay payment signature: HMAC-SHA256(orderId|paymentId, keySecret).
 * Shared here so the payment module and any webhook handler use one implementation.
 */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}
