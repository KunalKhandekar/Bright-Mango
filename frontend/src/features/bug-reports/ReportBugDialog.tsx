import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBugReport, createScreenshotUploadUrl } from '@/api/bug-reports'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'
import { useDirectUpload } from '@/hooks/use-direct-upload'
import { isApiError } from '@/types/api'
import type { BugReportCategory, BugReportSeverity } from '@/types/models'
import { CATEGORY_LABELS, SEVERITY_LABELS } from './bug-report-meta'

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024 // 5MB

interface ReportBugDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportBugDialog({ open, onOpenChange }: ReportBugDialogProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<BugReportCategory>('other')
  const [severity, setSeverity] = useState<BugReportSeverity>('medium')
  const [screenshotKey, setScreenshotKey] = useState<string | null>(null)
  const [screenshotName, setScreenshotName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { phase, progress, upload, reset } = useDirectUpload()

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setCategory('other')
    setSeverity('medium')
    setScreenshotKey(null)
    setScreenshotName('')
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleScreenshot = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error('Screenshot must be under 5MB')
      return
    }
    try {
      const { uploadUrl, fileKey } = await createScreenshotUploadUrl({
        fileName: file.name,
        contentType: file.type,
      })
      const ok = await upload(uploadUrl, file, { method: 'PUT' })
      if (!ok) {
        toast.error('Upload failed. Please try again.')
        reset()
        return
      }
      setScreenshotKey(fileKey)
      setScreenshotName(file.name)
      reset()
    } catch (err) {
      reset()
      if (isApiError(err, 'INTEGRATION_NOT_CONFIGURED')) {
        toast.error("Screenshot upload isn't set up yet. You can still submit the report without one.")
      } else {
        toast.error(errorMessage(err))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createBugReport({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        pageUrl: window.location.href,
        screenshotKey,
      })
      toast.success("Thanks! We've logged your report.")
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: keys.myBugReports })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a bug</DialogTitle>
          <DialogDescription>
            Tell us what went wrong — we review every report.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-title">Title</Label>
            <Input
              id="bug-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Video stops after a few seconds"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bug-description">What happened?</Label>
            <Textarea
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              maxLength={5000}
              rows={5}
              placeholder="What did you do, what did you expect, and what happened instead?"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as BugReportCategory)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>How bad is it?</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as BugReportSeverity)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Screenshot (optional)</Label>
            {phase === 'uploading' ? (
              <div className="flex items-center gap-2">
                <Progress value={progress} className="flex-1" />
                <span className="text-muted-foreground w-10 text-right text-xs">{progress}%</span>
              </div>
            ) : screenshotKey ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <ImagePlus className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{screenshotName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Remove screenshot"
                  onClick={() => {
                    setScreenshotKey(null)
                    setScreenshotName('')
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Attach a screenshot
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleScreenshot(file)
                e.target.value = ''
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || phase === 'uploading' || !title.trim() || !description.trim()}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Submit report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
