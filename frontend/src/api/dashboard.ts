import { api, unwrap } from '@/lib/axios'
import type { DateRangeParams } from '@/api/payments'

export interface DashboardSummary {
  courses: number
  publishedCourses: number
  students: number
  enrollments: number
  newEnrollments30d: number
}

export interface EnrollmentPoint {
  date: string
  enrollments: number
}

export interface CourseEngagement {
  courseId: string
  title: string
  enrolledStudents: number
  activeStudents: number
  /** 0-100, or null when the course has no playable lessons or no enrollments. */
  completionRate: number | null
}

export interface EngagementStats {
  activeLearners: number
  lessonsCompleted: number
  avgCompletionRate: number
  courses: CourseEngagement[]
}

export function getDashboardSummary() {
  return unwrap<{ summary: DashboardSummary }>(api.get('/dashboard/summary'))
}

export function getEnrollmentTimeseries(
  params: DateRangeParams & { interval?: 'day' | 'month' } = {},
) {
  return unwrap<{ points: EnrollmentPoint[]; interval: 'day' | 'month' }>(
    api.get('/dashboard/enrollments/timeseries', { params }),
  )
}

export function getEngagementStats(params: DateRangeParams = {}) {
  return unwrap<{ engagement: EngagementStats }>(api.get('/dashboard/engagement', { params }))
}
