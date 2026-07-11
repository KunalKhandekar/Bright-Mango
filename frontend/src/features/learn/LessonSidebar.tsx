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

  return (
    <Accordion
      type="multiple"
      // All chapters open by default; each remains individually collapsible.
      defaultValue={chapters.map((c) => c._id)}
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
                  // Progress carries the authoritative watched/total seconds; fall back to
                  // the lesson's own duration when there's no progress row yet.
                  const duration = p?.durationSeconds || lesson.durationSeconds || 0
                  const watched = Math.min(p?.watchedSeconds ?? 0, duration || Infinity)
                  const inProgress = !p?.completed && !!p && p.completionPercentage > 0
                  return (
                    <li key={lesson._id}>
                      <button
                        type="button"
                        onClick={() => onSelect(lesson)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {p?.completed ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500" />
                        ) : isActive ? (
                          <PlayCircle className="text-primary mt-0.5 size-4 shrink-0" />
                        ) : (
                          <Circle className="mt-0.5 size-4 shrink-0 opacity-40" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                            {p?.completed ? (
                              <span className="text-xs font-medium text-green-600 dark:text-green-500">
                                Completed
                              </span>
                            ) : inProgress ? (
                              <span className="text-primary text-xs font-medium tabular-nums">
                                {p.completionPercentage}%
                              </span>
                            ) : duration ? (
                              <span className="text-xs tabular-nums opacity-70">
                                {formatDuration(duration)}
                              </span>
                            ) : null}
                          </span>
                          {inProgress && duration ? (
                            <span className="mt-1.5 flex items-center gap-2">
                              <span className="bg-muted h-1 min-w-0 flex-1 overflow-hidden rounded-full">
                                <span
                                  className="bg-primary block h-full rounded-full"
                                  style={{ width: `${p.completionPercentage}%` }}
                                />
                              </span>
                              <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                                {formatDuration(watched)} / {formatDuration(duration)}
                              </span>
                            </span>
                          ) : null}
                        </span>
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
