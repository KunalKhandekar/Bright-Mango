import mongoose, { Types } from 'mongoose';
import { Lesson, LessonDoc } from './lesson.model.js';
import { Chapter } from '../chapter/chapter.model.js';
import { assertCourseOwner, getCourseOrThrow } from '../course/course.service.js';
import * as stream from '../../integrations/stream.service.js';
import { enqueueVideoStatusPoll } from '../../jobs/queues.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';

async function loadChapterOwned(chapterId: string, mentorId: string): Promise<{ courseId: Types.ObjectId }> {
  const chapter = await Chapter.findById(chapterId).lean();
  if (!chapter) throw ApiError.notFound('Chapter not found');
  await assertCourseOwner(chapter.courseId.toString(), mentorId);
  return { courseId: chapter.courseId };
}

export async function createLesson(
  chapterId: string,
  mentorId: string,
  input: { title: string; description?: string; isPreview?: boolean },
): Promise<LessonDoc> {
  const { courseId } = await loadChapterOwned(chapterId, mentorId);
  const last = await Lesson.findOne({ chapterId }).sort({ order: -1 }).lean();
  const order = last ? last.order + 1 : 0;
  const lesson = await Lesson.create({ courseId, chapterId, ...input, order });
  return lesson.toObject() as LessonDoc;
}

async function loadLessonOwned(lessonId: string, mentorId: string): Promise<LessonDoc> {
  const lesson = await Lesson.findById(lessonId).lean<LessonDoc>();
  if (!lesson) throw ApiError.notFound('Lesson not found');
  await assertCourseOwner(lesson.courseId.toString(), mentorId);
  return lesson;
}

/** Issue a one-time Cloudflare Stream direct-upload URL and start polling encode status. */
export async function createUploadUrl(
  lessonId: string,
  mentorId: string,
): Promise<{ uploadUrl: string; uid: string }> {
  await loadLessonOwned(lessonId, mentorId);
  const { uploadUrl, uid } = await stream.createDirectUpload();
  await Lesson.updateOne(
    { _id: lessonId },
    { $set: { videoUid: uid, videoStatus: 'processing', videoPlaybackId: null } },
  );
  await enqueueVideoStatusPoll(lessonId, uid);
  return { uploadUrl, uid };
}

export async function updateLesson(
  lessonId: string,
  mentorId: string,
  patch: { title?: string; description?: string; isPreview?: boolean; thumbnailUrl?: string },
): Promise<LessonDoc> {
  await loadLessonOwned(lessonId, mentorId);
  const updated = await Lesson.findByIdAndUpdate(lessonId, { $set: patch }, { new: true }).lean<LessonDoc>();
  return updated!;
}

export async function deleteLesson(lessonId: string, mentorId: string): Promise<void> {
  const lesson = await loadLessonOwned(lessonId, mentorId);
  if (lesson.videoUid) {
    await stream.deleteVideo(lesson.videoUid).catch(() => undefined);
  }
  await Lesson.deleteOne({ _id: lessonId });
}

export async function reorderLessons(
  chapterId: string,
  mentorId: string,
  orderedIds: string[],
): Promise<void> {
  await loadChapterOwned(chapterId, mentorId);
  const existing = await Lesson.find({ chapterId }).select('_id').lean();
  const existingIds = existing.map((l) => l._id.toString()).sort();
  const incoming = [...orderedIds].sort();
  if (existingIds.length !== incoming.length || existingIds.some((id, i) => id !== incoming[i])) {
    throw ApiError.badRequest(ErrorCode.VALIDATION_ERROR, 'orderedIds must match the chapter lessons exactly');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          Lesson.updateOne({ _id: new Types.ObjectId(id) }, { $set: { order: index } }, { session }),
        ),
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function getLessonOrThrow(lessonId: string): Promise<LessonDoc> {
  const lesson = await Lesson.findById(lessonId).lean<LessonDoc>();
  if (!lesson) throw ApiError.notFound('Lesson not found');
  return lesson;
}

/**
 * Course curriculum listing (safe fields only — no video uids/playback ids).
 * Public for published courses; drafts are visible only to the owning mentor.
 */
export async function listLessonsByCourse(
  courseId: string,
  requesterId?: string,
): Promise<Partial<LessonDoc>[]> {
  const course = await getCourseOrThrow(courseId);
  if (course.status !== 'published' && course.mentorId.toString() !== requesterId) {
    throw ApiError.notFound('Course not found');
  }
  return Lesson.find({ courseId })
    .sort({ chapterId: 1, order: 1 })
    .select('-videoUid -videoPlaybackId')
    .lean<Partial<LessonDoc>[]>();
}

/** Signed, short-lived playback token. Caller must already be enrollment-gated. */
export async function getPlayback(lessonId: string): Promise<{ playbackId: string; token: string }> {
  const lesson = await getLessonOrThrow(lessonId);
  if (lesson.videoStatus !== 'ready' || !lesson.videoUid) {
    throw ApiError.badRequest(ErrorCode.VIDEO_NOT_READY, 'Video is still processing');
  }
  const token = await stream.getSignedPlaybackToken(lesson.videoUid);
  return { playbackId: lesson.videoUid, token };
}

/**
 * Terminal failure: flip 'processing' → 'error' so the badge never lies forever.
 * Guarded by uid + status so a newer re-upload in flight is never clobbered.
 */
export async function markVideoError(lessonId: string, uid: string): Promise<void> {
  await Lesson.updateOne(
    { _id: lessonId, videoUid: uid, videoStatus: 'processing' },
    { $set: { videoStatus: 'error' } },
  );
}

/** Browser-reported failure of the direct upload (network drop, closed tab, Cloudflare reject). */
export async function reportUploadFailed(lessonId: string, mentorId: string, uid: string): Promise<void> {
  await loadLessonOwned(lessonId, mentorId);
  await markVideoError(lessonId, uid);
}

/** Used by the videoStatus worker once Cloudflare reports the video is ready. */
export async function applyVideoStatus(
  lessonId: string,
  status: { ready: boolean; playbackId: string | null; durationSeconds: number },
): Promise<void> {
  if (!status.ready) return;
  await Lesson.updateOne(
    { _id: lessonId },
    {
      $set: {
        videoStatus: 'ready',
        videoPlaybackId: status.playbackId,
        durationSeconds: status.durationSeconds,
      },
    },
  );
}
