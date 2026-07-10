import { body, param } from 'express-validator';

export const createCampaignValidators = [
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('body').isString().trim().isLength({ min: 1, max: 50000 }),
];

export const campaignIdParam = [param('id').isMongoId()];
