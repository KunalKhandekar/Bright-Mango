import { body, param } from 'express-validator';

export const createCourseValidators = [
  body('title').isString().trim().isLength({ min: 3, max: 160 }),
  body('price').isInt({ min: 0 }).withMessage('Price must be a non-negative integer (paise)'),
  body('shortDescription').optional().isString().isLength({ max: 300 }),
  body('description').optional().isString().isLength({ max: 20000 }),
  body('thumbnailKey').optional({ values: 'undefined' }).isString().trim().isLength({ max: 500 }),
];

export const updateCourseValidators = [
  param('id').isMongoId(),
  body('title').optional().isString().trim().isLength({ min: 3, max: 160 }),
  body('slug').optional().isString().trim().isLength({ min: 3, max: 180 }),
  body('price').optional().isInt({ min: 0 }),
  body('shortDescription').optional().isString().isLength({ max: 300 }),
  body('description').optional().isString().isLength({ max: 20000 }),
  body('thumbnailKey').optional({ values: 'undefined' }).isString().trim().isLength({ max: 500 }),
];

export const thumbnailUploadValidators = [
  body('fileName').isString().trim().isLength({ min: 1, max: 255 }),
  body('contentType')
    .isString()
    .matches(/^image\/[a-z0-9.+-]+$/i)
    .withMessage('Course thumbnails must be an image'),
];

export const courseIdParam = [param('id').isMongoId()];
export const slugParam = [param('slug').isString().trim().isLength({ min: 1, max: 200 })];
export const confirmDeleteValidators = [
  param('id').isMongoId(),
  body('otp').isString().matches(/^\d{6}$/),
];
