import { Types } from 'mongoose';
import { Comment, CommentDoc } from './comment.model.js';
import { getLessonOrThrow } from '../lesson/lesson.service.js';
import { Lesson } from '../lesson/lesson.model.js';
import { User } from '../user/user.model.js';
import { Course } from '../course/course.model.js';
import { enqueueEmail } from '../../jobs/queues.js';
import { ROLES, Role } from '../../common/constants/roles.js';
import { ApiError } from '../../common/http/ApiError.js';
import { ErrorCode } from '../../common/http/errorCodes.js';
import { PaginationParams } from '../../common/utils/pagination.util.js';
import { escapeRegex } from '../../common/utils/regex.util.js';
import { env } from '../../config/env.js';

const AUTHOR_POPULATE = { path: 'userId', select: 'name avatar role' };

function appUrl(): string {
  return env.webAppUrl || (env.isProd ? 'https://app.brightmango.in' : 'http://localhost:3000');
}

function excerpt(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

/** List a lesson's top-level comments only. Replies are loaded lazily per parent. */
export async function listForLesson(
  lessonId: string,
  pagination: PaginationParams,
): Promise<{ items: CommentDoc[]; total: number }> {
  const baseQuery = { lessonId, parentCommentId: null };
  const [items, total] = await Promise.all([
    Comment.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate(AUTHOR_POPULATE)
      .lean<CommentDoc[]>(),
    Comment.countDocuments(baseQuery),
  ]);

  return { items, total };
}

export async function listReplies(
  parentCommentId: string,
  pagination: PaginationParams,
): Promise<{ items: CommentDoc[]; total: number }> {
  await loadComment(parentCommentId);
  const query = { parentCommentId: new Types.ObjectId(parentCommentId) };
  const [items, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate(AUTHOR_POPULATE)
      .lean<CommentDoc[]>(),
    Comment.countDocuments(query),
  ]);
  return { items, total };
}

async function enqueueReplyNotification(parent: CommentDoc, reply: CommentDoc, replierId: string): Promise<void> {
  if (parent.userId.toString() === replierId) return;

  const [recipient, replier, lesson] = await Promise.all([
    User.findById(parent.userId).select('email name').lean(),
    User.findById(replierId).select('name email').lean(),
    Lesson.findById(reply.lessonId).select('title courseId').lean(),
  ]);

  if (!recipient?.email || !lesson) return;

  const replierName = replier?.name || replier?.email || 'Someone';
  const lessonUrl = `${appUrl()}/learn/${lesson.courseId.toString()}/lessons/${lesson._id.toString()}`;

  await enqueueEmail({
    type: 'comment-reply',
    to: recipient.email,
    replierName,
    lessonTitle: lesson.title,
    replyExcerpt: excerpt(reply.content),
    lessonUrl,
  });
}

export async function createComment(
  lessonId: string,
  userId: string,
  content: string,
  parentCommentId?: string,
): Promise<CommentDoc> {
  const lesson = await getLessonOrThrow(lessonId);
  let parent: CommentDoc | null = null;
  let rootCommentId: Types.ObjectId | null = null;
  let ancestorIds: Types.ObjectId[] = [];
  let depth = 0;

  if (parentCommentId) {
    parent = await Comment.findById(parentCommentId).lean<CommentDoc>();
    if (!parent || parent.lessonId.toString() !== lessonId) {
      throw ApiError.badRequest(ErrorCode.VALIDATION_ERROR, 'Parent comment does not belong to this lesson');
    }
    ancestorIds = [...(parent.ancestorIds ?? []), parent._id];
    depth = (parent.depth ?? 0) + 1;
    rootCommentId = parent.rootCommentId ?? parent._id;
  }

  const comment = await Comment.create({
    lessonId,
    courseId: lesson.courseId,
    userId,
    parentCommentId: parentCommentId ?? null,
    rootCommentId,
    ancestorIds,
    depth,
    content,
  });
  const created = comment.toObject() as CommentDoc;

  if (parent) {
    await Promise.all([
      Comment.updateOne({ _id: parent._id }, { $inc: { directReplyCount: 1 } }),
      enqueueReplyNotification(parent, created, userId),
    ]);
  }

  return created;
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
 * Deleting a comment cascades all descendants.
 */
export async function deleteComment(commentId: string, userId: string, role: Role): Promise<void> {
  const comment = await loadComment(commentId);
  const isOwner = comment.userId.toString() === userId;
  if (!isOwner && role !== ROLES.MENTOR) {
    throw ApiError.forbidden('You cannot delete this comment', ErrorCode.OWNERSHIP_REQUIRED);
  }
  const id = new Types.ObjectId(commentId);
  await Comment.deleteMany({
    $or: [{ _id: id }, { ancestorIds: id }, { parentCommentId: id }],
  });
  if (comment.parentCommentId) {
    await Comment.updateOne(
      { _id: comment.parentCommentId },
      { $inc: { directReplyCount: -1 } },
    );
  }
}

/**
 * Delete every comment authored by a user within a course, cascading each comment's
 * descendant replies (even those written by other users) — reuses the same subtree
 * pattern as {@link deleteComment}. Used when an enrollment is revoked.
 */
export async function deleteUserCommentsForCourse(userId: string, courseId: string): Promise<void> {
  const ownComments = await Comment.find({ courseId, userId })
    .select('_id')
    .lean<{ _id: Types.ObjectId }[]>();
  if (ownComments.length === 0) return;

  const ids = ownComments.map((c) => c._id);
  await Comment.deleteMany({
    $or: [{ _id: { $in: ids } }, { ancestorIds: { $in: ids } }, { parentCommentId: { $in: ids } }],
  });
}

export interface RecentCommentsFilter {
  courseId?: string;
  studentId?: string;
  q?: string;
  unanswered?: boolean;
  sort?: 'newest' | 'oldest';
}

/**
 * Admin moderation listing: TOP-LEVEL comments on the mentor's own courses,
 * newest first by default. `q` searches top-level comment text only (escaped
 * case-insensitive regex); reply text is not searched. `unanswered` means
 * "no direct replies from anyone", not specifically "no mentor reply".
 */
export async function listRecent(
  mentorId: string,
  filter: RecentCommentsFilter,
  pagination: PaginationParams,
): Promise<{ items: unknown[]; total: number }> {
  const ownedCourses = await Course.find({ mentorId }).select('_id').lean();
  const ownedIds = ownedCourses.map((c) => c._id);

  const query: Record<string, unknown> = { parentCommentId: null };
  if (filter.courseId) {
    if (!ownedIds.some((id) => id.toString() === filter.courseId)) {
      throw ApiError.forbidden('You do not own this course', ErrorCode.OWNERSHIP_REQUIRED);
    }
    query.courseId = filter.courseId;
  } else {
    query.courseId = { $in: ownedIds };
  }
  if (filter.studentId) query.userId = filter.studentId;
  if (filter.q) query.content = { $regex: escapeRegex(filter.q), $options: 'i' };
  if (filter.unanswered) query.directReplyCount = 0;

  const dir = filter.sort === 'oldest' ? 1 : -1;
  const [items, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: dir, _id: dir })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({ path: 'userId', select: 'name email avatar' })
      .populate({ path: 'lessonId', select: 'title courseId' })
      .populate({ path: 'courseId', select: 'title slug' })
      .lean(),
    Comment.countDocuments(query),
  ]);
  return { items, total };
}

export async function getCommentCourseId(commentId: string): Promise<string> {
  const comment = await Comment.findById(commentId).select('courseId').lean();
  if (!comment) throw ApiError.notFound('Comment not found');
  return comment.courseId.toString();
}
