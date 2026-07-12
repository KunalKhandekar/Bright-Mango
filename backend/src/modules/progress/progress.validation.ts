import { body, param } from 'express-validator';

export const recordProgressValidators = [
  param('lessonId').isMongoId(),
  body('positionSeconds').isInt({ min: 0 }).withMessage('positionSeconds must be a non-negative integer'),
  body('watchedSeconds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('watchedSeconds must be a non-negative integer'),
];

export const courseIdParam = [param('courseId').isMongoId()];
export const lessonIdParam = [param('lessonId').isMongoId()];
