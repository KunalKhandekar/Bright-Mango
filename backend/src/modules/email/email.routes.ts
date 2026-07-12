import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './email.controller.js';
import { createCampaignValidators, campaignIdParam } from './email.validation.js';

const router = Router();
const manage = [authenticate, authorize(PERMISSIONS.CAMPAIGN_SEND)];

router.post('/', ...manage, validate(createCampaignValidators), asyncHandler(ctrl.create));
router.get('/', ...manage, asyncHandler(ctrl.list));
router.get('/:id', ...manage, validate(campaignIdParam), asyncHandler(ctrl.getOne));
router.post('/:id/cancel', ...manage, validate(campaignIdParam), asyncHandler(ctrl.cancel));

export default router;
