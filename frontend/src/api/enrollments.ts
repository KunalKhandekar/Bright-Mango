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

export interface AdminEnrollment extends Omit<Enrollment, 'studentId' | 'courseId'> {
  studentId: { _id: string; name?: string; email: string; avatar?: string }
  courseId: { _id: string; title: string; slug: string }
  progressPercentage: number
}

export interface EnrollmentStats {
  total: number
  byCourse: Array<{ courseId: string; title: string; count: number }>
}

export function listAdminEnrollments(
  params: { courseId?: string; search?: string; page?: number; limit?: number } = {},
) {
  return unwrap<{ enrollments: AdminEnrollment[] }>(api.get('/enrollments', { params }))
}

export function getEnrollmentStats() {
  return unwrap<EnrollmentStats>(api.get('/enrollments/stats'))
}

export function enrollManually(input: { email: string; courseId: string }) {
  return unwrap<{ enrollment: Enrollment }>(api.post('/enrollments/manual', input))
}

export function revokeEnrollment(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/enrollments/${id}`))
}
