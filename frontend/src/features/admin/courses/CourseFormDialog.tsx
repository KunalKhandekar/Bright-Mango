import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import {
  createCourse,
  createCourseThumbnailUploadUrl,
  updateCourse,
  type CourseInput,
} from '@/api/courses'
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
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/error-messages'
import { paiseToRupees, rupeesToPaise } from '@/lib/format'
import { useDirectUpload } from '@/hooks/use-direct-upload'
import { isApiError } from '@/types/api'
import type { Course } from '@/types/models'

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024 // 5MB

interface CourseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, edits the course; otherwise creates a new one. */
  course?: Course | null
  onSaved: (course: Course) => void
}

export function CourseFormDialog({ open, onOpenChange, course, onSaved }: CourseFormDialogProps) {
  const [title, setTitle] = useState('')
  const [priceRupees, setPriceRupees] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [thumbnailKey, setThumbnailKey] = useState('')
  const [thumbnailTouched, setThumbnailTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { phase, progress, upload, reset } = useDirectUpload()

  useEffect(() => {
    if (!open) return
    setTitle(course?.title ?? '')
    setPriceRupees(course ? String(paiseToRupees(course.price)) : '')
    setShortDescription(course?.shortDescription ?? '')
    setDescription(course?.description ?? '')
    setThumbnailUrl(course?.thumbnailUrl ?? '')
    setThumbnailKey(course?.thumbnailKey ?? '')
    setThumbnailTouched(false)
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course])

  const handleThumbnail = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      toast.error('Thumbnail must be under 5MB')
      return
    }
    try {
      const { uploadUrl, thumbnailKey: nextKey, publicUrl } = await createCourseThumbnailUploadUrl({
        fileName: file.name,
        contentType: file.type,
      })
      const ok = await upload(uploadUrl, file, { method: 'PUT' })
      if (!ok) {
        toast.error('Upload failed. Please try again.')
        reset()
        return
      }
      setThumbnailUrl(publicUrl)
      setThumbnailKey(nextKey)
      setThumbnailTouched(true)
      toast.success('Thumbnail uploaded')
      reset()
    } catch (err) {
      reset()
      if (isApiError(err, 'INTEGRATION_NOT_CONFIGURED')) {
        toast.error("Thumbnail upload isn't set up yet. Ask the platform admin to configure storage.")
      } else {
        toast.error(errorMessage(err))
      }
    }
  }

  const removeThumbnail = () => {
    setThumbnailUrl('')
    setThumbnailKey('')
    setThumbnailTouched(true)
    reset()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: CourseInput = {
        title: title.trim(),
        price: rupeesToPaise(priceRupees || '0'),
        shortDescription: shortDescription.trim() || undefined,
        description: description.trim() || undefined,
      }
      if (thumbnailTouched) input.thumbnailKey = thumbnailKey
      const result = course
        ? await updateCourse(course._id, input)
        : await createCourse(input)
      toast.success(course ? 'Course updated' : 'Course created')
      onOpenChange(false)
      onSaved(result.course)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit course' : 'New course'}</DialogTitle>
          <DialogDescription>
            {course
              ? 'Update the course details students see.'
              : 'Start with the basics — you can add chapters and lessons next.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course-title">Title</Label>
            <Input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-price">Price (₹)</Label>
            <Input
              id="course-price"
              type="number"
              min={0}
              step="1"
              value={priceRupees}
              onChange={(e) => setPriceRupees(e.target.value)}
              placeholder="0 for free"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-short">Short description</Label>
            <Textarea
              id="course-short"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="One or two lines shown on the course card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-desc">Full description</Label>
            <Textarea
              id="course-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={20000}
              rows={5}
            />
          </div>
          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <div className="overflow-hidden rounded-md border">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="aspect-video w-full bg-muted object-cover"
                />
              ) : (
                <button
                  type="button"
                  className="bg-muted/40 text-muted-foreground flex aspect-video w-full flex-col items-center justify-center gap-2"
                  onClick={() => fileRef.current?.click()}
                  disabled={phase === 'uploading'}
                >
                  <ImagePlus className="size-8" />
                  <span className="text-sm">Choose an image</span>
                </button>
              )}
            </div>
            {phase === 'uploading' ? (
              <div className="flex items-center gap-2">
                <Progress value={progress} className="flex-1" />
                <span className="text-muted-foreground w-10 text-right text-xs">{progress}%</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadCloud className="size-4" />
                  {thumbnailUrl ? 'Replace thumbnail' : 'Upload thumbnail'}
                </Button>
                {thumbnailUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={removeThumbnail}>
                    <Trash2 className="size-4" />
                    Remove thumbnail
                  </Button>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleThumbnail(file)
                e.target.value = ''
              }}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || phase === 'uploading' || !title.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {course ? 'Save changes' : 'Create course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
