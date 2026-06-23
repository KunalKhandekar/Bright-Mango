/**
 * Central Redis key builders. Never inline key strings elsewhere — use these so the
 * key layout stays consistent and is trivial to audit/migrate.
 */
export const redisKeys = {
  /** OTP record: { otpHash, attempts, requestedAt }. TTL = otpTtlSeconds. */
  otp: (email: string) => `otp:${email}`,

  /** Resend cooldown flag. TTL = otpResendCooldownSeconds. */
  otpCooldown: (email: string) => `otp:cooldown:${email}`,

  /** Action-confirmation OTP (e.g. course deletion), scoped by purpose. */
  otpAction: (purpose: string, email: string) => `otp:action:${purpose}:${email}`,

  /** Session record: { userId, role, deviceId, ip, userAgent, createdAt }. TTL = sessionTtlSeconds. */
  session: (sessionId: string) => `session:${sessionId}`,

  /** Redis SET of a user's active session ids. */
  userSessions: (userId: string) => `user_sessions:${userId}`,

  /** Trusted-device flag to skip OTP. TTL = trustedDeviceTtlSeconds. */
  trustedDevice: (userId: string, deviceId: string) => `trusted_device:${userId}:${deviceId}`,

  /** Rate-limit counters. */
  rlOtpByIp: (ip: string) => `rl:otp:ip:${ip}`,
  rlOtpByEmail: (email: string) => `rl:otp:email:${email}`,
} as const;
