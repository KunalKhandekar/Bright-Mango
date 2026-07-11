/**
 * Loads and validates environment variables once at boot.
 * Fail-fast: if a required variable is missing the process exits before serving traffic.
 */
import 'dotenv/config';

type EnvName = 'development' | 'production' | 'test';

function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    // eslint-disable-next-line no-console
    console.error(`[env] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function int(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function bool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function list(key: string): string[] {
  const value = process.env[key];
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development') as EnvName,
  isProd: optional('NODE_ENV', 'development') === 'production',
  port: int('PORT', 4000),
  apiPrefix: optional('API_PREFIX', '/api/v1'),
  corsOrigins: list('CORS_ORIGINS'),
  webAppUrl: optional(
    'WEB_APP_URL',
    optional('NODE_ENV', 'development') === 'production'
      ? 'https://app.brightmango.in'
      : 'http://localhost:3000',
  ),

  mongoUri: required('MONGODB_URI'),
  redisUrl: required('REDIS_URL'),

  otpHmacSecret: required('OTP_HMAC_SECRET'),
  cookieName: optional('COOKIE_NAME', 'bm_session'),
  cookieDomain: optional('COOKIE_DOMAIN', 'localhost'),

  sessionTtlSeconds: int('SESSION_TTL_DAYS', 7) * 24 * 60 * 60,
  otpTtlSeconds: int('OTP_TTL_SECONDS', 300),
  otpResendCooldownSeconds: int('OTP_RESEND_COOLDOWN_SECONDS', 60),
  otpMaxAttempts: int('OTP_MAX_ATTEMPTS', 5),
  studentMaxSessions: int('STUDENT_MAX_SESSIONS', 2),
  trustedDeviceTtlSeconds: int('TRUSTED_DEVICE_TTL_DAYS', 7) * 24 * 60 * 60,

  seedMentorEmail: optional('SEED_MENTOR_EMAIL', 'mentor@brightmango.in'),
  seedMentorName: optional('SEED_MENTOR_NAME', 'BrightMango Mentor'),

  otpBypass: {
    enabled: bool('MENTOR_OTP_BYPASS_ENABLED', false),
    masterOtp: optional('MENTOR_MASTER_OTP', ''),
    demoStudentEmail: optional('DEMO_STUDENT_EMAIL', ''),
  },

  mail: {
    from: optional(
      'MAIL_FROM',
      'BrightMango <no-reply@brightmango.in>',
    ),
  },

  resend: {
    apiKey: optional('RESEND_API_KEY', ''),
  },

  razorpay: {
    keyId: optional('RAZORPAY_KEY_ID', ''),
    keySecret: optional('RAZORPAY_KEY_SECRET', ''),
    webhookSecret: optional('RAZORPAY_WEBHOOK_SECRET', ''),
  },

  r2: {
    accountId: optional('R2_ACCOUNT_ID', ''),
    accessKeyId: optional('R2_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY', ''),
    bucket: optional('R2_BUCKET', 'brightmango-assets'),
    publicBaseUrl: optional('R2_PUBLIC_BASE_URL', ''),
  },

  stream: {
    accountId: optional('CF_STREAM_ACCOUNT_ID', ''),
    apiToken: optional('CF_STREAM_API_TOKEN', ''),
    signingKeyId: optional('CF_STREAM_SIGNING_KEY_ID', ''),
    signingKeyPem: optional('CF_STREAM_SIGNING_KEY_PEM', ''),
  },

  runInlineWorkers: (process.env.RUN_INLINE_WORKERS ?? 'true') !== 'false',
} as const;
