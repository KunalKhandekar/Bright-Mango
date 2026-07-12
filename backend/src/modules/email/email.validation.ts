import { body, param } from 'express-validator';

const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;

export const createCampaignValidators = [
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('body').isString().trim().isLength({ min: 1, max: 50000 }),
  body('audience.type').optional().isIn(['all', 'course', 'students']),
  body('audience.courseId')
    .if(body('audience.type').equals('course'))
    .isMongoId()
    .withMessage('audience.courseId is required for a course audience'),
  body('audience.studentIds')
    .if(body('audience.type').equals('students'))
    .isArray({ min: 1, max: 500 })
    .withMessage('audience.studentIds must list 1-500 students'),
  body('audience.studentIds.*').optional().isMongoId(),
  body('scheduledFor')
    .optional()
    .isISO8601()
    .custom((value: string) => {
      if (new Date(value).getTime() - Date.now() < MIN_SCHEDULE_LEAD_MS) {
        throw new Error('Scheduled time must be at least 2 minutes in the future');
      }
      return true;
    }),
];

export const campaignIdParam = [param('id').isMongoId()];
