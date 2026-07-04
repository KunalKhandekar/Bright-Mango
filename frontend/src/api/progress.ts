import { api, unwrap } from '@/lib/axios'
import type { CourseProgress, LessonProgress, RecentlyWatchedItem } from '@/types/models'

export function reportProgress(lessonId: string, watchedSeconds: number) {
  return unwrap<{ progress: LessonProgress }>(
    api.put(`/progress/lessons/${lessonId}`, { watchedSeconds }),
  )
}

export function getCourseProgress(courseId: string) {
  return unwrap<CourseProgress>(api.get(`/progress/courses/${courseId}`))
}

export function getRecentlyWatched() {
  return unwrap<{ lessons: RecentlyWatchedItem[] }>(api.get('/progress/recent'))
}
