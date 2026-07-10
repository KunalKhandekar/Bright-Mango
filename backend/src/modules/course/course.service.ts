import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { Course, CourseDoc, COURSE_STATUS } from './course.model.js';
import { Chapter } from '../chapter/chapter.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
import { env } from '../../config/env.js';
import * as r2 from '../../integrations/r2.service.js';

const THUMBNAIL_PREFIX = 'course-thumbnails';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Load a course or 404. */
export async function getCourseOrThrow(courseId: string): Promise<CourseDoc> {
  const course = await Course.findById(courseId).lean<CourseDoc>();
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}

/**
 * Assert the given mentor owns the course. Reused by chapter/lesson/resource mutations.
 * Returns the course so callers avoid a second fetch.
 */
export async function assertCourseOwner(courseId: string, mentorId: string): Promise<CourseDoc> {
  const course = await getCourseOrThrow(courseId);
  if (course.mentorId.toString() !== mentorId) {
    throw ApiError.forbidden('You do not own this course', ErrorCode.OWNERSHIP_REQUIRED);
  }
  return course;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || 'course';
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Course.exists({ slug })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function publicAssetUrl(fileKey: string): string {
  if (!env.r2.publicBaseUrl) {
    throw new ApiError(
      503,
      ErrorCode.INTEGRATION_NOT_CONFIGURED,
      'Public file serving is not configured (R2_PUBLIC_BASE_URL)',
    );
  }
  return `${env.r2.publicBaseUrl.replace(/\/$/, '')}/${fileKey}`;
}

function assertOwnThumbnailKey(thumbnailKey: string, mentorId: string): void {
  if (!thumbnailKey) return;
  const prefix = `${THUMBNAIL_PREFIX}/${mentorId}/`;
  if (!thumbnailKey.startsWith(prefix)) {
    throw ApiError.badRequest(
      ErrorCode.VALIDATION_ERROR,
      'Thumbnail key does not belong to this mentor',
    );
  }
}

function buildCoursePayload(
  mentorId: string,
  input: CreateCourseInput | (Partial<CreateCourseInput> & { slug?: string }),
): Partial<CreateCourseInput & { slug: string; thumbnailUrl: string }> {
  const payload: Partial<CreateCourseInput & { slug: string; thumbnailUrl: string }> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.shortDescription !== undefined) payload.shortDescription = input.shortDescription;
  if (input.description !== undefined) payload.description = input.description;
  if (input.price !== undefined) payload.price = input.price;
  if (input.thumbnailKey !== undefined) {
    assertOwnThumbnailKey(input.thumbnailKey, mentorId);
    payload.thumbnailKey = input.thumbnailKey;
    payload.thumbnailUrl = input.thumbnailKey ? publicAssetUrl(input.thumbnailKey) : '';
  }

  return payload;
}

export interface CreateCourseInput {
  title: string;
  shortDescription?: string;
  description?: string;
  price: number;
  thumbnailKey?: string;
}

export async function createThumbnailUploadUrl(
  mentorId: string,
  input: { fileName: string; contentType: string },
): Promise<{ uploadUrl: string; thumbnailKey: string; publicUrl: string }> {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const thumbnailKey = `${THUMBNAIL_PREFIX}/${mentorId}/${crypto.randomBytes(8).toString('hex')}-${safeName}`;
  const publicUrl = publicAssetUrl(thumbnailKey);
  const uploadUrl = await r2.getPresignedUploadUrl(thumbnailKey, input.contentType);
  return { uploadUrl, thumbnailKey, publicUrl };
}

export async function createCourse(
  mentorId: Types.ObjectId,
  input: CreateCourseInput,
): Promise<CourseDoc> {
  const slug = await uniqueSlug(slugify(input.title));
  const payload = buildCoursePayload(mentorId.toString(), input);
  const course = await Course.create({ ...payload, mentorId, slug, status: 'draft' });
  return course.toObject() as CourseDoc;
}

export async function updateCourse(
  courseId: string,
  mentorId: string,
  patch: Partial<CreateCourseInput> & { slug?: string },
): Promise<CourseDoc> {
  const existing = await assertCourseOwner(courseId, mentorId);
  if (patch.slug) patch.slug = await uniqueSlug(slugify(patch.slug));
  const payload = buildCoursePayload(mentorId, patch);
  if (patch.slug !== undefined) payload.slug = patch.slug;

  const updated = await Course.findByIdAndUpdate(courseId, { $set: payload }, { new: true }).lean<CourseDoc>();
  if (
    patch.thumbnailKey !== undefined &&
    existing.thumbnailKey &&
    existing.thumbnailKey !== patch.thumbnailKey
  ) {
    await r2.deleteObject(existing.thumbnailKey).catch(() => undefined);
  }
  return updated!;
}

export async function publishCourse(courseId: string, mentorId: string): Promise<CourseDoc> {
  await assertCourseOwner(courseId, mentorId);
  const lessonCount = await Lesson.countDocuments({ courseId });
  if (lessonCount === 0) {
    throw ApiError.badRequest(ErrorCode.COURSE_NOT_PUBLISHABLE, 'Add at least one lesson before publishing');
  }
  const updated = await Course.findByIdAndUpdate(
    courseId,
    { $set: { status: 'published', publishedAt: new Date() } },
    { new: true },
  ).lean<CourseDoc>();
  return updated!;
}

export async function listPublishedCourses(
  pagination: PaginationParams,
): Promise<{ items: CourseDoc[]; total: number }> {
  const query = { status: 'published' as const };
  const [items, total] = await Promise.all([
    Course.find(query)
      .select('-description')
      .sort({ publishedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean<CourseDoc[]>(),
    Course.countDocuments(query),
  ]);
  return { items, total };
}

export async function getPublishedBySlug(slug: string): Promise<CourseDoc> {
  const course = await Course.findOne({ slug, status: { $ne: 'draft' } }).lean<CourseDoc>();
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}

export async function listMentorCourses(
  mentorId: string,
  pagination: PaginationParams,
): Promise<{ items: CourseDoc[]; total: number }> {
  const query = { mentorId };
  const [items, total] = await Promise.all([
    Course.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean<CourseDoc[]>(),
    Course.countDocuments(query),
  ]);
  return { items, total };
}

type CourseStatus = (typeof COURSE_STATUS)[number];

/** Set the course status (used by the delete schedule/cancel flow). */
export async function setStatus(courseId: string, status: CourseStatus): Promise<void> {
  await Course.updateOne({ _id: courseId }, { $set: { status } });
}

/** Hard-delete a course and its content tree (called by the courseDelete worker). */
export async function hardDeleteCourseTree(courseId: string): Promise<{ lessonUids: string[] }> {
  const lessons = await Lesson.find({ courseId }).select('videoUid').lean();
  const lessonUids = lessons.map((l) => l.videoUid).filter((u): u is string => Boolean(u));

  await Promise.all([
    Lesson.deleteMany({ courseId }),
    Chapter.deleteMany({ courseId }),
    Course.deleteOne({ _id: courseId }),
  ]);
  return { lessonUids };
}
