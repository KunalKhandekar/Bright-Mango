import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { CommentNode } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { QueryErrorState } from '@/components/shared/QueryErrorState'
import { formatRelativeTime } from '@/lib/format'

export function LatestCommentsCard({
  comments,
  isPending,
  isError,
  onRetry,
}: {
  comments: CommentNode[]
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Latest comments</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/comments">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <QueryErrorState message="Couldn't load comments." onRetry={onRetry} />
        ) : comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No comments yet — they'll show up as students start discussing lessons.
          </p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => {
              const author = typeof comment.userId === 'object' ? comment.userId : null
              return (
                <li key={comment._id} className="flex gap-3">
                  <UserAvatar
                    name={author?.name}
                    avatar={author?.avatar}
                    className="mt-0.5 size-7"
                  />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{author?.name || 'Learner'}</span>{' '}
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </p>
                    <p className="text-muted-foreground truncate text-sm">{comment.content}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
