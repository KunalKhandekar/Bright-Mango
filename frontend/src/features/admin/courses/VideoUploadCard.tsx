import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clapperboard, Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { createVideoUploadUrl } from '@/api/lessons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { errorMessage } from '@/lib/error-messages'
import { formatDuration } from '@/lib/format'
import { keys } from '@/lib/query-client'
import { useDirectUpload } from '@/hooks/use-direct-upload'
import type { Lesson } from '@/types/models'

export function VideoStatusBadge({ lesson }: { lesson: Lesson }) {
  if (lesson.videoStatus === 'ready') {
    return (
      <Badge variant="secondary" className="text-green-600 dark:text-green-500">
        <CheckCircle2 className="size-3" />
        Video ready{lesson.durationSeconds ? ` · ${formatDuration(lesson.durationSeconds)}` : ''}
      </Badge>
    )
  }
  if (lesson.videoStatus === 'processing') {
    return (
      <Badge variant="secondary" className="text-amber-600 dark:text-amber-500">
        <Loader2 className="size-3 animate-spin" />
        Processing
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Clapperboard className="size-3" />
      No video
    </Badge>
  )
}

export function VideoUploadCard({ lesson }: { lesson: Lesson }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const { phase, progress, upload, reset } = useDirectUpload()

  const handleFile = async (file: File) => {
    try {
      const { uploadUrl } = await createVideoUploadUrl(lesson._id)
      const ok = await upload(uploadUrl, file, { method: 'POST' })
      if (ok) {
        toast.success('Video uploaded — processing has started')
        // videoStatus flips to processing server-side; the builder polls the list.
        void queryClient.invalidateQueries({ queryKey: keys.lessonsByCourse(lesson.courseId) })
      } else {
        toast.error('Upload failed. Please try again.')
      }
    } catch (err) {
      reset()
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clapperboard className="size-4" /> Lesson video
        </div>
        <VideoStatusBadge lesson={lesson} />
      </div>

      {phase === 'uploading' ? (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-muted-foreground text-xs">Uploading… {progress}%</p>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="size-4" />
            {lesson.videoStatus === 'none' ? 'Upload video' : 'Replace video'}
          </Button>
          <p className="text-muted-foreground text-xs">
            Uploaded straight to Cloudflare Stream. Processing takes a few minutes; the status
            updates automatically.
          </p>
        </>
      )}
    </div>
  )
}
