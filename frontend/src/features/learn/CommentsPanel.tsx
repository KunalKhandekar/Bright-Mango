import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare, Pencil, Reply, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createComment,
  deleteComment,
  listLessonComments,
  replyToComment,
  updateComment,
} from '@/api/comments'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Paginator } from '@/components/shared/Paginator'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { errorMessage } from '@/lib/error-messages'
import { formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import type { CommentNode, CommentUser } from '@/types/models'

function commentAuthor(comment: CommentNode): CommentUser | null {
  return typeof comment.userId === 'object' ? comment.userId : null
}

export function CommentsPanel({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isMentor = user?.role === 'mentor'

  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const queryKey = keys.lessonComments(lessonId, page)
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => listLessonComments(lessonId, { page }),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['comments', 'lesson', lessonId] })

  const post = useMutation({
    mutationFn: (input: { content: string; parentCommentId?: string }) =>
      createComment(lessonId, input),
    onSuccess: () => {
      setDraft('')
      setReplyTo(null)
      setReplyDraft('')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const mentorReply = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      replyToComment(id, content),
    onSuccess: () => {
      setReplyTo(null)
      setReplyDraft('')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const edit = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => updateComment(id, content),
    onSuccess: () => {
      setEditingId(null)
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => void invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  })

  const threads = data?.comments ?? []

  const renderComment = (comment: CommentNode, isReply = false) => {
    const author = commentAuthor(comment)
    const own = author?._id === user?.id
    const canEdit = own
    const canDelete = own || isMentor
    const isEditing = editingId === comment._id

    return (
      <div key={comment._id} className={isReply ? 'mt-3 ml-10' : 'mt-4'}>
        <div className="flex gap-3">
          <UserAvatar name={author?.name} avatar={author?.avatar} className="mt-0.5 size-7" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">{author?.name || 'Learner'}</span>
              {author?.role === 'mentor' && <Badge variant="secondary">Mentor</Badge>}
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(comment.createdAt)}
                {comment.isEdited ? ' · edited' : ''}
              </span>
            </div>
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!editDraft.trim() || edit.isPending}
                    onClick={() => edit.mutate({ id: comment._id, content: editDraft.trim() })}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm whitespace-pre-line">{comment.content}</p>
            )}

            {!isEditing && (
              <div className="mt-1 flex items-center gap-1">
                {!isReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 px-2 text-xs"
                    onClick={() => {
                      setReplyTo(replyTo === comment._id ? null : comment._id)
                      setReplyDraft('')
                    }}
                  >
                    <Reply className="size-3" /> Reply
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 px-2 text-xs"
                    onClick={() => {
                      setEditingId(comment._id)
                      setEditDraft(comment.content)
                    }}
                  >
                    <Pencil className="size-3" /> Edit
                  </Button>
                )}
                {canDelete && (
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-7 px-2 text-xs"
                      >
                        <Trash2 className="size-3" /> Delete
                      </Button>
                    }
                    title="Delete this comment?"
                    description="This can't be undone."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => remove.mutateAsync(comment._id).then(() => undefined)}
                  />
                )}
              </div>
            )}

            {replyTo === comment._id && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Write a reply…"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!replyDraft.trim() || post.isPending || mentorReply.isPending}
                    onClick={() => {
                      const content = replyDraft.trim()
                      if (isMentor) {
                        mentorReply.mutate({ id: comment._id, content })
                      } else {
                        post.mutate({ content, parentCommentId: comment._id })
                      }
                    }}
                  >
                    Reply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question or share your thoughts…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || post.isPending}
            onClick={() => post.mutate({ content: draft.trim() })}
          >
            {post.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Comment
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-muted-foreground mt-6 flex flex-col items-center gap-2 py-6 text-sm">
          <MessageSquare className="size-5 opacity-50" />
          Be the first to comment on this lesson.
        </div>
      ) : (
        <>
          <div>
            {threads.map((thread) => (
              <div key={thread.comment._id}>
                {renderComment(thread.comment)}
                {thread.replies.map((reply) => renderComment(reply, true))}
              </div>
            ))}
          </div>
          {data?.meta && (
            <div className="mt-4">
              <Paginator meta={data.meta} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
