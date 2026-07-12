import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { createTemplate, getTemplate, listProcesses, updateTemplate } from '@/api/email-templates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/PageHeader'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'

/** Sample values rendered into the live preview pane. */
const SAMPLE_VALUES: Record<string, string> = {
  otp: '482913',
  ttlMinutes: '5',
  courseTitle: 'Mango Farming 101',
  loginUrl: 'https://brightmango.example/login',
  replierName: 'Priya',
  lessonTitle: 'Grafting basics',
  replyExcerpt: 'Great question — the rootstock matters most here.',
  lessonUrl: 'https://brightmango.example/learn/…',
  name: 'Priya',
  email: 'priya@example.com',
}

const ALL_PROCESSES = '__all__'

/** Mirrors the backend's interpolate() (escaped values, unknown tokens stripped). */
function interpolatePreview(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const value = fields[key] ?? ''
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  })
}

export function EmailTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [processFilter, setProcessFilter] = useState(ALL_PROCESSES)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const processesQuery = useQuery({ queryKey: keys.emailProcesses, queryFn: listProcesses })
  const templateQuery = useQuery({
    queryKey: keys.emailTemplate(id ?? ''),
    queryFn: () => getTemplate(id!),
    enabled: !isNew,
  })

  useEffect(() => {
    const template = templateQuery.data?.template
    if (!template) return
    setName(template.name)
    setSubject(template.subject)
    setBody(template.body)
    if (template.processKey) setProcessFilter(template.processKey)
  }, [templateQuery.data])

  const processes = processesQuery.data?.processes ?? []
  const tokens = useMemo(() => {
    const source =
      processFilter === ALL_PROCESSES
        ? processes.flatMap((p) => p.variables)
        : (processes.find((p) => p.key === processFilter)?.variables ?? [])
    return [...new Set(source)]
  }, [processes, processFilter])

  const insertToken = (token: string) => {
    const el = bodyRef.current
    if (!el) {
      setBody((prev) => prev + token)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    setBody(body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), subject: subject.trim(), body }
      return isNew ? createTemplate(input) : updateTemplate(id!, input)
    },
    onSuccess: ({ template }) => {
      toast.success(isNew ? 'Template created' : 'Template saved')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-templates'] })
      void queryClient.invalidateQueries({ queryKey: keys.emailTemplate(template._id) })
      void queryClient.invalidateQueries({ queryKey: keys.emailProcesses })
      if (isNew) navigate(`/admin/email-templates/${template._id}`, { replace: true })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const previewHtml = interpolatePreview(body, SAMPLE_VALUES)
  const previewSubject = interpolatePreview(subject, SAMPLE_VALUES)
  const valid = name.trim().length > 0 && subject.trim().length > 0 && body.trim().length > 0

  if (!isNew && templateQuery.isPending) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/email-templates">
          <ArrowLeft className="size-4" /> Email templates
        </Link>
      </Button>

      <PageHeader
        title={isNew ? 'New template' : `Edit: ${templateQuery.data?.template.name ?? ''}`}
        description="Write the email as HTML. Variables are replaced when the email is sent; the preview uses sample values."
        actions={
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isNew ? 'Create template' : 'Save changes'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Friendly login code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="Your BrightMango login code"
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="template-body">Body (HTML)</Label>
                <Select value={processFilter} onValueChange={setProcessFilter}>
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROCESSES}>All variables</SelectItem>
                    {processes.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tokens.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="cursor-pointer font-mono text-[10px]"
                    onClick={() => insertToken(`{{${t}}}`)}
                  >
                    {`{{${t}}}`}
                  </Badge>
                ))}
              </div>
              <Textarea
                id="template-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                maxLength={50000}
                className="font-mono text-xs"
                placeholder={'<div style="font-family:sans-serif">\n  <h2>…</h2>\n</div>'}
              />
              <p className="text-muted-foreground text-xs">
                A template assigned to a process may only use that process's variables. Changes
                take effect within a minute of saving.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription className="truncate">
              Subject: {previewSubject || '—'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={previewHtml}
              className="h-96 w-full rounded-md border bg-white"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
