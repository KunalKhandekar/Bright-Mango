import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageCircle, Pencil, Reply, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createComment,
  deleteComment,
  listCommentReplies,
  replyToComment,
  updateComment,
} from '@/api/comments'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/error-messages'
import { formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import type { CommentNode, CommentUser, User } from '@/types/models'

interface NestedCommentItemProps {
  comment: CommentNode
  currentUser: User | null
  lessonId?: string
  admin?: boolean
  onChanged: () => void
}

export function commentAuthor(comment: CommentNode): CommentUser | null {
  return typeof comment.userId === 'object' ? comment.userId : null
}

function objectId(value: string | { _id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value._id
}

function lessonTitle(comment: CommentNode): string | null {
  return typeof comment.lessonId === 'object' ? comment.lessonId.title : null
}

function courseTitle(comment: CommentNode): string | null {
  return typeof comment.courseId === 'object' ? comment.courseId.title : null
}

export function NestedCommentItem({
  comment,
  currentUser,
  lessonId,
  admin = false,
  onChanged,
}: NestedCommentItemProps) {
  const queryClient = useQueryClient()
  const [showReplies, setShowReplies] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(comment.content)

  const author = commentAuthor(comment)
  const isMentor = currentUser?.role === 'mentor'
  const own = author?._id === currentUser?.id
  const canDelete = own || isMentor
  const canEdit = own
  const directReplyCount = comment.directReplyCount ?? 0
  const visualDepth = Math.min(comment.depth ?? 0, 3)
  const effectiveLessonId = lessonId ?? objectId(comment.lessonId)
  const effectiveCourseId = objectId(comment.courseId)
  const lessonHref =
    admin && effectiveLessonId && effectiveCourseId
      ? `/learn/${effectiveCourseId}/lessons/${effectiveLessonId}`
      : null

  const repliesQuery = useInfiniteQuery({
    queryKey: keys.commentReplies(comment._id),
    queryFn: ({ pageParam }) => listCommentReplies(comment._id, { page: pageParam, limit: 5 }),
    enabled: showReplies,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta?.hasNextPage ? lastPage.meta.page + 1 : undefined,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['comments'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
    onChanged()
  }

  const reply = useMutation({
    mutationFn: (content: string) => {
      if (isMentor) return replyToComment(comment._id, content)
      if (!effectiveLessonId) throw new Error('Lesson is missing for this reply')
      return createComment(effectiveLessonId, { content, parentCommentId: comment._id })
    },
    onSuccess: () => {
      setReplyOpen(false)
      setReplyDraft('')
      setShowReplies(true)
      toast.success('Reply posted')
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const edit = useMutation({
    mutationFn: (content: string) => updateComment(comment._id, content),
    onSuccess: () => {
      setEditing(false)
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      toast.success('Comment deleted')
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const replies = repliesQuery.data?.pages.flatMap((page) => page.comments) ?? []
  const hiddenReplyCount = Math.max(0, directReplyCount - replies.length)

  return (
    <div
      className="mt-4 min-w-0"
      style={{ marginLeft: visualDepth > 0 ? `${visualDepth * 0.75}rem` : undefined }}
    >
      <div className="flex min-w-0 gap-3">
        <UserAvatar name={author?.name} avatar={author?.avatar} className="mt-0.5 size-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{author?.name || 'Learner'}</span>
            {author?.role === 'mentor' && <Badge variant="secondary">Mentor</Badge>}
            {comment.parentCommentId && (
              <span className="text-muted-foreground text-xs">
                Reply{comment.depth ? ` · level ${comment.depth}` : ''}
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              {formatRelativeTime(comment.createdAt)}
              {comment.isEdited ? ' · edited' : ''}
            </span>
          </div>

          {admin && (
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {courseTitle(comment) && <span>{courseTitle(comment)}</span>}
              {lessonTitle(comment) && <span>{lessonTitle(comment)}</span>}
              {lessonHref && (
                <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                  <Link to={lessonHref}>View lesson</Link>
                </Button>
              )}
            </div>
          )}

          {editing ? (
            <div className="mt-2 space-y-2">
              <Textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} rows={2} />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!editDraft.trim() || edit.isPending}
                  onClick={() => edit.mutate(editDraft.trim())}
                >
                  {edit.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 break-words text-sm whitespace-pre-line">{comment.content}</p>
          )}

          {!editing && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 px-2 text-xs"
                onClick={() => {
                  setReplyOpen((open) => !open)
                  setReplyDraft('')
                }}
              >
                <Reply className="size-3" /> Reply
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 px-2 text-xs"
                  onClick={() => {
                    setEditing(true)
                    setEditDraft(comment.content)
                  }}
                >
                  <Pencil className="size-3" /> Edit
                </Button>
              )}
              {canDelete && (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 text-xs">
                      <Trash2 className="size-3" /> Delete
                    </Button>
                  }
                  title="Delete this comment?"
                  description="This removes it and all nested replies."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => remove.mutateAsync(comment._id).then(() => undefined)}
                />
              )}
            </div>
          )}

          {replyOpen && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder={admin ? 'Reply as mentor...' : 'Write a reply...'}
                rows={2}
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!replyDraft.trim() || reply.isPending}
                  onClick={() => reply.mutate(replyDraft.trim())}
                >
                  {reply.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {directReplyCount > 0 && !showReplies && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground mt-2 h-7 px-2 text-xs"
              onClick={() => setShowReplies(true)}
            >
              <MessageCircle className="size-3" />
              Show {directReplyCount} {directReplyCount === 1 ? 'reply' : 'replies'}
            </Button>
          )}

          {showReplies && (
            <div className="mt-2 border-l pl-2 sm:pl-3">
              {replies.map((replyComment) => (
                <NestedCommentItem
                  key={replyComment._id}
                  comment={replyComment}
                  currentUser={currentUser}
                  lessonId={effectiveLessonId ?? undefined}
                  admin={admin}
                  onChanged={onChanged}
                />
              ))}
              {repliesQuery.isFetching && (
                <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  Loading replies
                </div>
              )}
              {repliesQuery.hasNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground mt-2 h-7 px-2 text-xs"
                  disabled={repliesQuery.isFetchingNextPage}
                  onClick={() => void repliesQuery.fetchNextPage()}
                >
                  {repliesQuery.isFetchingNextPage && <Loader2 className="size-3 animate-spin" />}
                  Show more replies
                </Button>
              )}
              {!repliesQuery.hasNextPage && hiddenReplyCount > 0 && (
                <span className="text-muted-foreground mt-2 block text-xs">
                  {hiddenReplyCount} replies are no longer available.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
