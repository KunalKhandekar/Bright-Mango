import { body, param } from 'express-validator';

export const uploadUrlValidators = [
  param('lessonId').isMongoId(),
  body('fileName').isString().trim().isLength({ min: 1, max: 255 }),
  body('contentType').isString().trim().isLength({ min: 1, max: 150 }),
];

export const createResourceValidators = [
  param('lessonId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('fileKey').isString().trim().isLength({ min: 1, max: 500 }),
  body('fileName').isString().trim().isLength({ min: 1, max: 255 }),
  body('fileSize').optional().isInt({ min: 0 }),
  body('contentType').optional().isString().isLength({ max: 150 }),
];

export const lessonIdParam = [param('lessonId').isMongoId()];
export const resourceIdParam = [param('id').isMongoId()];
