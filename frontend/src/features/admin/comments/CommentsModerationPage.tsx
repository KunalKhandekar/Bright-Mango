import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { listRecentComments } from '@/api/comments'
import { listMyCourses } from '@/api/courses'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { SearchInput } from '@/components/shared/SearchInput'
import { NestedCommentItem } from '@/features/comments/NestedCommentItem'
import type { SelectedStudent } from '@/features/admin/campaigns/StudentMultiSelect'
import { StudentSingleSelect } from './StudentSingleSelect'
import { keys } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'

/** Select sentinel for "every course" (Radix Select cannot hold an empty-string value). */
const ALL_COURSES = '__all__'

export function CommentsModerationPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [courseId, setCourseId] = useState(ALL_COURSES)
  const [student, setStudent] = useState<SelectedStudent | null>(null)
  const [q, setQ] = useState('')
  const [unanswered, setUnanswered] = useState(false)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)

  const filters = {
    courseId: courseId === ALL_COURSES ? undefined : courseId,
    studentId: student?._id,
    q: q || undefined,
    unanswered: unanswered || undefined,
    sort: sort === 'newest' ? undefined : sort,
  }
  const hasFilters = Boolean(filters.courseId || filters.studentId || filters.q || unanswered)

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'picker'],
    queryFn: () => listMyCourses({ limit: 100 }),
  })

  const { data, isPending } = useQuery({
    queryKey: keys.recentComments({ ...filters, page }),
    queryFn: () => listRecentComments({ ...filters, sort, page }),
  })
  const comments = data?.comments ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['comments'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
  }

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comments"
        description="Discussion across all your lessons — filter, search, and reply."
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <Select
          value={courseId}
          onValueChange={(v) => {
            setCourseId(v)
            resetPage()
          }}
        >
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COURSES}>All courses</SelectItem>
            {(coursesQuery.data?.courses ?? []).map((course) => (
              <SelectItem key={course._id} value={course._id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StudentSingleSelect
          value={student}
          onChange={(s) => {
            setStudent(s)
            resetPage()
          }}
          className="w-full lg:w-56"
        />
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value)
            resetPage()
          }}
          placeholder="Search comment text…"
          className="w-full lg:max-w-60"
        />
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as 'newest' | 'oldest')
            resetPage()
          }}
        >
          <SelectTrigger className="w-full lg:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="unanswered-only"
            checked={unanswered}
            onCheckedChange={(checked) => {
              setUnanswered(checked)
              resetPage()
            }}
          />
          <Label htmlFor="unanswered-only" className="text-sm font-normal">
            Unanswered only
          </Label>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments found"
          description={hasFilters ? 'Try removing the filters.' : 'No comments yet.'}
        />
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
