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
  auditLogs: (filters: { action?: string; entityType?: string; page: number }) =>
    ['admin', 'audit', filters] as const,
}
