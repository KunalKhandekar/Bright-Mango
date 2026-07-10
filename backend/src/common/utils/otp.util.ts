import crypto from 'node:crypto';

/** Generate a numeric 6-digit OTP (000000–999999) using a uniform CSPRNG draw. */
export function generateOtp(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/** Normalize emails consistently before any storage/lookup/hash. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
