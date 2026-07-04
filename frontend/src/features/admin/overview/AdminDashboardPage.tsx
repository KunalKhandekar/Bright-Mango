import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, MessageSquare, Users } from 'lucide-react'
import { listMyCourses } from '@/api/courses'
import { listRecentComments } from '@/api/comments'
import { listStudents } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatRelativeTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth.store'

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Users
  label: string
  value: number | undefined
  to: string
}) {
  return (
    <Link to={to}>
      <Card className="hover:bg-accent/40 transition-colors">
        <CardContent className="flex items-center gap-4">
          <div className="bg-primary/10 flex size-11 items-center justify-center rounded-lg">
            <Icon className="text-primary size-5" />
          </div>
          <div>
            {value === undefined ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            )}
            <p className="text-muted-foreground text-sm">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user)

  const coursesQuery = useQuery({
    queryKey: ['admin', 'overview', 'courses'],
    queryFn: () => listMyCourses({ limit: 1 }),
  })
  const studentsQuery = useQuery({
    queryKey: ['admin', 'overview', 'students'],
    queryFn: () => listStudents({ limit: 1 }),
  })
  const commentsQuery = useQuery({
    queryKey: ['admin', 'overview', 'comments'],
    queryFn: () => listRecentComments({ limit: 5 }),
  })

  const recentComments = commentsQuery.data?.comments ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋`}
        description="Here's what's happening on your platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Courses"
          value={coursesQuery.data?.meta?.total}
          to="/admin/courses"
        />
        <StatCard
          icon={Users}
          label="Students"
          value={studentsQuery.data?.meta?.total}
          to="/admin/students"
        />
        <StatCard
          icon={MessageSquare}
          label="Comments"
          value={commentsQuery.data?.meta?.total}
          to="/admin/comments"
        />
      </div>

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
          {commentsQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : recentComments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No comments yet — they'll show up as students start discussing lessons.
            </p>
          ) : (
            <ul className="space-y-4">
              {recentComments.map((comment) => {
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
    </div>
  )
}
