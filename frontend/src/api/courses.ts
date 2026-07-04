import { api, unwrap } from '@/lib/axios'
import type { Course } from '@/types/models'

export function listPublishedCourses(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ courses: Course[] }>(api.get('/courses', { params }))
}

export function getCourseBySlug(slug: string) {
  return unwrap<{ course: Course }>(api.get(`/courses/${slug}`))
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export function listMyCourses(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ courses: Course[] }>(api.get('/courses/admin/mine', { params }))
}

export function getAdminCourse(id: string) {
  return unwrap<{ course: Course }>(api.get(`/courses/admin/${id}`))
}

export interface CourseInput {
  title: string
  /** paise */
  price: number
  shortDescription?: string
  description?: string
  thumbnailUrl?: string
}

export function createCourse(input: CourseInput) {
  return unwrap<{ course: Course }>(api.post('/courses', input))
}

export function updateCourse(id: string, input: Partial<CourseInput & { slug: string }>) {
  return unwrap<{ course: Course }>(api.patch(`/courses/${id}`, input))
}

export function publishCourse(id: string) {
  return unwrap<{ course: Course }>(api.post(`/courses/${id}/publish`))
}

export function requestCourseDeletion(id: string) {
  return unwrap<Record<string, never>>(api.post(`/courses/${id}/delete/request`))
}

export function confirmCourseDeletion(id: string, otp: string) {
  return unwrap<{ executeAt: string }>(api.post(`/courses/${id}/delete/confirm`, { otp }))
}

export function cancelCourseDeletion(id: string) {
  return unwrap<Record<string, never>>(api.post(`/courses/${id}/delete/cancel`))
}
