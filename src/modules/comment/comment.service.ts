import { Types } from 'mongoose';
import { Comment, CommentDoc } from './comment.model.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';
import { ROLES, Role } from '../../common/constants/roles.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';

interface ThreadedComment {
  comment: CommentDoc;
  replies: CommentDoc[];
}

/** List a lesson's comments as top-level threads with their replies (2 levels). */
export async function listForLesson(
  lessonId: string,
  pagination: PaginationParams,
): Promise<{ items: ThreadedComment[]; total: number }> {
  const baseQuery = { lessonId, parentCommentId: null };
  const [tops, total] = await Promise.all([
    Comment.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean<CommentDoc[]>(),
    Comment.countDocuments(baseQuery),
  ]);

  const topIds = tops.map((c) => c._id);
  const replies = await Comment.find({ parentCommentId: { $in: topIds } })
    .sort({ createdAt: 1 })
    .lean<CommentDoc[]>();

  const byParent = new Map<string, CommentDoc[]>();
  for (const r of replies) {
    const key = r.parentCommentId!.toString();
    (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(r);
  }

  return {
    items: tops.map((comment) => ({ comment, replies: byParent.get(comment._id.toString()) ?? [] })),
    total,
  };
}

export async function createComment(
  lessonId: string,
  userId: string,
  content: string,
  parentCommentId?: string,
): Promise<CommentDoc> {
  const lesson = await getLessonOrThrow(lessonId);

  if (parentCommentId) {
    const parent = await Comment.findById(parentCommentId).lean<CommentDoc>();
    if (!parent || parent.lessonId.toString() !== lessonId) {
      throw ApiError.badRequest(ErrorCode.VALIDATION_ERROR, 'Parent comment does not belong to this lesson');
    }
  }

  const comment = await Comment.create({
    lessonId,
    courseId: lesson.courseId,
    userId,
    parentCommentId: parentCommentId ?? null,
    content,
  });
  return comment.toObject() as CommentDoc;
}

async function loadComment(commentId: string): Promise<CommentDoc> {
  const comment = await Comment.findById(commentId).lean<CommentDoc>();
  if (!comment) throw ApiError.notFound('Comment not found');
  return comment;
}

export async function updateOwnComment(
  commentId: string,
  userId: string,
  content: string,
): Promise<CommentDoc> {
  const comment = await loadComment(commentId);
  if (comment.userId.toString() !== userId) {
    throw ApiError.forbidden('You can only edit your own comment', ErrorCode.OWNERSHIP_REQUIRED);
  }
  const updated = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { content, isEdited: true } },
    { new: true },
  ).lean<CommentDoc>();
  return updated!;
}

/**
 * Delete a comment. The owner can delete their own; a mentor can moderate any.
 * Deleting a top-level comment cascades its replies.
 */
export async function deleteComment(commentId: string, userId: string, role: Role): Promise<void> {
  const comment = await loadComment(commentId);
  const isOwner = comment.userId.toString() === userId;
  if (!isOwner && role !== ROLES.MENTOR) {
    throw ApiError.forbidden('You cannot delete this comment', ErrorCode.OWNERSHIP_REQUIRED);
  }
  await Comment.deleteMany({
    $or: [{ _id: new Types.ObjectId(commentId) }, { parentCommentId: new Types.ObjectId(commentId) }],
  });
}

export async function listRecent(
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const [items, total] = await Promise.all([
    Comment.find({})
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({ path: 'userId', select: 'name email avatar' })
      .lean(),
    Comment.estimatedDocumentCount(),
  ]);
  return { items, total };
}

export async function getCommentCourseId(commentId: string): Promise<string> {
  const comment = await Comment.findById(commentId).select('courseId').lean();
  if (!comment) throw ApiError.notFound('Comment not found');
  return comment.courseId.toString();
}
