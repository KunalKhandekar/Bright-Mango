import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createCampaign } from '@/api/campaigns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { errorMessage } from '@/lib/error-messages'

const TOKENS = [
  { token: '{{name}}', hint: "student's name" },
  { token: '{{progress}}', hint: 'their course progress' },
]

export function CampaignComposePage() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

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

  const handleSend = async () => {
    setSending(true)
    try {
      const { campaign } = await createCampaign({
        subject: subject.trim(),
        body: body.trim(),
      })
      toast.success(`Campaign queued to ${campaign.totalRecipients} students`)
      navigate(`/admin/campaigns/${campaign._id}`)
    } catch (err) {
      toast.error(errorMessage(err))
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/campaigns">
          <ArrowLeft className="size-4" /> Campaigns
        </Link>
      </Button>

      <PageHeader
        title="New campaign"
        description="Sent to every active student. Personalize with the tokens below."
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
              {'{{name}}'} → student's name · {'{{progress}}'} → their overall progress
            </p>
          </div>

          <ConfirmDialog
            trigger={
              <Button disabled={!subject.trim() || !body.trim() || sending} className="w-full">
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send to all students
              </Button>
            }
            title="Send this campaign?"
            description="It goes out to every active student and can't be recalled."
            confirmLabel="Send now"
            onConfirm={handleSend}
          />
        </CardContent>
      </Card>
    </div>
  )
}
