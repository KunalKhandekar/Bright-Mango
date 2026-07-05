import { useEffect, useMemo, useState } from 'react'
import { Lock, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/lib/format'

import type { Chapter, Lesson } from '@/types/models'

interface CurriculumAccordionProps {
  chapters: Chapter[]
  lessons: Lesson[]
  courseId: string
  hasAccess?: boolean
}

export function CurriculumAccordion({
  chapters,
  lessons,
  courseId,
  hasAccess = false,
}: CurriculumAccordionProps) {
  const [openChapters, setOpenChapters] = useState<string[]>([])
  const [initialized, setInitialized] = useState(false)

  const lessonsByChapter = useMemo(() => {
    const map = new Map<string, Lesson[]>()

    for (const lesson of lessons) {
      const chapterLessons = map.get(lesson.chapterId) ?? []

      chapterLessons.push(lesson)

      map.set(lesson.chapterId, chapterLessons)
    }

    for (const chapterLessons of map.values()) {
      chapterLessons.sort((a, b) => a.order - b.order)
    }

    return map
  }, [lessons])

  /**
   * Wait for both chapters and lessons before opening
   * the first chapter.
   */
  useEffect(() => {
    if (initialized) return

    if (chapters.length === 0) return

    if (lessons.length === 0) return

    setOpenChapters([chapters[0]._id])
    setInitialized(true)
  }, [chapters, lessons, initialized])

  /**
   * Remove invalid open chapter IDs if course data changes.
   */
  useEffect(() => {
    if (!initialized) return

    setOpenChapters((current) =>
      current.filter((chapterId) =>
        chapters.some((chapter) => chapter._id === chapterId),
      ),
    )
  }, [chapters, initialized])

  if (chapters.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        The curriculum is being prepared.
      </p>
    )
  }

  return (
    <Accordion
      type="multiple"
      value={openChapters}
      onValueChange={setOpenChapters}
      className="w-full"
    >
      {chapters.map((chapter, index) => {
        const chapterLessons =
          lessonsByChapter.get(chapter._id) ?? []

        return (
          <AccordionItem
            key={chapter._id}
            value={chapter._id}
          >
            <AccordionTrigger className="text-left">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {index + 1}. {chapter.title}
                </p>

                <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                  {chapterLessons.length}{' '}
                  {chapterLessons.length === 1
                    ? 'lesson'
                    : 'lessons'}
                </p>
              </div>
            </AccordionTrigger>

            <AccordionContent
              key={`${chapter._id}-${chapterLessons.length}`}
            >
              {chapterLessons.length > 0 ? (
                <ul className="space-y-1 pb-2">
                  {chapterLessons.map((lesson) => {
                    const playable =
                      hasAccess || lesson.isPreview

                    const row = (
                      <div
                        className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${
                          playable
                            ? 'hover:bg-accent cursor-pointer'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {playable ? (
                          <PlayCircle className="text-primary size-4 shrink-0" />
                        ) : (
                          <Lock className="size-4 shrink-0 opacity-50" />
                        )}

                        <span className="min-w-0 flex-1 truncate">
                          {lesson.title}
                        </span>

                        {lesson.isPreview && !hasAccess && (
                          <Badge variant="secondary">
                            Preview
                          </Badge>
                        )}

                        {lesson.durationSeconds ? (
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {formatDuration(
                              lesson.durationSeconds,
                            )}
                          </span>
                        ) : null}
                      </div>
                    )

                    return (
                      <li key={lesson._id}>
                        {playable ? (
                          <Link
                            to={`/learn/${courseId}/lessons/${lesson._id}`}
                            className="block"
                          >
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground px-2 pb-2 text-sm">
                  No lessons in this chapter yet.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}