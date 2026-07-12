import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { ApiError } from '../../common/http/ApiError.js';
import { enqueueCourseDeletion, removeCourseDeletion, enqueueEmail } from '../../jobs/queues.js';
import { requestActionOtp, verifyActionOtp } from '../auth/otp.service.js';
import { auditLog } from '../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { assertCourseOwner, setStatus } from './course.service.js';
import { Course } from './course.model.js';
import { CourseDeletionRequest } from './courseDeletionRequest.model.js';

const PURPOSE = 'course_delete';
const DELAY_MS = env.courseDeleteDelayMinutes * 60 * 1000;

/** Step 1 — mentor requests deletion; OTP emailed to the mentor. */
export async function requestCourseDeletion(
  courseId: string,
  mentorId: string,
  mentorEmail: string,
): Promise<void> {
  const course = await assertCourseOwner(courseId, mentorId);
  const otp = await requestActionOtp(mentorEmail, `${PURPOSE}:${courseId}`);
  await enqueueEmail({
    type: 'deletion-otp',
    to: mentorEmail,
    otp,
    ttlMinutes: 5,
    courseTitle: course.title,
  });
}

/** Step 2 — verify OTP, schedule the delayed deletion (COURSE_DELETE_DELAY_MINUTES), flip status. */
export async function confirmCourseDeletion(
  courseId: string,
  mentorId: string,
  mentorEmail: string,
  otp: string,
): Promise<{ executeAt: Date }> {
  const course = await assertCourseOwner(courseId, mentorId);
  if (course.status === 'scheduled_delete') {
    throw ApiError.conflict('CONFLICT', 'This course is already scheduled for deletion');
  }
  await verifyActionOtp(mentorEmail, `${PURPOSE}:${courseId}`, otp);

  const executeAt = new Date(Date.now() + DELAY_MS);
  const jobId = await enqueueCourseDeletion(courseId, DELAY_MS);

  await CourseDeletionRequest.create({
    courseId,
    mentorId,
    jobId,
    executeAt,
    status: 'scheduled',
    previousStatus: course.status,
  });
  await setStatus(courseId, 'scheduled_delete');
  await Course.updateOne({ _id: courseId }, { $set: { scheduledDeleteAt: executeAt } });
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.COURSE_DELETE_SCHEDULED,
    entityType: 'Course',
    entityId: new Types.ObjectId(courseId),
    metadata: { executeAt },
  });
  return { executeAt };
}

/** Cancel a pending deletion before the delay window elapses. */
export async function cancelCourseDeletion(courseId: string, mentorId: string): Promise<void> {
  await assertCourseOwner(courseId, mentorId);
  const req = await CourseDeletionRequest.findOne({ courseId, status: 'scheduled' });
  if (!req) throw ApiError.notFound('No scheduled deletion for this course');

  if (req.jobId) await removeCourseDeletion(req.jobId);
  req.status = 'cancelled';
  await req.save();
  // Restore the status the course had before deletion was scheduled ('draft'
  // for legacy requests created before previousStatus existed).
  await setStatus(courseId, req.previousStatus ?? 'draft');
  await Course.updateOne({ _id: courseId }, { $set: { scheduledDeleteAt: null } });
  auditLog({
    userId: mentorId,
    action: AUDIT_ACTIONS.COURSE_DELETE_CANCELLED,
    entityType: 'Course',
    entityId: new Types.ObjectId(courseId),
  });
}
