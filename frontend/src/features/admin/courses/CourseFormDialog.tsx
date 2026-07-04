import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createCourse, updateCourse, type CourseInput } from '@/api/courses'
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
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/error-messages'
import { paiseToRupees, rupeesToPaise } from '@/lib/format'
import type { Course } from '@/types/models'

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(course?.title ?? '')
    setPriceRupees(course ? String(paiseToRupees(course.price)) : '')
    setShortDescription(course?.shortDescription ?? '')
    setDescription(course?.description ?? '')
    setThumbnailUrl(course?.thumbnailUrl ?? '')
  }, [open, course])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: CourseInput = {
        title: title.trim(),
        price: rupeesToPaise(priceRupees || '0'),
        shortDescription: shortDescription.trim() || undefined,
        description: description.trim() || undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
      }
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
            <Label htmlFor="course-thumb">Thumbnail URL</Label>
            <Input
              id="course-thumb"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {course ? 'Save changes' : 'Create course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
