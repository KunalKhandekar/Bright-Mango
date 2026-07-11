import { LessonProgress, LessonProgressDoc } from './lessonProgress.model.js';
import { RecentlyWatched } from './recentlyWatched.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';

const COMPLETE_THRESHOLD = 0.9;
const RECENT_LIMIT = 20;

/**
 * Record progress for a lesson using the "live position" model:
 *
 * - `positionSeconds` is the current playback position. It drives the displayed lesson
 *   percentage (which therefore tracks the scrub bar and can move backwards on rewind) and
 *   is stored as the resume bookmark (`lastPositionSeconds`).
 * - `watchedSeconds` is kept as a monotonic HIGH-WATER mark (furthest position ever reached,
 *   capped at duration). It powers the course-level progress so the course bar never
 *   regresses even when a single lesson's live percentage dips.
 *
 * Completion is sticky: once the position reaches ≥90% of the duration (or the player fires
 * `ended`, which reports a position at the duration) the lesson stays complete forever.
 */
export async function recordProgress(
  studentId: string,
  lessonId: string,
  input: { positionSeconds: number },
): Promise<LessonProgressDoc> {
  const lesson = await getLessonOrThrow(lessonId);
  const duration = lesson.durationSeconds || 0;

  const existing = await LessonProgress.findOne({ studentId, lessonId });

  const position = Math.max(0, duration > 0 ? Math.min(input.positionSeconds, duration) : input.positionSeconds);
  // High-water mark: never decreases, so the course bar is monotonic.
  const highWater = duration > 0 ? Math.min(duration, Math.max(existing?.watchedSeconds ?? 0, position)) : Math.max(existing?.watchedSeconds ?? 0, position);
  // Displayed lesson percentage is LIVE (follows the current position).
  const percentage = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
  const completed = (existing?.completed ?? false) || (duration > 0 && position / duration >= COMPLETE_THRESHOLD);

  const progress = await LessonProgress.findOneAndUpdate(
    { studentId, lessonId },
    {
      $set: {
        courseId: lesson.courseId,
        watchedSeconds: highWater,
        lastPositionSeconds: position,
        completionPercentage: percentage,
        completed,
        lastWatchedAt: new Date(),
      },
    },
    { new: true, upsert: true },
  ).lean<LessonProgressDoc>();

  await touchRecentlyWatched(studentId, lessonId, lesson.courseId.toString());
  return progress!;
}

async function touchRecentlyWatched(studentId: string, lessonId: string, courseId: string): Promise<void> {
  await RecentlyWatched.findOneAndUpdate(
    { studentId, lessonId },
    { $set: { courseId, watchedAt: new Date() } },
    { upsert: true },
  );

  // Trim to the latest N per student.
  const stale = await RecentlyWatched.find({ studentId })
    .sort({ watchedAt: -1 })
    .skip(RECENT_LIMIT)
    .select('_id')
    .lean();
  if (stale.length > 0) {
    await RecentlyWatched.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
  }
}

export interface CourseProgress {
  totalLessons: number;
  playableLessons: number;
  completedLessons: number;
  percentage: number;
  lessons: Array<{
    lessonId: string;
    completionPercentage: number;
    completed: boolean;
    lastPositionSeconds: number;
    watchedSeconds: number;
    durationSeconds: number;
  }>;
}

export async function getCourseProgress(studentId: string, courseId: string): Promise<CourseProgress> {
  const [lessons, progresses] = await Promise.all([
    Lesson.find({ courseId }).select('durationSeconds').lean<{ _id: unknown; durationSeconds: number }[]>(),
    LessonProgress.find({ studentId, courseId }).lean<LessonProgressDoc[]>(),
  ]);

  const byLesson = new Map(progresses.map((p) => [p.lessonId.toString(), p]));
  const durationById = new Map(lessons.map((l) => [String(l._id), l.durationSeconds || 0]));

  // Overall progress is duration-based: watched seconds / total course duration.
  // A completed lesson counts as its full duration (so finishing every lesson reaches
  // 100%). Lessons still encoding (durationSeconds === 0) are excluded from the
  // denominator so they don't cap the percentage below 100%.
  let totalDuration = 0;
  let watchedTotal = 0;
  let playableLessons = 0;
  for (const lesson of lessons) {
    const duration = lesson.durationSeconds || 0;
    if (duration <= 0) continue;
    playableLessons += 1;
    totalDuration += duration;
    const p = byLesson.get(String(lesson._id));
    watchedTotal += p?.completed ? duration : Math.min(p?.watchedSeconds ?? 0, duration);
  }

  return {
    totalLessons: lessons.length,
    playableLessons,
    completedLessons: progresses.filter((p) => p.completed).length,
    percentage: totalDuration > 0 ? Math.min(100, Math.round((watchedTotal / totalDuration) * 100)) : 0,
    lessons: progresses.map((p) => {
      const duration = durationById.get(p.lessonId.toString()) ?? 0;
      return {
        lessonId: p.lessonId.toString(),
        completionPercentage: p.completionPercentage,
        completed: p.completed,
        lastPositionSeconds: p.lastPositionSeconds ?? 0,
        watchedSeconds: duration > 0 ? Math.min(p.watchedSeconds ?? 0, duration) : (p.watchedSeconds ?? 0),
        durationSeconds: duration,
      };
    }),
  };
}

export async function getRecentlyWatched(studentId: string): Promise<unknown[]> {
  return RecentlyWatched.find({ studentId })
    .sort({ watchedAt: -1 })
    .limit(RECENT_LIMIT)
    .populate({ path: 'lessonId', model: Lesson, select: 'title chapterId courseId durationSeconds' })
    .lean();
}
