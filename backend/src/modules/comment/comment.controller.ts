import { Request, Response } from 'express';
import { ApiResponse } from '../../common/http/ApiResponse.js';
import { getPagination, buildPaginationMeta } from '../../common/utils/pagination.util.js';
import { Comment } from './comment.model.js';
import { ApiError } from '../../common/http/ApiError.js';
import * as commentService from './comment.service.js';

export async function list(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await commentService.listForLesson(req.params.lessonId, pagination);
  return ApiResponse.ok(res, 'Comments', { comments: items }, buildPaginationMeta(total, pagination));
}

export async function replies(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await commentService.listReplies(req.params.id, pagination);
  return ApiResponse.ok(res, 'Replies', { comments: items }, buildPaginationMeta(total, pagination));
}

export async function create(req: Request, res: Response): Promise<Response> {
  const comment = await commentService.createComment(
    req.params.lessonId,
    req.auth!.userId,
    req.body.content,
    req.body.parentCommentId,
  );
  return ApiResponse.created(res, 'Comment posted', { comment });
}

export async function update(req: Request, res: Response): Promise<Response> {
  const comment = await commentService.updateOwnComment(req.params.id, req.auth!.userId, req.body.content);
  return ApiResponse.ok(res, 'Comment updated', { comment });
}

export async function remove(req: Request, res: Response): Promise<Response> {
  await commentService.deleteComment(req.params.id, req.auth!.userId, req.auth!.role);
  return ApiResponse.ok(res, 'Comment deleted');
}

/** Mentor reply — replies to a comment on its lesson. */
export async function reply(req: Request, res: Response): Promise<Response> {
  const parent = await Comment.findById(req.params.id).select('lessonId').lean();
  if (!parent) throw ApiError.notFound('Comment not found');
  const comment = await commentService.createComment(
    parent.lessonId.toString(),
    req.auth!.userId,
    req.body.content,
    req.params.id,
  );
  return ApiResponse.created(res, 'Reply posted', { comment });
}

export async function recent(req: Request, res: Response): Promise<Response> {
  const pagination = getPagination(req);
  const { items, total } = await commentService.listRecent(
    req.auth!.userId,
    {
      courseId: typeof req.query.courseId === 'string' ? req.query.courseId : undefined,
      studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      unanswered: req.query.unanswered === 'true',
      sort: req.query.sort === 'oldest' ? 'oldest' : 'newest',
    },
    pagination,
  );
  return ApiResponse.ok(res, 'Recent comments', { comments: items }, buildPaginationMeta(total, pagination));
}
