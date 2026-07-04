import { isApiError, type ErrorCode } from '@/types/api'

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  VALIDATION_ERROR: 'Some fields are invalid. Please review and try again.',
  NOT_FOUND: 'That resource could not be found.',
  RATE_LIMITED: 'Too many requests — please wait a moment and try again.',
  OTP_RATE_LIMITED: 'Too many OTP requests. Please wait before requesting another code.',
  OTP_NOT_REQUESTED: 'No code was requested for this email. Request a new one.',
  OTP_EXPIRED: 'That code has expired. Request a new one.',
  OTP_INVALID: 'Incorrect code. Please check and try again.',
  OTP_MAX_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
  EMAIL_BLACKLISTED: 'This email address is not allowed to sign up.',
  ACCOUNT_BANNED: 'This account has been suspended. Contact support for help.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that.",
  SESSION_LIMIT_EXCEEDED: "You're signed in on too many devices.",
  SESSION_NOT_FOUND: 'That session no longer exists.',
  TRUSTED_DEVICE_INVALID: 'This device is no longer trusted. Sign in with a code.',
  ALREADY_ENROLLED: "You're already enrolled in this course.",
  PAYMENT_VERIFICATION_FAILED: "We couldn't confirm your payment yet.",
  COUPON_INVALID: 'This coupon code is invalid or has expired.',
  ACCESS_NOT_ENROLLED: 'Enroll in this course to access its content.',
  COURSE_NOT_PUBLISHABLE: 'Add at least one lesson before publishing this course.',
  VIDEO_NOT_READY: 'This video is still processing. Check back shortly.',
  INTEGRATION_NOT_CONFIGURED: 'This feature is not available right now.',
}

/** Friendly message for any error, preferring our copy over the server's. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(error)) {
    return MESSAGES[error.errorCode] ?? error.message ?? fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
