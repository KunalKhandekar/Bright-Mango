import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/types/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry deliberate API errors (4xx semantics); retry transient issues twice.
        if (isApiError(error) && error.statusCode > 0 && error.statusCode < 500) return false
        return failureCount < 2
      },
    },
  },
})

export const keys = {
  me: ['me'] as const,
  sessions: ['sessions'] as const,
  courses: (page: number) => ['courses', { page }] as const,
  course: (slug: string) => ['course', slug] as const,
  courseMeta: (courseId: string) => ['course', 'meta', courseId] as const,
  chapters: (courseId: string) => ['chapters', courseId] as const,
  lessonsByCourse: (courseId: string) => ['lessons', courseId] as const,
  playback: (lessonId: string) => ['playback', lessonId] as const,
  lessonResources: (lessonId: string) => ['lesson-resources', lessonId] as const,
  myEnrollments: (page?: number) => ['enrollments', 'me', { page }] as const,
  enrollmentAccess: (courseId: string) => ['enrollments', 'access', courseId] as const,
  myOrders: ['orders', 'me'] as const,
  courseProgress: (courseId: string) => ['progress', 'course', courseId] as const,
  recentProgress: ['progress', 'recent'] as const,
  lessonComments: (lessonId: string, page: number) =>
    ['comments', 'lesson', lessonId, { page }] as const,
  commentReplies: (commentId: string) => ['comments', 'replies', commentId] as const,
  // admin
  adminCourses: (page: number) => ['admin', 'courses', { page }] as const,
  adminCourse: (id: string) => ['admin', 'course', id] as const,
  adminStudents: (search: string, page: number) =>
    ['admin', 'students', { search, page }] as const,
  adminStudent: (id: string) => ['admin', 'student', id] as const,
  adminStudentEnrollments: (id: string) => ['admin', 'student', id, 'enrollments'] as const,
  adminStudentSessions: (id: string) => ['admin', 'student', id, 'sessions'] as const,
  coupons: ['coupons'] as const,
  recentComments: (page: number) => ['admin', 'comments', { page }] as const,
  campaigns: (page: number) => ['admin', 'campaigns', { page }] as const,
  campaign: (id: string) => ['admin', 'campaign', id] as const,
  auditLogs: (filters: {
    action?: string
    entityType?: string
    from?: string
    to?: string
    page: number
  }) => ['admin', 'audit', filters] as const,
  auditFilterOptions: ['admin', 'audit', 'options'] as const,
  emailTemplates: (page: number) => ['admin', 'email-templates', { page }] as const,
  emailTemplate: (id: string) => ['admin', 'email-template', id] as const,
  emailProcesses: ['admin', 'email-processes'] as const,
  adminEnrollments: (filters: { courseId?: string; search?: string; page: number }) =>
    ['admin', 'enrollments', filters] as const,
  adminEnrollmentStats: ['admin', 'enrollments', 'stats'] as const,
  adminPaymentsSummary: (range: { from?: string; to?: string }) =>
    ['admin', 'payments', 'summary', range] as const,
  adminRevenueByCourse: (range: { from?: string; to?: string }) =>
    ['admin', 'payments', 'by-course', range] as const,
  adminRevenueSeries: (range: { from?: string; to?: string }, interval: string) =>
    ['admin', 'payments', 'series', range, interval] as const,
  adminOrders: (filters: { status?: string; page: number }) =>
    ['admin', 'payments', 'orders', filters] as const,
}
