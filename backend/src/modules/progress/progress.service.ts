import { LessonProgress, LessonProgressDoc } from './lessonProgress.model.js';
import { RecentlyWatched } from './recentlyWatched.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';

const COMPLETE_THRESHOLD = 0.9;
const RECENT_LIMIT = 20;

/**
 * Record progress for a lesson using the "true watch-time" model:
 *
 * - `deltaSeconds` is the amount of NEW time actually played since the last report
 *   (the client ignores seeks/jumps), so watched-time accumulates across pauses and
 *   sessions. The running total is capped at the lesson duration, so a retried/duplicate
 *   report can only over-count harmlessly up to 100%.
 * - `positionSeconds` is the current playback position, stored as the resume bookmark.
 *
 * Marks complete once cumulative watch-time reaches ≥90% of the duration.
 */
export async function recordProgress(
  studentId: string,
  lessonId: string,
  input: { deltaSeconds: number; positionSeconds: number },
): Promise<LessonProgressDoc> {
  const lesson = await getLessonOrThrow(lessonId);
  const duration = lesson.durationSeconds || 0;
  const delta = Math.max(0, input.deltaSeconds);

  const existing = await LessonProgress.findOne({ studentId, lessonId });
  const nextWatched = (existing?.watchedSeconds ?? 0) + delta;
  const bestWatched = duration > 0 ? Math.min(nextWatched, duration) : nextWatched;

  const position = Math.max(0, duration > 0 ? Math.min(input.positionSeconds, duration) : input.positionSeconds);
  const percentage = duration > 0 ? Math.min(100, Math.round((bestWatched / duration) * 100)) : 0;
  const completed = (existing?.completed ?? false) || (duration > 0 && bestWatched / duration >= COMPLETE_THRESHOLD);

  const progress = await LessonProgress.findOneAndUpdate(
    { studentId, lessonId },
    {
      $set: {
        courseId: lesson.courseId,
        watchedSeconds: bestWatched,
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
  completedLessons: number;
  percentage: number;
  lessons: Array<{
    lessonId: string;
    completionPercentage: number;
    completed: boolean;
    lastPositionSeconds: number;
  }>;
}

export async function getCourseProgress(studentId: string, courseId: string): Promise<CourseProgress> {
  const [lessons, progresses] = await Promise.all([
    Lesson.find({ courseId }).select('durationSeconds').lean<{ _id: unknown; durationSeconds: number }[]>(),
    LessonProgress.find({ studentId, courseId }).lean<LessonProgressDoc[]>(),
  ]);

  const byLesson = new Map(progresses.map((p) => [p.lessonId.toString(), p]));

  // Overall progress is duration-based: watched seconds / total course duration.
  // A completed lesson counts as its full duration (so finishing every lesson reaches
  // 100%). Lessons still encoding (durationSeconds === 0) are excluded from the
  // denominator so they don't cap the percentage below 100%.
  let totalDuration = 0;
  let watchedTotal = 0;
  for (const lesson of lessons) {
    const duration = lesson.durationSeconds || 0;
    if (duration <= 0) continue;
    totalDuration += duration;
    const p = byLesson.get(String(lesson._id));
    watchedTotal += p?.completed ? duration : Math.min(p?.watchedSeconds ?? 0, duration);
  }

  return {
    totalLessons: lessons.length,
    completedLessons: progresses.filter((p) => p.completed).length,
    percentage: totalDuration > 0 ? Math.min(100, Math.round((watchedTotal / totalDuration) * 100)) : 0,
    lessons: progresses.map((p) => ({
      lessonId: p.lessonId.toString(),
      completionPercentage: p.completionPercentage,
      completed: p.completed,
      lastPositionSeconds: p.lastPositionSeconds ?? 0,
    })),
  };
}

export async function getRecentlyWatched(studentId: string): Promise<unknown[]> {
  return RecentlyWatched.find({ studentId })
    .sort({ watchedAt: -1 })
    .limit(RECENT_LIMIT)
    .populate({ path: 'lessonId', model: Lesson, select: 'title chapterId courseId durationSeconds' })
    .lean();
}
