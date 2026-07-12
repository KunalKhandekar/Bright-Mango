import { Types, ClientSession } from 'mongoose';
import { Enrollment, EnrollmentDoc } from './enrollment.model.js';
import { Course } from '../course/course.model.js';
import { getCourseOrThrow } from '../course/course.service.js';
import { resolveOrCreateStudent } from '../user/user.service.js';
import { User } from '../user/user.model.js';
import { LessonProgress } from '../progress/lessonProgress.model.js';
import { RecentlyWatched } from '../progress/recentlyWatched.model.js';
import { getProgressPercentages } from '../progress/progress.service.js';
import { deleteUserCommentsForCourse } from '../comment/comment.service.js';
import { enqueueEmail } from '../../jobs/queues.js';
import { auditLog } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
import { escapeRegex } from '../../common/utils/regex.util.js';
import { env } from '../../config/env.js';

/** Single source of truth for content access — used by the requireEnrollment middleware. */
export async function hasAccess(studentId: string, courseId: string): Promise<boolean> {
  const exists = await Enrollment.exists({ studentId, courseId });
  return exists !== null;
}

/** Create an enrollment idempotently. Safe to call inside a payment transaction. */
export async function enroll(
  params: {
    studentId: Types.ObjectId;
    mentorId: Types.ObjectId;
    courseId: Types.ObjectId;
    accessType: 'paid' | 'manual';
    orderId?: Types.ObjectId;
  },
  session?: ClientSession,
): Promise<{ enrollment: EnrollmentDoc; created: boolean }> {
  const existing = await Enrollment.findOne({
    studentId: params.studentId,
    courseId: params.courseId,
  }).session(session ?? null);
  if (existing) return { enrollment: existing.toObject() as EnrollmentDoc, created: false };

  const [doc] = await Enrollment.create([{ ...params, enrolledAt: new Date() }], { session });
  return { enrollment: doc.toObject() as EnrollmentDoc, created: true };
}

/** Mentor manually grants course access by email (no payment). */
export async function manualEnroll(
  mentorId: string,
  email: string,
  courseId: string,
): Promise<EnrollmentDoc> {
  const course = await getCourseOrThrow(courseId);
  if (course.mentorId.toString() !== mentorId) {
    throw ApiError.forbidden('You do not own this course', ErrorCode.OWNERSHIP_REQUIRED);
  }

  const { user } = await resolveOrCreateStudent(email, course.mentorId);
  const { enrollment, created } = await enroll({
    studentId: user._id,
    mentorId: course.mentorId,
    courseId: course._id,
    accessType: 'manual',
  });

  if (created) {
    await enqueueEmail({
      type: 'manual-enroll',
      to: user.email,
      courseTitle: course.title,
      loginUrl: env.isProd ? 'https://app.brightmango.in' : 'http://localhost:3000',
    });
    auditLog({
      userId: mentorId,
      action: AUDIT_ACTIONS.ENROLLMENT_GRANTED,
      entityType: 'Enrollment',
      entityId: enrollment._id,
      metadata: { studentId: user._id.toString(), courseId },
    });
  }
  return enrollment;
}

export async function revoke(enrollmentId: string, mentorId: string): Promise<void> {
  const enrollment = await Enrollment.findById(enrollmentId).lean<EnrollmentDoc>();
  if (!enrollment) throw ApiError.notFound('Enrollment not found');
  if (enrollment.mentorId.toString() !== mentorId) {
    throw ApiError.forbidden('Not your student', ErrorCode.OWNERSHIP_REQUIRED);
  }
  await Enrollment.deleteOne({ _id: enrollmentId });

  // Removing access also removes the student's footprint in that course:
  // lesson progress, recently-watched entries, and their comment threads.
  const studentId = enrollment.studentId.toString();
  const courseId = enrollment.courseId.toString();
  await Promise.all([
    LessonProgress.deleteMany({ studentId, courseId }),
    RecentlyWatched.deleteMany({ studentId, courseId }),
    deleteUserCommentsForCourse(studentId, courseId),
  ]);

  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.ENROLLMENT_REVOKED,
    entityType: 'Enrollment',
    entityId: enrollment._id,
    metadata: { studentId: enrollment.studentId.toString(), courseId: enrollment.courseId.toString() },
  });
}

export async function listMyEnrollments(
  studentId: string,
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const [items, total] = await Promise.all([
    Enrollment.find({ studentId })
      .sort({ enrolledAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({ path: 'courseId', model: Course, select: 'title slug thumbnailUrl' })
      .lean(),
    Enrollment.countDocuments({ studentId }),
  ]);
  return { items, total };
}

/**
 * Admin listing of the mentor's enrollments, optionally filtered to one course
 * and searched by student name/email. Each row is decorated with the student's
 * duration-weighted progress percentage for that course (batched per course —
 * two progress queries per distinct course on the page, not per student).
 */
export async function listForMentor(
  mentorId: string,
  filter: { courseId?: string; search?: string },
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const query: Record<string, unknown> = { mentorId };
  if (filter.courseId) query.courseId = filter.courseId;
  if (filter.search) {
    const regex = { $regex: escapeRegex(filter.search), $options: 'i' };
    const matches = await User.find({ $or: [{ name: regex }, { email: regex }] })
      .select('_id')
      .limit(500)
      .lean();
    query.studentId = { $in: matches.map((u) => u._id) };
  }

  const [items, total] = await Promise.all([
    Enrollment.find(query)
      .sort({ enrolledAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({ path: 'studentId', model: User, select: 'name email avatar' })
      .populate({ path: 'courseId', model: Course, select: 'title slug' })
      .lean<Array<EnrollmentDoc & { progressPercentage?: number }>>(),
    Enrollment.countDocuments(query),
  ]);

  // Decorate with progress, batching by course.
  const byCourse = new Map<string, string[]>();
  for (const e of items) {
    const courseId = (e.courseId as { _id?: Types.ObjectId })._id?.toString() ?? String(e.courseId);
    const studentId = (e.studentId as { _id?: Types.ObjectId })._id?.toString() ?? String(e.studentId);
    const list = byCourse.get(courseId) ?? [];
    list.push(studentId);
    byCourse.set(courseId, list);
  }
  const percentages = new Map<string, number>();
  await Promise.all(
    [...byCourse.entries()].map(async ([courseId, studentIds]) => {
      const perStudent = await getProgressPercentages(courseId, studentIds);
      for (const [studentId, pct] of perStudent) percentages.set(`${courseId}:${studentId}`, pct);
    }),
  );
  for (const e of items) {
    const courseId = (e.courseId as { _id?: Types.ObjectId })._id?.toString() ?? String(e.courseId);
    const studentId = (e.studentId as { _id?: Types.ObjectId })._id?.toString() ?? String(e.studentId);
    e.progressPercentage = percentages.get(`${courseId}:${studentId}`) ?? 0;
  }

  return { items, total };
}

/** Total enrollments plus per-course counts (for the admin enrollments tab). */
export async function getEnrollmentStats(
  mentorId: string,
): Promise<{ total: number; byCourse: Array<{ courseId: string; title: string; count: number }> }> {
  const [total, grouped] = await Promise.all([
    Enrollment.countDocuments({ mentorId }),
    Enrollment.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { mentorId: new Types.ObjectId(mentorId) } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const courses = await Course.find({ _id: { $in: grouped.map((g) => g._id) } })
    .select('title')
    .lean();
  const titleById = new Map(courses.map((c) => [c._id.toString(), c.title]));

  return {
    total,
    byCourse: grouped.map((g) => ({
      courseId: g._id.toString(),
      title: titleById.get(g._id.toString()) ?? 'Deleted course',
      count: g.count,
    })),
  };
}

export async function getMyEnrollment(studentId: string, courseId: string): Promise<EnrollmentDoc | null> {
  return Enrollment.findOne({ studentId, courseId }).lean<EnrollmentDoc>();
}
