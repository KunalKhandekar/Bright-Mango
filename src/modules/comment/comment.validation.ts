import { body, param } from 'express-validator';

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
