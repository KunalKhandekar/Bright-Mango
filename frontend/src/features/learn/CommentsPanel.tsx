import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createComment, listLessonComments } from '@/api/comments'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { NestedCommentItem } from '@/features/comments/NestedCommentItem'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'

interface CommentsPanelProps {
  lessonId: string
}

export function CommentsPanel({ lessonId }: CommentsPanelProps) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [draft, setDraft] = useState('')

  const commentsQuery = useQuery({
    queryKey: keys.lessonComments(lessonId, 1),
    queryFn: () => listLessonComments(lessonId, { page: 1, limit: 50 }),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['comments'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
  }

  const create = useMutation({
    mutationFn: (content: string) => createComment(lessonId, { content }),
    onSuccess: () => {
      setDraft('')
      toast.success('Comment posted')
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const comments = commentsQuery.data?.comments ?? []

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question or leave a note..."
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || create.isPending || !currentUser}
            onClick={() => create.mutate(draft.trim())}
          >
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Comment
          </Button>
        </div>
      </div>

      {commentsQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet. Start the discussion.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <NestedCommentItem
              key={comment._id}
              comment={comment}
              currentUser={currentUser}
              lessonId={lessonId}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
