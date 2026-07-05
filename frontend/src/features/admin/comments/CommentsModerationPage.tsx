import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { listRecentComments } from '@/api/comments'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { NestedCommentItem } from '@/features/comments/NestedCommentItem'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'

export function CommentsModerationPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: keys.recentComments(page),
    queryFn: () => listRecentComments({ page }),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['comments'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
  }

  const comments = (data?.comments ?? []).filter((comment) => !comment.parentCommentId)

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
            {comments.map((comment) => (
              <NestedCommentItem
                key={comment._id}
                comment={comment}
                currentUser={currentUser}
                admin
                onChanged={invalidate}
              />
            ))}
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}
