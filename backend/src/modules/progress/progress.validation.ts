import { body, param } from 'express-validator';

export const recordProgressValidators = [
  param('lessonId').isMongoId(),
  body('watchedSeconds').isInt({ min: 0 }).withMessage('watchedSeconds must be a non-negative integer'),
];

export const courseIdParam = [param('courseId').isMongoId()];
export const lessonIdParam = [param('lessonId').isMongoId()];
