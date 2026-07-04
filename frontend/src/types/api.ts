export interface Meta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface Envelope<T> {
  success: true
  statusCode: number
  message: string
  data: T
  meta?: Meta
}

export interface ErrorEnvelope {
  success: false
  statusCode: number
  errorCode: string
  message: string
  details?: unknown
}

export type ErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'OTP_RATE_LIMITED'
  | 'OTP_NOT_REQUESTED'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_MAX_ATTEMPTS'
  | 'EMAIL_BLACKLISTED'
  | 'ACCOUNT_BANNED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'SESSION_LIMIT_EXCEEDED'
  | 'SESSION_NOT_FOUND'
  | 'TRUSTED_DEVICE_INVALID'
  | 'ALREADY_ENROLLED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'COUPON_INVALID'
  | 'ACCESS_NOT_ENROLLED'
  | 'OWNERSHIP_REQUIRED'
  | 'COURSE_NOT_PUBLISHABLE'
  | 'VIDEO_NOT_READY'
  | 'ORDER_NOT_FOUND'
  | 'INTEGRATION_NOT_CONFIGURED'
  | 'NETWORK_ERROR'

export interface ValidationDetail {
  field: string
  message: string
}

export class ApiError extends Error {
  statusCode: number
  errorCode: ErrorCode
  details?: unknown

  constructor(statusCode: number, errorCode: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.details = details
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  if (!(error instanceof ApiError)) return false
  return code ? error.errorCode === code : true
}
