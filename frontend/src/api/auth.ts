import { api, unwrap } from '@/lib/axios'
import type { Session, User } from '@/types/models'

export function requestOtp(email: string) {
  return unwrap<{ cooldown: number }>(
    api.post('/auth/otp/request', { email }, { skipAuthRedirect: true }),
  )
}

export function resendOtp(email: string) {
  return unwrap<{ cooldown: number }>(
    api.post('/auth/otp/resend', { email }, { skipAuthRedirect: true }),
  )
}

export interface VerifyOtpInput {
  email: string
  otp: string
  deviceName?: string
  rememberDevice?: boolean
  /** After a 409 SESSION_LIMIT_EXCEEDED: sign out this session and retry */
  revokeSessionId?: string
}

export function verifyOtp(input: VerifyOtpInput) {
  return unwrap<{ user: User }>(api.post('/auth/otp/verify', input, { skipAuthRedirect: true }))
}

export function trustedLogin(email: string, revokeSessionId?: string) {
  return unwrap<{ user: User }>(
    api.post('/auth/login/trusted', { email, revokeSessionId }, { skipAuthRedirect: true }),
  )
}

/** Dev-only helper; the backend exposes this route only outside production. */
export function fetchDevOtp(email: string) {
  return unwrap<{ otp: string }>(
    api.get('/auth/dev/otp', { params: { email }, skipAuthRedirect: true }),
  )
}

export function getMe() {
  return unwrap<{ user: User; sessionId: string }>(
    api.get('/auth/me', { skipAuthRedirect: true }),
  )
}

export function logout() {
  return unwrap<Record<string, never>>(api.post('/auth/logout'))
}

export function logoutAll() {
  return unwrap<Record<string, never>>(api.post('/auth/logout-all'))
}

export function getSessions() {
  return unwrap<{ sessions: Session[] }>(api.get('/auth/sessions'))
}

export function revokeSession(sessionId: string) {
  return unwrap<Record<string, never>>(api.delete(`/auth/sessions/${sessionId}`))
}

export function heartbeat() {
  return unwrap<Record<string, never>>(api.post('/auth/session/heartbeat'))
}

// Mentor: manage a student's sessions
export function getStudentSessions(studentId: string) {
  return unwrap<{ sessions: Session[] }>(api.get(`/auth/admin/students/${studentId}/sessions`))
}

export function revokeStudentSession(studentId: string, sessionId: string) {
  return unwrap<Record<string, never>>(
    api.delete(`/auth/admin/students/${studentId}/sessions/${sessionId}`),
  )
}

export function revokeAllStudentSessions(studentId: string) {
  return unwrap<{ revoked: number }>(api.delete(`/auth/admin/students/${studentId}/sessions`))
}
