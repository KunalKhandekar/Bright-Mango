import crypto from 'node:crypto';
import { LessonResource, LessonResourceDoc } from './lessonResource.model.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';
import { assertCourseOwner } from '../course/course.service.js';
import * as r2 from '../../integrations/r2.service.js';
import { ApiError } from '../../common/http/ApiError.js';

/** Issue a presigned upload URL + the object key the client should report back. */
export async function createUploadUrl(
  lessonId: string,
  mentorId: string,
  input: { fileName: string; contentType: string },
): Promise<{ uploadUrl: string; fileKey: string }> {
  const lesson = await getLessonOrThrow(lessonId);
  await assertCourseOwner(lesson.courseId.toString(), mentorId);

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `resources/${lessonId}/${crypto.randomBytes(8).toString('hex')}-${safeName}`;
  const uploadUrl = await r2.getPresignedUploadUrl(fileKey, input.contentType);
  return { uploadUrl, fileKey };
}

/** Persist resource metadata after the client has uploaded to R2. */
export async function createResource(
  lessonId: string,
  mentorId: string,
  input: { title: string; fileKey: string; fileName: string; fileSize?: number; contentType?: string },
): Promise<LessonResourceDoc> {
  const lesson = await getLessonOrThrow(lessonId);
  await assertCourseOwner(lesson.courseId.toString(), mentorId);

  const resource = await LessonResource.create({
    lessonId,
    courseId: lesson.courseId,
    title: input.title,
    fileKey: input.fileKey,
    fileName: input.fileName,
    fileSize: input.fileSize ?? 0,
    contentType: input.contentType ?? 'application/octet-stream',
  });
  return resource.toObject() as LessonResourceDoc;
}

export async function deleteResource(resourceId: string, mentorId: string): Promise<void> {
  const resource = await LessonResource.findById(resourceId).lean<LessonResourceDoc>();
  if (!resource) throw ApiError.notFound('Resource not found');
  await assertCourseOwner(resource.courseId.toString(), mentorId);
  await r2.deleteObject(resource.fileKey).catch(() => undefined);
  await LessonResource.deleteOne({ _id: resourceId });
}

export async function listResources(lessonId: string): Promise<LessonResourceDoc[]> {
  return LessonResource.find({ lessonId })
    .select('-fileKey')
    .sort({ createdAt: 1 })
    .lean<LessonResourceDoc[]>();
}

/** Short-lived presigned download URL — caller must be enrollment-gated. */
export async function getDownloadUrl(resourceId: string): Promise<{ url: string; fileName: string }> {
  const resource = await LessonResource.findById(resourceId).lean<LessonResourceDoc>();
  if (!resource) throw ApiError.notFound('Resource not found');
  const url = await r2.getPresignedDownloadUrl(resource.fileKey, resource.fileName);
  return { url, fileName: resource.fileName };
}

/** Resolve the courseId a resource belongs to (for the enrollment gate). */
export async function getResourceCourseId(resourceId: string): Promise<string> {
  const resource = await LessonResource.findById(resourceId).select('courseId').lean();
  if (!resource) throw ApiError.notFound('Resource not found');
  return resource.courseId.toString();
}
