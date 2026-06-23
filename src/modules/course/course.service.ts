import { Types } from 'mongoose';
import { Course, CourseDoc, COURSE_STATUS } from './course.model.js';
import { Chapter } from '../chapter/chapter.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';

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

export interface CreateCourseInput {
  title: string;
  shortDescription?: string;
  description?: string;
  price: number;
  thumbnailUrl?: string;
}

export async function createCourse(
  mentorId: Types.ObjectId,
  input: CreateCourseInput,
): Promise<CourseDoc> {
  const slug = await uniqueSlug(slugify(input.title));
  const course = await Course.create({ ...input, mentorId, slug, status: 'draft' });
  return course.toObject() as CourseDoc;
}

export async function updateCourse(
  courseId: string,
  mentorId: string,
  patch: Partial<CreateCourseInput> & { slug?: string },
): Promise<CourseDoc> {
  await assertCourseOwner(courseId, mentorId);
  if (patch.slug) patch.slug = await uniqueSlug(slugify(patch.slug));
  const updated = await Course.findByIdAndUpdate(courseId, { $set: patch }, { new: true }).lean<CourseDoc>();
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
