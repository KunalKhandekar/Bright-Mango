import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarClock, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createCampaign } from '@/api/campaigns'
import { listMyCourses } from '@/api/courses'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { errorMessage } from '@/lib/error-messages'
import { formatDateTime } from '@/lib/format'
import type { CampaignAudience } from '@/types/models'
import { StudentMultiSelect, type SelectedStudent } from './StudentMultiSelect'

const TOKENS = [
  { token: '{{name}}', hint: "student's name" },
  { token: '{{email}}', hint: 'their email address' },
]

type AudienceMode = CampaignAudience['type']

const AUDIENCE_LABELS: Record<AudienceMode, string> = {
  all: 'All students',
  course: 'Students of a course',
  students: 'Selected students',
}

export function CampaignComposePage() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all')
  const [courseId, setCourseId] = useState('')
  const [students, setStudents] = useState<SelectedStudent[]>([])
  const [schedule, setSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [sending, setSending] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'picker'],
    queryFn: () => listMyCourses({ limit: 100 }),
    enabled: audienceMode === 'course',
  })

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

  const scheduledAt =
    schedule && scheduleDate && scheduleTime ? new Date(`${scheduleDate}T${scheduleTime}`) : null
  const scheduleInFuture = scheduledAt ? scheduledAt.getTime() > Date.now() + 2 * 60 * 1000 : false

  const audience: CampaignAudience =
    audienceMode === 'course'
      ? { type: 'course', courseId }
      : audienceMode === 'students'
        ? { type: 'students', studentIds: students.map((s) => s._id) }
        : { type: 'all' }

  const audienceValid =
    audienceMode === 'all' ||
    (audienceMode === 'course' && Boolean(courseId)) ||
    (audienceMode === 'students' && students.length > 0)

  const valid =
    Boolean(subject.trim()) &&
    Boolean(body.trim()) &&
    audienceValid &&
    (!schedule || scheduleInFuture)

  const handleSend = async () => {
    setSending(true)
    try {
      const { campaign } = await createCampaign({
        subject: subject.trim(),
        body: body.trim(),
        audience,
        scheduledFor: scheduledAt ? scheduledAt.toISOString() : undefined,
      })
      toast.success(
        campaign.status === 'scheduled'
          ? `Campaign scheduled for ${formatDateTime(campaign.scheduledFor!)}`
          : `Campaign queued to ${campaign.totalRecipients} students`,
      )
      navigate(`/admin/campaigns/${campaign._id}`)
    } catch (err) {
      toast.error(errorMessage(err))
      setSending(false)
    }
  }

  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/campaigns">
          <ArrowLeft className="size-4" /> Campaigns
        </Link>
      </Button>

      <PageHeader
        title="New campaign"
        description="Pick your audience, personalize with tokens, send now or schedule for later."
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-subject">Subject</Label>
            <Input
              id="campaign-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Big news: new course drops Friday"
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="campaign-body">Message</Label>
              <div className="flex gap-1.5">
                {TOKENS.map(({ token, hint }) => (
                  <Badge
                    key={token}
                    variant="secondary"
                    className="cursor-pointer font-mono"
                    title={`Inserts ${hint}`}
                    onClick={() => insertToken(token)}
                  >
                    {token}
                  </Badge>
                ))}
              </div>
            </div>
            <Textarea
              id="campaign-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              maxLength={50000}
              placeholder={'Hi {{name}},\n\n…'}
            />
            <p className="text-muted-foreground text-xs">
              {'{{name}}'} → student's name · {'{{email}}'} → their email address
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience</CardTitle>
          <CardDescription>Who receives this campaign.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={audienceMode} onValueChange={(v) => setAudienceMode(v as AudienceMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(AUDIENCE_LABELS) as [AudienceMode, string][]).map(([mode, label]) => (
                <SelectItem key={mode} value={mode}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {audienceMode === 'course' && (
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={coursesQuery.isPending ? 'Loading…' : 'Choose a course'}
                />
              </SelectTrigger>
              <SelectContent>
                {(coursesQuery.data?.courses ?? []).map((course) => (
                  <SelectItem key={course._id} value={course._id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {audienceMode === 'students' && (
            <StudentMultiSelect selected={students} onChange={setStudents} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Schedule</CardTitle>
              <CardDescription>Send later instead of right away.</CardDescription>
            </div>
            <Switch checked={schedule} onCheckedChange={setSchedule} aria-label="Schedule for later" />
          </div>
        </CardHeader>
        {schedule && (
          <CardContent className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="date"
                value={scheduleDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="sm:w-44"
                aria-label="Schedule date"
              />
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="sm:w-32"
                aria-label="Schedule time"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Times are in your local timezone ({localTimezone}). Must be at least a few minutes
              from now. You can cancel any time before it sends.
            </p>
            {schedule && scheduledAt && !scheduleInFuture && (
              <p className="text-destructive text-xs">
                Pick a time at least 2 minutes in the future.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        trigger={
          <Button disabled={!valid || sending} className="w-full">
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : schedule ? (
              <CalendarClock className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {schedule && scheduledAt
              ? `Schedule for ${formatDateTime(scheduledAt.toISOString())}`
              : `Send to ${AUDIENCE_LABELS[audienceMode].toLowerCase()}`}
          </Button>
        }
        title={schedule ? 'Schedule this campaign?' : 'Send this campaign?'}
        description={
          schedule && scheduledAt
            ? `It will go out to ${AUDIENCE_LABELS[audienceMode].toLowerCase()} on ${formatDateTime(scheduledAt.toISOString())}. You can cancel before it sends.`
            : `It goes out to ${AUDIENCE_LABELS[audienceMode].toLowerCase()} and can't be recalled.`
        }
        confirmLabel={schedule ? 'Schedule' : 'Send now'}
        onConfirm={handleSend}
      />
    </div>
  )
}
