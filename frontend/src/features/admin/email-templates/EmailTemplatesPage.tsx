import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCode2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { assignProcess, deleteTemplate, listProcesses, listTemplates } from '@/api/email-templates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { QueryErrorState } from '@/components/shared/QueryErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Paginator } from '@/components/shared/Paginator'
import { errorMessage } from '@/lib/error-messages'
import { formatDate } from '@/lib/format'
import { keys } from '@/lib/query-client'

/** Select sentinel for "use the built-in default" (no template assigned). */
const DEFAULT = '__default__'

export function EmailTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const processesQuery = useQuery({ queryKey: keys.emailProcesses, queryFn: listProcesses })
  const templatesQuery = useQuery({
    queryKey: keys.emailTemplates(page),
    queryFn: () => listTemplates({ page }),
  })
  const templates = templatesQuery.data?.templates ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: keys.emailProcesses })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] })
  }

  const assign = useMutation({
    mutationFn: ({ processKey, templateId }: { processKey: string; templateId: string | null }) =>
      assignProcess(processKey, templateId),
    onSuccess: () => {
      toast.success('Assignment updated. Changes may take up to a minute to apply.')
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast.success('Template deleted')
      invalidate()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        description="Customize the emails the platform sends, and choose which template each process uses."
        actions={
          <Button asChild>
            <Link to="/admin/email-templates/new">
              <Plus className="size-4" /> New template
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Process assignments</CardTitle>
          <CardDescription>
            Each email process uses its assigned template, or the built-in default when none is
            assigned. A template can only use the variables its process provides.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {processesQuery.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : processesQuery.isError ? (
            <QueryErrorState
              message="Couldn't load email processes."
              onRetry={() => void processesQuery.refetch()}
            />
          ) : (
            (processesQuery.data?.processes ?? []).map((proc) => (
              <div
                key={proc.key}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{proc.label}</p>
                  <p className="text-muted-foreground text-xs">{proc.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {proc.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono text-[10px]">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Select
                  value={proc.assignedTemplateId ?? DEFAULT}
                  onValueChange={(v) =>
                    assign.mutate({ processKey: proc.key, templateId: v === DEFAULT ? null : v })
                  }
                  disabled={assign.isPending}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT}>Built-in default</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                    {/* Keep the current assignment selectable even if it's on another page. */}
                    {proc.assignedTemplateId &&
                      !templates.some((t) => t._id === proc.assignedTemplateId) && (
                        <SelectItem value={proc.assignedTemplateId}>
                          {proc.assignedTemplateName}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {templatesQuery.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : templatesQuery.isError ? (
        <QueryErrorState
          message="Couldn't load templates."
          onRetry={() => void templatesQuery.refetch()}
        />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileCode2}
          title="No templates yet"
          description="Create a template, then assign it to a process above."
          action={
            <Button asChild variant="outline">
              <Link to="/admin/email-templates/new">
                <Plus className="size-4" /> New template
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const proc = processesQuery.data?.processes.find(
                    (p) => p.key === template.processKey,
                  )
                  return (
                    <TableRow
                      key={template._id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/email-templates/${template._id}`)}
                    >
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-64 truncate">
                        {template.subject}
                      </TableCell>
                      <TableCell>
                        {proc ? (
                          <Badge variant="outline">{proc.label}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(template.updatedAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Delete template">
                              <Trash2 className="size-4" />
                            </Button>
                          }
                          title={`Delete "${template.name}"?`}
                          description={
                            template.processKey
                              ? 'This template is assigned to a process — deleting it resets that process to the built-in default.'
                              : 'This cannot be undone.'
                          }
                          confirmLabel="Delete"
                          destructive
                          onConfirm={async () => {
                            await remove.mutateAsync(template._id)
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {templatesQuery.data?.meta && (
            <Paginator meta={templatesQuery.data.meta} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  )
}
