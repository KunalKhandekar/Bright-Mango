import { body, param } from 'express-validator';

export const manualEnrollValidators = [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
  body('courseId').isMongoId(),
];

export const enrollmentIdParam = [param('id').isMongoId()];
export const courseIdParam = [param('courseId').isMongoId()];
