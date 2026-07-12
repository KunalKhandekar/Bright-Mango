import { api, unwrap } from '@/lib/axios'
import type { Course } from '@/types/models'

export function listPublishedCourses(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ courses: Course[] }>(api.get('/courses', { params }))
}

export function getCourseBySlug(slug: string) {
  return unwrap<{ course: Course }>(api.get(`/courses/${slug}`))
}

/** Minimal course header info by id (used by the student lesson viewer). */
export function getCourseMeta(id: string) {
  return unwrap<{ course: Pick<Course, '_id' | 'title' | 'slug' | 'status'> }>(
    api.get(`/courses/id/${id}`),
  )
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
  thumbnailKey?: string
}

export function createCourseThumbnailUploadUrl(input: { fileName: string; contentType: string }) {
  return unwrap<{ uploadUrl: string; thumbnailKey: string; publicUrl: string }>(
    api.post('/courses/thumbnail/upload-url', input),
  )
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
  return unwrap<{ delayMinutes: number }>(api.post(`/courses/${id}/delete/request`))
}

export function confirmCourseDeletion(id: string, otp: string) {
  return unwrap<{ executeAt: string }>(api.post(`/courses/${id}/delete/confirm`, { otp }))
}

export function cancelCourseDeletion(id: string) {
  return unwrap<Record<string, never>>(api.post(`/courses/${id}/delete/cancel`))
}
