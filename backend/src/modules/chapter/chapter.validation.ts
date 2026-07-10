import { body, param } from 'express-validator';

export const createChapterValidators = [
  param('courseId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional().isString().isLength({ max: 2000 }),
];

export const updateChapterValidators = [
  param('id').isMongoId(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional().isString().isLength({ max: 2000 }),
];

export const chapterIdParam = [param('id').isMongoId()];
export const courseIdParam = [param('courseId').isMongoId()];

export const reorderValidators = [
  param('courseId').isMongoId(),
  body('orderedIds').isArray({ min: 1 }),
  body('orderedIds.*').isMongoId(),
];
