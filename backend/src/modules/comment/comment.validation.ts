import { body, param, query } from 'express-validator';

export const lessonIdParam = [param('lessonId').isMongoId()];
export const commentIdParam = [param('id').isMongoId()];

export const createCommentValidators = [
  param('lessonId').isMongoId(),
  body('content').isString().trim().isLength({ min: 1, max: 5000 }),
  body('parentCommentId').optional().isMongoId(),
];

export const updateCommentValidators = [
  param('id').isMongoId(),
  body('content').isString().trim().isLength({ min: 1, max: 5000 }),
];

export const replyValidators = [
  param('id').isMongoId(),
  body('content').isString().trim().isLength({ min: 1, max: 5000 }),
];

export const listRecentValidators = [
  query('courseId').optional().isMongoId(),
  query('studentId').optional().isMongoId(),
  query('q').optional().isString().trim().isLength({ max: 200 }),
  query('unanswered').optional().isBoolean(),
  query('sort').optional().isIn(['newest', 'oldest']),
];
