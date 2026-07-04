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
  /** Enrolled users deep-link into the player for any lesson */
  hasAccess?: boolean
}

export function CurriculumAccordion({
  chapters,
  lessons,
  courseId,
  hasAccess = false,
}: CurriculumAccordionProps) {
  const byChapter = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const list = byChapter.get(lesson.chapterId) ?? []
    list.push(lesson)
    byChapter.set(lesson.chapterId, list)
  }

  if (chapters.length === 0) {
    return <p className="text-muted-foreground text-sm">The curriculum is being prepared.</p>
  }

  return (
    <Accordion type="multiple" defaultValue={chapters.slice(0, 1).map((c) => c._id)}>
      {chapters.map((chapter, index) => {
        const chapterLessons = byChapter.get(chapter._id) ?? []
        return (
          <AccordionItem key={chapter._id} value={chapter._id}>
            <AccordionTrigger className="text-left">
              <div>
                <p className="font-medium">
                  {index + 1}. {chapter.title}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                  {chapterLessons.length} {chapterLessons.length === 1 ? 'lesson' : 'lessons'}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {chapterLessons.map((lesson) => {
                  const playable = hasAccess || lesson.isPreview
                  const row = (
                    <div
                      className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${
                        playable ? 'hover:bg-accent cursor-pointer' : 'text-muted-foreground'
                      }`}
                    >
                      {playable ? (
                        <PlayCircle className="text-primary size-4 shrink-0" />
                      ) : (
                        <Lock className="size-4 shrink-0 opacity-50" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      {lesson.isPreview && !hasAccess && (
                        <Badge variant="secondary">Preview</Badge>
                      )}
                      {lesson.durationSeconds ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatDuration(lesson.durationSeconds)}
                        </span>
                      ) : null}
                    </div>
                  )
                  return (
                    <li key={lesson._id}>
                      {playable ? (
                        <Link to={`/learn/${courseId}/lessons/${lesson._id}`}>{row}</Link>
                      ) : (
                        row
                      )}
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
