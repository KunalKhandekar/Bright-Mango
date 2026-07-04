import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateLesson } from '@/api/lessons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'
import type { Lesson } from '@/types/models'
import { ResourceUploadCard } from '@/features/admin/courses/ResourceUploadCard'
import { VideoUploadCard } from '@/features/admin/courses/VideoUploadCard'

interface LessonEditDialogProps {
  lesson: Lesson | null
  onOpenChange: (open: boolean) => void
}

export function LessonEditDialog({ lesson, onOpenChange }: LessonEditDialogProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPreview, setIsPreview] = useState(false)

  useEffect(() => {
    if (!lesson) return
    setTitle(lesson.title)
    setDescription(lesson.description ?? '')
    setIsPreview(lesson.isPreview)
  }, [lesson])

  const save = useMutation({
    mutationFn: () =>
      updateLesson(lesson!._id, {
        title: title.trim(),
        description: description.trim() || undefined,
        isPreview,
      }),
    onSuccess: () => {
      toast.success('Lesson saved')
      void queryClient.invalidateQueries({ queryKey: keys.lessonsByCourse(lesson!.courseId) })
      onOpenChange(false)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <Dialog open={!!lesson} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit lesson</DialogTitle>
          <DialogDescription>Content, video and downloadable resources.</DialogDescription>
        </DialogHeader>
        {lesson && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="lesson-title">Title</Label>
              <Input
                id="lesson-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-desc">Description</Label>
              <Textarea
                id="lesson-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="lesson-preview">Free preview</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Anyone can watch this lesson without enrolling.
                </p>
              </div>
              <Switch id="lesson-preview" checked={isPreview} onCheckedChange={setIsPreview} />
            </div>

            <Button
              className="w-full"
              disabled={!title.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              Save lesson
            </Button>

            <VideoUploadCard lesson={lesson} />
            <ResourceUploadCard lessonId={lesson._id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
