import { body, param } from 'express-validator';

export const updateProfileValidators = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('avatar').optional().isString().isURL(),
];

export const studentIdParam = [param('id').isMongoId()];

export const blacklistValidators = [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
  body('reason').optional().isString().isLength({ max: 500 }),
];

export const emailParam = [param('email').isEmail()];
