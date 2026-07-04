import { api, unwrap } from '@/lib/axios'
import type { Enrollment } from '@/types/models'

export function listMyEnrollments(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ enrollments: Enrollment[] }>(api.get('/enrollments/me', { params }))
}

export function getMyEnrollmentForCourse(courseId: string) {
  return unwrap<{ enrollment: Enrollment | null; hasAccess: boolean }>(
    api.get(`/enrollments/me/${courseId}`),
  )
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export function enrollManually(input: { email: string; courseId: string }) {
  return unwrap<{ enrollment: Enrollment }>(api.post('/enrollments/manual', input))
}

export function revokeEnrollment(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/enrollments/${id}`))
}
