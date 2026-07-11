import { LessonProgress, LessonProgressDoc } from './lessonProgress.model.js';
import { RecentlyWatched } from './recentlyWatched.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';

const COMPLETE_THRESHOLD = 0.9;
const RECENT_LIMIT = 20;

/**
 * Record progress for a lesson. `watchedSeconds` is clamped to the lesson duration and
 * progress is monotonic (seeking back never lowers it). Marks complete at ≥90%.
 */
export async function recordProgress(
  studentId: string,
  lessonId: string,
  watchedSeconds: number,
): Promise<LessonProgressDoc> {
  const lesson = await getLessonOrThrow(lessonId);
  const duration = lesson.durationSeconds || 0;
  const clamped = duration > 0 ? Math.min(Math.max(0, watchedSeconds), duration) : Math.max(0, watchedSeconds);

  const existing = await LessonProgress.findOne({ studentId, lessonId });
  const bestWatched = Math.max(existing?.watchedSeconds ?? 0, clamped);
  const percentage = duration > 0 ? Math.min(100, Math.round((bestWatched / duration) * 100)) : 0;
  const completed = (existing?.completed ?? false) || (duration > 0 && bestWatched / duration >= COMPLETE_THRESHOLD);

  const progress = await LessonProgress.findOneAndUpdate(
    { studentId, lessonId },
    {
      $set: {
        courseId: lesson.courseId,
        watchedSeconds: bestWatched,
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
  lessons: Array<{ lessonId: string; completionPercentage: number; completed: boolean }>;
}

export async function getCourseProgress(studentId: string, courseId: string): Promise<CourseProgress> {
  const [lessons, progresses] = await Promise.all([
    Lesson.find({ courseId }).select('durationSeconds').lean<{ _id: unknown; durationSeconds: number }[]>(),
    LessonProgress.find({ studentId, courseId }).lean<LessonProgressDoc[]>(),
  ]);

  const watchedByLesson = new Map(progresses.map((p) => [p.lessonId.toString(), p.watchedSeconds]));

  // Overall progress is duration-based: watched seconds / total course duration.
  // Lessons that are still encoding (durationSeconds === 0) are excluded from the
  // denominator so they don't cap the percentage below 100%.
  let totalDuration = 0;
  let watchedTotal = 0;
  for (const lesson of lessons) {
    const duration = lesson.durationSeconds || 0;
    if (duration <= 0) continue;
    totalDuration += duration;
    watchedTotal += Math.min(watchedByLesson.get(String(lesson._id)) ?? 0, duration);
  }

  return {
    totalLessons: lessons.length,
    completedLessons: progresses.filter((p) => p.completed).length,
    percentage: totalDuration > 0 ? Math.min(100, Math.round((watchedTotal / totalDuration) * 100)) : 0,
    lessons: progresses.map((p) => ({
      lessonId: p.lessonId.toString(),
      completionPercentage: p.completionPercentage,
      completed: p.completed,
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
