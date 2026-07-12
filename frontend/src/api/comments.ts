import { api, unwrap } from '@/lib/axios'
import type { CommentNode } from '@/types/models'

export function listLessonComments(
  lessonId: string,
  params: { page?: number; limit?: number } = {},
) {
  return unwrap<{ comments: CommentNode[] }>(
    api.get(`/comments/lessons/${lessonId}`, { params }),
  )
}

export function listCommentReplies(
  id: string,
  params: { page?: number; limit?: number } = {},
) {
  return unwrap<{ comments: CommentNode[] }>(api.get(`/comments/${id}/replies`, { params }))
}

export function createComment(
  lessonId: string,
  input: { content: string; parentCommentId?: string },
) {
  return unwrap<{ comment: CommentNode }>(api.post(`/comments/lessons/${lessonId}`, input))
}

export function updateComment(id: string, content: string) {
  return unwrap<{ comment: CommentNode }>(api.patch(`/comments/${id}`, { content }))
}

export function deleteComment(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/comments/${id}`))
}

// ── Mentor ──────────────────────────────────────────────────────────────────

export interface RecentCommentsParams {
  page?: number
  limit?: number
  courseId?: string
  studentId?: string
  q?: string
  unanswered?: boolean
  sort?: 'newest' | 'oldest'
}

export function listRecentComments(params: RecentCommentsParams = {}) {
  return unwrap<{ comments: CommentNode[] }>(
    api.get('/comments/recent', {
      // Only send unanswered when on — the backend treats presence-of-'true' as the flag.
      params: { ...params, unanswered: params.unanswered ? true : undefined },
    }),
  )
}

export function replyToComment(id: string, content: string) {
  return unwrap<{ comment: CommentNode }>(api.post(`/comments/${id}/reply`, { content }))
}
