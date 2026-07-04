import { api, unwrap } from '@/lib/axios'
import type { BlacklistEntry, Enrollment, User, UserDoc } from '@/types/models'

export function getProfile() {
  return unwrap<{ user: UserDoc }>(api.get('/users/me'))
}

export function updateProfile(input: { name?: string; avatar?: string }) {
  return unwrap<{ user: User }>(api.patch('/users/me', input))
}

export function createAvatarUploadUrl(input: { fileName: string; contentType: string }) {
  return unwrap<{ uploadUrl: string; fileKey: string; publicUrl: string }>(
    api.post('/users/me/avatar/upload-url', input),
  )
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export function listStudents(params: { search?: string; page?: number; limit?: number } = {}) {
  return unwrap<{ students: UserDoc[] }>(api.get('/users/students', { params }))
}

export function getStudent(id: string) {
  return unwrap<{ student: UserDoc }>(api.get(`/users/students/${id}`))
}

export function getStudentEnrollments(id: string) {
  return unwrap<{ enrollments: Enrollment[] }>(api.get(`/users/students/${id}/enrollments`))
}

export function banStudent(id: string) {
  return unwrap<Record<string, never>>(api.post(`/users/students/${id}/ban`))
}

export function unbanStudent(id: string) {
  return unwrap<Record<string, never>>(api.post(`/users/students/${id}/unban`))
}

export function listBlacklist() {
  return unwrap<{ entries: BlacklistEntry[] }>(api.get('/users/blacklist'))
}

export function blacklistEmail(input: { email: string; reason?: string }) {
  return unwrap<Record<string, never>>(api.post('/users/blacklist', input))
}

export function removeBlacklistedEmail(email: string) {
  return unwrap<Record<string, never>>(api.delete(`/users/blacklist/${encodeURIComponent(email)}`))
}
