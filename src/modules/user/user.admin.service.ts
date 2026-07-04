import { User, UserDoc } from './user.model.js';
import { MentorStudent } from './mentorStudent.model.js';
import { EmailBlacklist } from './emailBlacklist.model.js';
import { Enrollment } from '../enrollment/enrollment.model.js';
import { destroyAllSessions } from '../auth/session.service.js';
import { auditLog } from '../audit/audit.service.js';
import { ROLES } from '../../common/constants/roles.js';
import { ApiError } from '../../common/http/ApiError.js';
import { normalizeEmail } from '../../common/utils/otp.util.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';

export async function updateProfile(
  userId: string,
  patch: { name?: string; avatar?: string },
): Promise<UserDoc> {
  const updated = await User.findByIdAndUpdate(userId, { $set: patch }, { new: true }).lean<UserDoc>();
  if (!updated) throw ApiError.notFound('User not found');
  return updated;
}

/** List a mentor's students (optionally searched by name/email). */
export async function listStudents(
  mentorId: string,
  search: string | undefined,
  pagination: PaginationParams,
): Promise<{ items: UserDoc[]; total: number }> {
  const links = await MentorStudent.find({ mentorId }).select('studentId').lean();
  const ids = links.map((l) => l.studentId);

  const query: Record<string, unknown> = { _id: { $in: ids } };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean<UserDoc[]>(),
    User.countDocuments(query),
  ]);
  return { items, total };
}

export async function getStudent(studentId: string): Promise<UserDoc> {
  const student = await User.findById(studentId).lean<UserDoc>();
  if (!student) throw ApiError.notFound('Student not found');
  return student;
}

async function assertStudent(studentId: string): Promise<UserDoc> {
  const student = await getStudent(studentId);
  if (student.role === ROLES.MENTOR) {
    throw ApiError.forbidden('Cannot perform this action on a mentor');
  }
  return student;
}

export async function banStudent(mentorId: string, studentId: string): Promise<void> {
  await assertStudent(studentId);
  await User.updateOne({ _id: studentId }, { $set: { status: 'banned' } });
  await destroyAllSessions(studentId); // immediate force-logout
  auditLog({ userId: mentorId, action: 'STUDENT_BANNED', entityType: 'User', entityId: undefined, metadata: { studentId } });
}

export async function unbanStudent(mentorId: string, studentId: string): Promise<void> {
  await assertStudent(studentId);
  await User.updateOne({ _id: studentId }, { $set: { status: 'active' } });
  auditLog({ userId: mentorId, action: 'STUDENT_UNBANNED', entityType: 'User', entityId: undefined, metadata: { studentId } });
}

export async function listStudentEnrollments(studentId: string): Promise<unknown[]> {
  return Enrollment.find({ studentId }).lean();
}

/** Blacklist an email: record it, ban the matching account (if any), force logout. */
export async function blacklistEmail(
  mentorId: string,
  rawEmail: string,
  reason: string,
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  await EmailBlacklist.updateOne(
    { email },
    { $setOnInsert: { email, reason, blockedBy: mentorId } },
    { upsert: true },
  );
  const user = await User.findOne({ email });
  if (user && user.role !== ROLES.MENTOR) {
    await User.updateOne({ _id: user._id }, { $set: { status: 'banned' } });
    await destroyAllSessions(user._id.toString());
  }
  auditLog({ userId: mentorId, action: 'EMAIL_BLACKLISTED', entityType: 'EmailBlacklist', metadata: { email } });
}

export async function removeFromBlacklist(mentorId: string, rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  await EmailBlacklist.deleteOne({ email });
  auditLog({ userId: mentorId, action: 'EMAIL_UNBLACKLISTED', entityType: 'EmailBlacklist', metadata: { email } });
}

export async function listBlacklist() {
  return EmailBlacklist.find({}).sort({ createdAt: -1 }).lean();
}
