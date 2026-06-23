import mongoose, { Types } from 'mongoose';
import { Chapter, ChapterDoc } from './chapter.model.js';
import { Lesson } from '../lesson/lesson.model.js';
import { assertCourseOwner } from '../course/course.service.js';
import { ApiError } from '../../common/http/ApiError.js';

export async function createChapter(
  courseId: string,
  mentorId: string,
  input: { title: string; description?: string },
): Promise<ChapterDoc> {
  await assertCourseOwner(courseId, mentorId);
  const last = await Chapter.findOne({ courseId }).sort({ order: -1 }).lean();
  const order = last ? last.order + 1 : 0;
  const chapter = await Chapter.create({ courseId, ...input, order });
  return chapter.toObject() as ChapterDoc;
}

async function loadChapterOwned(chapterId: string, mentorId: string): Promise<ChapterDoc> {
  const chapter = await Chapter.findById(chapterId).lean<ChapterDoc>();
  if (!chapter) throw ApiError.notFound('Chapter not found');
  await assertCourseOwner(chapter.courseId.toString(), mentorId);
  return chapter;
}

export async function updateChapter(
  chapterId: string,
  mentorId: string,
  patch: { title?: string; description?: string },
): Promise<ChapterDoc> {
  await loadChapterOwned(chapterId, mentorId);
  const updated = await Chapter.findByIdAndUpdate(chapterId, { $set: patch }, { new: true }).lean<ChapterDoc>();
  return updated!;
}

export async function deleteChapter(chapterId: string, mentorId: string): Promise<void> {
  const chapter = await loadChapterOwned(chapterId, mentorId);
  // Cascade lessons in this chapter.
  await Lesson.deleteMany({ chapterId: chapter._id });
  await Chapter.deleteOne({ _id: chapterId });
}

export async function listChapters(courseId: string): Promise<ChapterDoc[]> {
  return Chapter.find({ courseId }).sort({ order: 1 }).lean<ChapterDoc[]>();
}

/**
 * Bulk reorder (drag-and-drop). Validates the provided id set exactly matches the
 * course's chapters, then rewrites `order` in a transaction.
 */
export async function reorderChapters(
  courseId: string,
  mentorId: string,
  orderedIds: string[],
): Promise<void> {
  await assertCourseOwner(courseId, mentorId);
  const existing = await Chapter.find({ courseId }).select('_id').lean();
  const existingIds = existing.map((c) => c._id.toString()).sort();
  const incoming = [...orderedIds].sort();
  if (existingIds.length !== incoming.length || existingIds.some((id, i) => id !== incoming[i])) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'orderedIds must match the course chapters exactly');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          Chapter.updateOne({ _id: new Types.ObjectId(id) }, { $set: { order: index } }, { session }),
        ),
      );
    });
  } finally {
    await session.endSession();
  }
}
