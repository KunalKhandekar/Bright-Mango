import { api, unwrap } from '@/lib/axios'
import type { CommentNode, CommentThread } from '@/types/models'

export function listLessonComments(
  lessonId: string,
  params: { page?: number; limit?: number } = {},
) {
  return unwrap<{ comments: CommentThread[] }>(
    api.get(`/comments/lessons/${lessonId}`, { params }),
  )
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

export function listRecentComments(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ comments: CommentNode[] }>(api.get('/comments/recent', { params }))
}

export function replyToComment(id: string, content: string) {
  return unwrap<{ comment: CommentNode }>(api.post(`/comments/${id}/reply`, { content }))
}
