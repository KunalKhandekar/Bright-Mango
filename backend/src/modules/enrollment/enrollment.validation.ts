import { body, param, query } from 'express-validator';

export const manualEnrollValidators = [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
  body('courseId').isMongoId(),
];

export const listEnrollmentsValidators = [
  query('courseId').optional().isMongoId(),
  query('search').optional().isString().trim().isLength({ max: 200 }),
];

export const enrollmentIdParam = [param('id').isMongoId()];
export const courseIdParam = [param('courseId').isMongoId()];
