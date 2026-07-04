import { CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Chapter, CourseProgress, Lesson } from '@/types/models'

interface LessonSidebarProps {
  chapters: Chapter[]
  lessons: Lesson[]
  progress?: CourseProgress
  activeLessonId: string | null
  onSelect: (lesson: Lesson) => void
}

export function LessonSidebar({
  chapters,
  lessons,
  progress,
  activeLessonId,
  onSelect,
}: LessonSidebarProps) {
  const byChapter = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const list = byChapter.get(lesson.chapterId) ?? []
    list.push(lesson)
    byChapter.set(lesson.chapterId, list)
  }
  const progressByLesson = new Map(progress?.lessons.map((p) => [p.lessonId, p]) ?? [])

  const activeChapterId = lessons.find((l) => l._id === activeLessonId)?.chapterId

  return (
    <Accordion
      type="multiple"
      defaultValue={activeChapterId ? [activeChapterId] : chapters.slice(0, 1).map((c) => c._id)}
      className="w-full"
    >
      {chapters.map((chapter, index) => {
        const chapterLessons = byChapter.get(chapter._id) ?? []
        const done = chapterLessons.filter((l) => progressByLesson.get(l._id)?.completed).length
        return (
          <AccordionItem key={chapter._id} value={chapter._id}>
            <AccordionTrigger className="px-1 text-left text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {index + 1}. {chapter.title}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                  {done}/{chapterLessons.length} completed
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <ul>
                {chapterLessons.map((lesson) => {
                  const p = progressByLesson.get(lesson._id)
                  const isActive = lesson._id === activeLessonId
                  return (
                    <li key={lesson._id}>
                      <button
                        type="button"
                        onClick={() => onSelect(lesson)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {p?.completed ? (
                          <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-500" />
                        ) : isActive ? (
                          <PlayCircle className="text-primary size-4 shrink-0" />
                        ) : (
                          <Circle className="size-4 shrink-0 opacity-40" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                        {lesson.durationSeconds ? (
                          <span className="text-xs tabular-nums opacity-70">
                            {formatDuration(lesson.durationSeconds)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
