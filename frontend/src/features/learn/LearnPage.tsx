import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clapperboard, GraduationCap, Loader2, Lock, VideoOff } from 'lucide-react'
import { listChapters } from '@/api/chapters'
import { getCourseMeta } from '@/api/courses'
import { getMyEnrollmentForCourse } from '@/api/enrollments'
import { getPlayback, listLessonsByCourse } from '@/api/lessons'
import { getCourseProgress } from '@/api/progress'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { keys } from '@/lib/query-client'
import { isApiError } from '@/types/api'
import { useAuthStore } from '@/stores/auth.store'
import type { Lesson } from '@/types/models'
import { CommentsPanel } from '@/features/learn/CommentsPanel'
import { LessonSidebar } from '@/features/learn/LessonSidebar'
import { ResourceList } from '@/features/learn/ResourceList'
import { VideoPlayer } from '@/features/learn/VideoPlayer'
import { useProgressReporter } from '@/features/learn/useProgressReporter'

export function LearnPage() {
  const { courseId = '', lessonId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const isMentor = user?.role === 'mentor'
  const isAuthed = status === 'authed'

  // Enrollment/progress are per-user — only query them for a signed-in, non-mentor viewer.
  // Guests (allowed here for preview lessons) skip these to avoid 401s.
  const accessQuery = useQuery({
    queryKey: keys.enrollmentAccess(courseId),
    queryFn: () => getMyEnrollmentForCourse(courseId),
    enabled: !isMentor && isAuthed,
  })
  const courseQuery = useQuery({
    queryKey: keys.courseMeta(courseId),
    queryFn: () => getCourseMeta(courseId),
    enabled: !!courseId,
  })
  const chaptersQuery = useQuery({
    queryKey: keys.chapters(courseId),
    queryFn: () => listChapters(courseId),
  })
  const lessonsQuery = useQuery({
    queryKey: keys.lessonsByCourse(courseId),
    queryFn: () => listLessonsByCourse(courseId),
  })
  const progressQuery = useQuery({
    queryKey: keys.courseProgress(courseId),
    queryFn: () => getCourseProgress(courseId),
    enabled: !isMentor && isAuthed,
  })

  const chapters = useMemo(() => chaptersQuery.data?.chapters ?? [], [chaptersQuery.data])
  const lessons = useMemo(() => {
    const list = lessonsQuery.data?.lessons ?? []
    // Order lessons by chapter order, then lesson order.
    const chapterRank = new Map(chapters.map((c, i) => [c._id, i]))
    return [...list].sort((a, b) => {
      const ca = chapterRank.get(a.chapterId) ?? 0
      const cb = chapterRank.get(b.chapterId) ?? 0
      return ca !== cb ? ca - cb : a.order - b.order
    })
  }, [lessonsQuery.data, chapters])

  const hasAccess = isMentor || (isAuthed && (accessQuery.data?.hasAccess ?? false))
  const activeLesson = lessons.find((l) => l._id === lessonId) ?? null

  // No lesson in the URL → jump to the first one.
  useEffect(() => {
    if (!lessonId && lessons.length > 0) {
      navigate(`/learn/${courseId}/lessons/${lessons[0]._id}`, { replace: true })
    }
  }, [lessonId, lessons, courseId, navigate])

  const canWatch = !!activeLesson && (hasAccess || activeLesson.isPreview)
  const videoReady = activeLesson?.videoStatus === 'ready'
  const hasVideo = !!activeLesson && activeLesson.videoStatus !== 'none'

  const playbackQuery = useQuery({
    queryKey: keys.playback(activeLesson?._id ?? ''),
    queryFn: () => getPlayback(activeLesson!._id),
    enabled: canWatch && hasVideo,
    retry: false,
    // Signed tokens expire (~1h) — refetch a fresh one when a stale tab replays.
    staleTime: 30 * 60 * 1000,
    refetchInterval: (query) =>
      isApiError(query.state.error, 'VIDEO_NOT_READY') ? 10_000 : false,
  })

  // Only enrolled, non-mentor viewers report progress. Preview viewers (guests or
  // logged-in-but-not-enrolled) can watch but must not report — the server would 403 them.
  const reporter = useProgressReporter(activeLesson?._id ?? null, courseId, hasAccess && !isMentor)

  const handleSelect = (lesson: Lesson) => {
    navigate(`/learn/${courseId}/lessons/${lesson._id}`)
  }

  const handleEnded = () => {
    const idx = lessons.findIndex((l) => l._id === activeLesson?._id)
    const next = idx >= 0 ? lessons[idx + 1] : undefined
    if (next && (hasAccess || next.isPreview)) handleSelect(next)
  }

  const loading =
    status === 'loading' ||
    chaptersQuery.isPending ||
    lessonsQuery.isPending ||
    accessQuery.isLoading

  // ── Enroll / login interstitial ────────────────────────────────────────────
  if (!loading && !hasAccess && activeLesson && !activeLesson.isPreview) {
    const loginNext = encodeURIComponent(`/learn/${courseId}/lessons/${activeLesson._id}`)
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
          <Lock className="text-muted-foreground size-6" />
        </div>
        <h1 className="text-xl font-semibold">
          {isAuthed ? 'Enroll to continue' : 'Sign in to continue'}
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          {isAuthed
            ? 'This lesson is part of the paid course. Enroll to unlock the full curriculum.'
            : 'This lesson is part of the paid course. Sign in and enroll to unlock the full curriculum.'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
          {isAuthed ? (
            <Button asChild>
              <Link to="/">Browse courses</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to={`/login?next=${loginNext}`}>Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Progress is an enrolled-only feature — hide it entirely for preview/non-enrolled viewers.
  const overallProgress = hasAccess ? progressQuery.data : undefined

  // Resume the active lesson where the student left off — unless it's finished or
  // essentially watched to the end.
  const activeProgress = overallProgress?.lessons.find((l) => l.lessonId === activeLesson?._id)
  const resumeAt =
    activeProgress &&
    !activeProgress.completed &&
    activeLesson?.durationSeconds &&
    activeProgress.lastPositionSeconds < activeLesson.durationSeconds * 0.95
      ? activeProgress.lastPositionSeconds
      : 0

  const playerArea = (
    <div className="space-y-4">
      {loading || (canWatch && hasVideo && playbackQuery.isPending) ? (
        <Skeleton className="aspect-video w-full rounded-lg" />
      ) : canWatch && videoReady && playbackQuery.data ? (
        <VideoPlayer
          token={playbackQuery.data.token}
          title={activeLesson?.title ?? ''}
          poster={activeLesson?.thumbnailUrl || undefined}
          startTime={resumeAt}
          onTimeUpdate={reporter.onTimeUpdate}
          onPlay={reporter.onPlay}
          onPause={reporter.onPause}
          onSeeking={reporter.onSeeking}
          onEnded={() => {
            reporter.onEnded()
            handleEnded()
          }}
        />
      ) : canWatch && isApiError(playbackQuery.error, 'VIDEO_NOT_READY') ? (
        <div className="bg-muted flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg text-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
          <p className="text-sm font-medium">This video is still processing</p>
          <p className="text-muted-foreground text-xs">
            It becomes available automatically — no need to refresh.
          </p>
        </div>
      ) : canWatch && !videoReady ? (
        <div className="bg-muted flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg text-center">
          <VideoOff className="text-muted-foreground size-6" />
          <p className="text-sm font-medium">No video yet</p>
          <p className="text-muted-foreground text-xs">
            The mentor hasn't uploaded a video for this lesson.
          </p>
        </div>
      ) : (
        <div className="bg-muted flex aspect-video w-full items-center justify-center rounded-lg">
          <Clapperboard className="text-muted-foreground size-8" />
        </div>
      )}

      {activeLesson && (
        <div>
          <h1 className="text-xl font-semibold">{activeLesson.title}</h1>
          {activeLesson.description && (
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">
              {activeLesson.description}
            </p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-background/80 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Button>
        <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <GraduationCap className="text-primary size-5" />
        </Link>
        {courseQuery.data?.course.title && (
          <span className="min-w-0 truncate font-semibold" title={courseQuery.data.course.title}>
            {courseQuery.data.course.title}
          </span>
        )}
        {overallProgress && overallProgress.totalLessons > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {overallProgress.completedLessons}/{overallProgress.playableLessons} lessons ·{' '}
              {Math.round(overallProgress.percentage)}%
            </span>
            <Progress value={overallProgress.percentage} className="w-24 sm:w-36" />
          </div>
        )}
        <div className={overallProgress ? '' : 'ml-auto'}>
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop: player + sidebar. Mobile: player + tabs. */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="hidden gap-8 lg:grid lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-8">
            {playerArea}
            {/* Resources & discussion are enrolled-only (no preview exemption on the server). */}
            {activeLesson && hasAccess && (
              <div className="space-y-6">
                <section>
                  <h2 className="mb-3 text-base font-medium">Resources</h2>
                  <ResourceList lessonId={activeLesson._id} />
                </section>
                <section>
                  <h2 className="mb-3 text-base font-medium">Discussion</h2>
                  <CommentsPanel lessonId={activeLesson._id} />
                </section>
              </div>
            )}
          </div>
          <aside className="min-w-0">
            <div className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto rounded-lg border p-3">
              <LessonSidebar
                chapters={chapters}
                lessons={lessons}
                progress={overallProgress}
                activeLessonId={activeLesson?._id ?? null}
                onSelect={handleSelect}
              />
            </div>
          </aside>
        </div>

        <div className="space-y-4 lg:hidden">
          {playerArea}
          {/* On mobile, default to the discussion for enrolled viewers; otherwise lessons.
              Resources & comments are enrolled-only. */}
          <Tabs defaultValue={hasAccess ? 'comments' : 'lessons'}>
            <TabsList className="w-full">
              <TabsTrigger value="comments" className="flex-1" disabled={!hasAccess}>
                Comments
              </TabsTrigger>
              <TabsTrigger value="lessons" className="flex-1">
                Lessons
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex-1" disabled={!hasAccess}>
                Resources
              </TabsTrigger>
            </TabsList>
            <TabsContent value="lessons">
              <LessonSidebar
                chapters={chapters}
                lessons={lessons}
                progress={overallProgress}
                activeLessonId={activeLesson?._id ?? null}
                onSelect={handleSelect}
              />
            </TabsContent>
            <TabsContent value="resources">
              {activeLesson && hasAccess && <ResourceList lessonId={activeLesson._id} />}
            </TabsContent>
            <TabsContent value="comments">
              {activeLesson && hasAccess && <CommentsPanel lessonId={activeLesson._id} />}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
