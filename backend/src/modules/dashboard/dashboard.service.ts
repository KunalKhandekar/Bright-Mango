import { Types } from 'mongoose';
import { Course } from '../course/course.model.js';
import { Enrollment } from '../enrollment/enrollment.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { LessonProgress } from '../progress/lessonProgress.model.js';
import { MentorStudent } from '../user/mentorStudent.model.js';
import { DateRange } from '../../common/utils/dateRange.util.js';

/**
 * Read-only cross-module aggregations for the mentor overview dashboard.
 * Revenue numbers stay in payment.analytics.service.ts; this module covers
 * everything else the overview needs (counts, enrollment trend, engagement).
 */

/** Day/month buckets align to Indian time (the platform charges in INR). */
const BUCKET_TIMEZONE = 'Asia/Kolkata';

export async function getDashboardSummary(mentorId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [courses, publishedCourses, students, enrollments, newEnrollments30d] = await Promise.all([
    Course.countDocuments({ mentorId }),
    Course.countDocuments({ mentorId, status: 'published' }),
    MentorStudent.countDocuments({ mentorId }),
    Enrollment.countDocuments({ mentorId }),
    Enrollment.countDocuments({ mentorId, enrolledAt: { $gte: thirtyDaysAgo } }),
  ]);
  return { courses, publishedCourses, students, enrollments, newEnrollments30d };
}

export async function getEnrollmentTimeseries(
  mentorId: string,
  range: DateRange,
  interval: 'day' | 'month',
) {
  const buckets = await Enrollment.aggregate<{ _id: Date; count: number }>([
    {
      $match: {
        mentorId: new Types.ObjectId(mentorId),
        enrolledAt: { $gte: range.from, $lte: range.to },
      },
    },
    {
      $group: {
        _id: { $dateTrunc: { date: '$enrolledAt', unit: interval, timezone: BUCKET_TIMEZONE } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return buckets.map((b) => ({ date: b._id.toISOString(), enrollments: b.count }));
}

export interface CourseEngagement {
  courseId: string;
  title: string;
  enrolledStudents: number;
  activeStudents: number;
  /** 0-100, or null when the course has no playable lessons or no enrollments. */
  completionRate: number | null;
}

export async function getEngagementStats(mentorId: string, range: DateRange) {
  const courses = await Course.find({ mentorId }).select('title').lean();
  if (courses.length === 0) {
    return { activeLearners: 0, lessonsCompleted: 0, avgCompletionRate: 0, courses: [] };
  }
  const courseIds = courses.map((c) => c._id);
  const activeMatch = {
    courseId: { $in: courseIds },
    lastWatchedAt: { $gte: range.from, $lte: range.to },
  };

  const [lessonCounts, enrollmentCounts, completedCounts, activeCounts, activeLearnersResult] =
    await Promise.all([
      // Playable lessons only (durationSeconds > 0), matching course-progress semantics.
      Lesson.aggregate<{ _id: Types.ObjectId; lessons: number }>([
        { $match: { courseId: { $in: courseIds }, durationSeconds: { $gt: 0 } } },
        { $group: { _id: '$courseId', lessons: { $sum: 1 } } },
      ]),
      Enrollment.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { courseId: { $in: courseIds } } },
        { $group: { _id: '$courseId', count: { $sum: 1 } } },
      ]),
      LessonProgress.aggregate<{ _id: Types.ObjectId; completedLessons: number }>([
        { $match: { courseId: { $in: courseIds }, completed: true } },
        { $group: { _id: '$courseId', completedLessons: { $sum: 1 } } },
      ]),
      // Two-stage group: distinct (course, student) pairs first, then count per course.
      LessonProgress.aggregate<{ _id: Types.ObjectId; activeStudents: number }>([
        { $match: activeMatch },
        { $group: { _id: { courseId: '$courseId', studentId: '$studentId' } } },
        { $group: { _id: '$_id.courseId', activeStudents: { $sum: 1 } } },
      ]),
      LessonProgress.aggregate<{ n: number }>([
        { $match: activeMatch },
        { $group: { _id: '$studentId' } },
        { $count: 'n' },
      ]),
    ]);

  const byId = <T extends { _id: Types.ObjectId }>(rows: T[]) =>
    new Map(rows.map((r) => [r._id.toString(), r]));
  const lessonsByCourse = byId(lessonCounts);
  const enrolledByCourse = byId(enrollmentCounts);
  const completedByCourse = byId(completedCounts);
  const activeByCourse = byId(activeCounts);

  let totalCompleted = 0;
  let totalPossible = 0;
  const perCourse: CourseEngagement[] = courses.map((course) => {
    const id = course._id.toString();
    const lessons = lessonsByCourse.get(id)?.lessons ?? 0;
    const enrolled = enrolledByCourse.get(id)?.count ?? 0;
    const completed = completedByCourse.get(id)?.completedLessons ?? 0;
    totalCompleted += completed;
    const possible = enrolled * lessons;
    totalPossible += possible;
    return {
      courseId: id,
      title: course.title,
      enrolledStudents: enrolled,
      activeStudents: activeByCourse.get(id)?.activeStudents ?? 0,
      completionRate: possible > 0 ? Math.round((100 * completed) / possible) : null,
    };
  });

  perCourse.sort((a, b) => b.enrolledStudents - a.enrolledStudents);

  return {
    activeLearners: activeLearnersResult[0]?.n ?? 0,
    lessonsCompleted: totalCompleted,
    avgCompletionRate: totalPossible > 0 ? Math.round((100 * totalCompleted) / totalPossible) : 0,
    courses: perCourse.slice(0, 8),
  };
}
