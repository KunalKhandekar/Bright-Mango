import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare, Reply, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteComment, listRecentComments, replyToComment } from '@/api/comments'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { errorMessage } from '@/lib/error-messages'
import { formatRelativeTime } from '@/lib/format'
import { keys } from '@/lib/query-client'

export function CommentsModerationPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const { data, isPending } = useQuery({
    queryKey: keys.recentComments(page),
    queryFn: () => listRecentComments({ page }),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })

  const reply = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => replyToComment(id, content),
    onSuccess: () => {
      toast.success('Reply posted')
      setReplyTo(null)
      setReplyDraft('')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      toast.success('Comment deleted')
      void invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const comments = data?.comments ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comments"
        description="The latest discussion across all your lessons."
      />

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" />
      ) : (
        <>
          <div className="space-y-3">
            {comments.map((comment) => {
              const author = typeof comment.userId === 'object' ? comment.userId : null
              return (
                <Card key={comment._id}>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={author?.name}
                        avatar={author?.avatar}
                        className="mt-0.5 size-8"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {author?.name || 'Learner'}
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {formatRelativeTime(comment.createdAt)}
                            {comment.parentCommentId ? ' · reply' : ''}
                          </span>
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-line">{comment.content}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!comment.parentCommentId && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Reply"
                            onClick={() => {
                              setReplyTo(replyTo === comment._id ? null : comment._id)
                              setReplyDraft('')
                            }}
                          >
                            <Reply className="size-4" />
                          </Button>
                        )}
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Delete comment">
                              <Trash2 className="size-4" />
                            </Button>
                          }
                          title="Delete this comment?"
                          description="This removes it for everyone and can't be undone."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => remove.mutateAsync(comment._id).then(() => undefined)}
                        />
                      </div>
                    </div>

                    {replyTo === comment._id && (
                      <div className="space-y-2 pl-11">
                        <Textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Reply as mentor…"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!replyDraft.trim() || reply.isPending}
                            onClick={() =>
                              reply.mutate({ id: comment._id, content: replyDraft.trim() })
                            }
                          >
                            {reply.isPending && <Loader2 className="size-3.5 animate-spin" />}
                            Reply
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}
