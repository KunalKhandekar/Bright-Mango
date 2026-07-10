import { body, param } from 'express-validator';

export const createLessonValidators = [
  param('chapterId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('isPreview').optional().isBoolean().toBoolean(),
];

export const updateLessonValidators = [
  param('id').isMongoId(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 5000 }),
  body('isPreview').optional().isBoolean().toBoolean(),
  body('thumbnailUrl').optional().isString().isURL(),
];

export const lessonIdParam = [param('id').isMongoId()];

export const reorderLessonValidators = [
  param('chapterId').isMongoId(),
  body('orderedIds').isArray({ min: 1 }),
  body('orderedIds.*').isMongoId(),
];
