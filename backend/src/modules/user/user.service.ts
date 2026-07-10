import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { User, UserDoc } from './user.model.js';
import { MentorStudent } from './mentorStudent.model.js';
import { EmailBlacklist } from './emailBlacklist.model.js';
import { ROLES } from '../../common/constants/roles.js';
import { normalizeEmail } from '../../common/utils/otp.util.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import * as r2 from '../../integrations/r2.service.js';

/** True if the email is blacklisted from the platform. */
export async function isEmailBlacklisted(email: string): Promise<boolean> {
  const exists = await EmailBlacklist.exists({ email: normalizeEmail(email) });
  return exists !== null;
}

export async function findByEmail(email: string): Promise<UserDoc | null> {
  return User.findOne({ email: normalizeEmail(email) }).lean<UserDoc>();
}

export async function findById(userId: string): Promise<UserDoc | null> {
  return User.findById(userId).lean<UserDoc>();
}

/**
 * Resolve a student by email, creating the account if new, and ensure they are mapped
 * to the given mentor. Returns { user, isNew }. Used by the OTP verify flow.
 */
export async function resolveOrCreateStudent(
  email: string,
  mentorId: Types.ObjectId,
): Promise<{ user: UserDoc; isNew: boolean }> {
  const normalized = normalizeEmail(email);

  let user = await User.findOne({ email: normalized });
  let isNew = false;

  if (!user) {
    user = await User.create({
      email: normalized,
      role: ROLES.STUDENT,
      emailVerified: true,
    });
    isNew = true;
  } else if (!user.emailVerified) {
    user.emailVerified = true;
    await user.save();
  }

  // Map to mentor if not already mapped (idempotent via unique index).
  if (user.role === ROLES.STUDENT) {
    await MentorStudent.updateOne(
      { mentorId, studentId: user._id },
      { $setOnInsert: { mentorId, studentId: user._id } },
      { upsert: true },
    );
  }

  return { user: user.toObject() as UserDoc, isNew };
}

export async function markLoggedIn(userId: Types.ObjectId | string): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
}

/**
 * Presigned PUT for a profile photo. Requires R2 plus a public base URL
 * (avatars are served publicly, unlike presigned-GET lesson resources).
 */
export async function createAvatarUploadUrl(
  userId: string,
  input: { fileName: string; contentType: string },
): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
  if (!env.r2.publicBaseUrl) {
    throw new ApiError(
      503,
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Public file serving is not configured (R2_PUBLIC_BASE_URL)',
    );
  }
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `avatars/${userId}/${crypto.randomBytes(8).toString('hex')}-${safeName}`;
  const uploadUrl = await r2.getPresignedUploadUrl(fileKey, input.contentType);
  const publicUrl = `${env.r2.publicBaseUrl.replace(/\/$/, '')}/${fileKey}`;
  return { uploadUrl, fileKey, publicUrl };
}

/** Returns the single bootstrap mentor (current single-mentor deployment). */
export async function getDefaultMentor(): Promise<UserDoc | null> {
  return User.findOne({ role: ROLES.MENTOR }).sort({ createdAt: 1 }).lean<UserDoc>();
}
