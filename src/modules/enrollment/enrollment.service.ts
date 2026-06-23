import { Types, ClientSession } from 'mongoose';
import { Enrollment, EnrollmentDoc } from './enrollment.model.js';
import { Course } from '../course/course.model.js';
import { getCourseOrThrow } from '../course/course.service.js';
import { resolveOrCreateStudent } from '../user/user.service.js';
import { enqueueEmail } from '../../jobs/queues.js';
import { auditLog } from '../audit/audit.service.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
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
      action: 'ENROLLMENT_GRANTED',
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
  auditLog({
    userId: mentorId,
    action: 'ENROLLMENT_REVOKED',
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

export async function listByCourse(courseId: string, mentorId: string): Promise<EnrollmentDoc[]> {
  const course = await getCourseOrThrow(courseId);
  if (course.mentorId.toString() !== mentorId) {
    throw ApiError.forbidden('You do not own this course', ErrorCode.OWNERSHIP_REQUIRED);
  }
  return Enrollment.find({ courseId }).lean<EnrollmentDoc[]>();
}

export async function getMyEnrollment(studentId: string, courseId: string): Promise<EnrollmentDoc | null> {
  return Enrollment.findOne({ studentId, courseId }).lean<EnrollmentDoc>();
}
