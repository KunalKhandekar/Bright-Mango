import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createChapter, deleteChapter, reorderChapters, updateChapter } from '@/api/chapters'
import { createLesson, deleteLesson, reorderLessons } from '@/api/lessons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { errorMessage } from '@/lib/error-messages'
import { keys } from '@/lib/query-client'
import type { Chapter, Lesson } from '@/types/models'
import { VideoStatusBadge } from '@/features/admin/courses/VideoUploadCard'

interface ChapterListProps {
  courseId: string
  chapters: Chapter[]
  lessons: Lesson[]
  onEditLesson: (lesson: Lesson) => void
}

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Long-press on touch so dragging doesn't fight scrolling.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
}

function SortableLessonRow({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: Lesson
  onEdit: () => void
  onDelete: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson._id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-background flex items-center gap-2 rounded-md border px-2 py-2 ${
        isDragging ? 'z-10 opacity-70 shadow-md' : ''
      }`}
    >
      <button
        type="button"
        className="text-muted-foreground/60 hover:text-foreground -ml-0.5 cursor-grab touch-none p-1"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
      >
        {lesson.title}
      </button>
      <div className="hidden items-center gap-1.5 sm:flex">
        {lesson.isPreview && (
          <Badge variant="outline">
            <Eye className="size-3" /> Preview
          </Badge>
        )}
        <VideoStatusBadge lesson={lesson} />
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Edit lesson" onClick={onEdit}>
        <Pencil className="size-3.5" />
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Delete lesson">
            <Trash2 className="size-3.5" />
          </Button>
        }
        title="Delete this lesson?"
        description={`"${lesson.title}" and its video/resources will be removed permanently.`}
        confirmLabel="Delete"
        destructive
        onConfirm={onDelete}
      />
    </li>
  )
}

function SortableChapterCard({
  chapter,
  index,
  children,
  onRename,
  onDelete,
}: {
  chapter: Chapter
  index: number
  children: React.ReactNode
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter._id,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(chapter.title)

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`gap-3 py-4 ${isDragging ? 'z-10 opacity-70 shadow-lg' : ''}`}
    >
      <CardHeader className="flex flex-row items-center gap-2 px-4">
        <button
          type="button"
          className="text-muted-foreground/60 hover:text-foreground cursor-grab touch-none p-1"
          aria-label="Drag to reorder chapter"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        {editing ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              await onRename(draft.trim())
              setEditing(false)
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8"
              autoFocus
              maxLength={160}
            />
            <Button type="submit" size="sm" disabled={!draft.trim()}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate font-medium">
              {index + 1}. {chapter.title}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Rename chapter"
              onClick={() => {
                setDraft(chapter.title)
                setEditing(true)
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Delete chapter">
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title="Delete this chapter?"
              description={`"${chapter.title}" and all its lessons will be removed permanently.`}
              confirmLabel="Delete"
              destructive
              onConfirm={onDelete}
            />
          </>
        )}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  )
}

export function ChapterList({ courseId, chapters, lessons, onEditLesson }: ChapterListProps) {
  const queryClient = useQueryClient()
  const sensors = useDndSensors()
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [newLessonTitles, setNewLessonTitles] = useState<Record<string, string>>({})

  const invalidateChapters = () =>
    queryClient.invalidateQueries({ queryKey: keys.chapters(courseId) })
  const invalidateLessons = () =>
    queryClient.invalidateQueries({ queryKey: keys.lessonsByCourse(courseId) })

  const byChapter = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const list = byChapter.get(lesson.chapterId) ?? []
    list.push(lesson)
    byChapter.set(lesson.chapterId, list)
  }

  const addChapter = useMutation({
    mutationFn: () => createChapter(courseId, { title: newChapterTitle.trim() }),
    onSuccess: () => {
      setNewChapterTitle('')
      void invalidateChapters()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const addLesson = useMutation({
    mutationFn: ({ chapterId, title }: { chapterId: string; title: string }) =>
      createLesson(chapterId, { title }),
    onSuccess: (_, { chapterId }) => {
      setNewLessonTitles((prev) => ({ ...prev, [chapterId]: '' }))
      void invalidateLessons()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const handleChapterDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = chapters.findIndex((c) => c._id === active.id)
    const newIndex = chapters.findIndex((c) => c._id === over.id)
    const reordered = arrayMove(chapters, oldIndex, newIndex)
    // Optimistic cache update, roll back via invalidate on failure.
    queryClient.setQueryData(keys.chapters(courseId), { chapters: reordered })
    try {
      await reorderChapters(courseId, reordered.map((c) => c._id))
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the new order'))
      void invalidateChapters()
    }
  }

  const handleLessonDragEnd = (chapterId: string) => async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const chapterLessons = byChapter.get(chapterId) ?? []
    const oldIndex = chapterLessons.findIndex((l) => l._id === active.id)
    const newIndex = chapterLessons.findIndex((l) => l._id === over.id)
    const reordered = arrayMove(chapterLessons, oldIndex, newIndex)
    const others = lessons.filter((l) => l.chapterId !== chapterId)
    queryClient.setQueryData(keys.lessonsByCourse(courseId), {
      lessons: [...others, ...reordered],
    })
    try {
      await reorderLessons(chapterId, reordered.map((l) => l._id))
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the new order'))
      void invalidateLessons()
    }
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleChapterDragEnd}
      >
        <SortableContext
          items={chapters.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          {chapters.map((chapter, index) => {
            const chapterLessons = byChapter.get(chapter._id) ?? []
            return (
              <SortableChapterCard
                key={chapter._id}
                chapter={chapter}
                index={index}
                onRename={async (title) => {
                  try {
                    await updateChapter(chapter._id, { title })
                    void invalidateChapters()
                  } catch (err) {
                    toast.error(errorMessage(err))
                  }
                }}
                onDelete={async () => {
                  try {
                    await deleteChapter(chapter._id)
                    void invalidateChapters()
                    void invalidateLessons()
                  } catch (err) {
                    toast.error(errorMessage(err))
                  }
                }}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleLessonDragEnd(chapter._id)}
                >
                  <SortableContext
                    items={chapterLessons.map((l) => l._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-2">
                      {chapterLessons.map((lesson) => (
                        <SortableLessonRow
                          key={lesson._id}
                          lesson={lesson}
                          onEdit={() => onEditLesson(lesson)}
                          onDelete={async () => {
                            try {
                              await deleteLesson(lesson._id)
                              void invalidateLessons()
                            } catch (err) {
                              toast.error(errorMessage(err))
                            }
                          }}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>

                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const title = (newLessonTitles[chapter._id] ?? '').trim()
                    if (title) addLesson.mutate({ chapterId: chapter._id, title })
                  }}
                >
                  <Input
                    placeholder="New lesson title…"
                    className="h-8 text-sm"
                    value={newLessonTitles[chapter._id] ?? ''}
                    onChange={(e) =>
                      setNewLessonTitles((prev) => ({
                        ...prev,
                        [chapter._id]: e.target.value,
                      }))
                    }
                    maxLength={200}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={!(newLessonTitles[chapter._id] ?? '').trim() || addLesson.isPending}
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </form>
              </SortableChapterCard>
            )
          })}
        </SortableContext>
      </DndContext>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (newChapterTitle.trim()) addChapter.mutate()
        }}
      >
        <Input
          placeholder="New chapter title…"
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          maxLength={160}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={!newChapterTitle.trim() || addChapter.isPending}
        >
          <Plus className="size-4" /> Add chapter
        </Button>
      </form>
    </div>
  )
}
