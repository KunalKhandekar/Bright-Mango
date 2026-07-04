import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldOff, Users } from 'lucide-react'
import { listStudents } from '@/api/users'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { SearchInput } from '@/components/shared/SearchInput'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatDate } from '@/lib/format'
import { keys } from '@/lib/query-client'

export function StudentsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: keys.adminStudents(search, page),
    queryFn: () => listStudents({ search: search || undefined, page }),
  })
  const students = data?.students ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Everyone learning with you."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/blacklist">
              <ShieldOff className="size-4" /> Email blacklist
            </Link>
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        placeholder="Search by name or email…"
        className="max-w-sm"
      />

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No students match your search' : 'No students yet'}
          description={
            search ? 'Try a different name or email.' : 'Students appear after their first login.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow
                    key={student._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/students/${student._id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={student.name}
                          email={student.email}
                          avatar={student.avatar}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{student.name || '—'}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.status === 'banned' ? 'destructive' : 'secondary'}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {student.lastLoginAt ? formatDate(student.lastLoginAt) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(student.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.meta && <Paginator meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  )
}
