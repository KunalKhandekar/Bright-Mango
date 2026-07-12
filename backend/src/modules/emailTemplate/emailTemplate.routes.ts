import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import * as ctrl from './emailTemplate.controller.js';
import {
  createTemplateValidators,
  updateTemplateValidators,
  templateIdParam,
  assignProcessValidators,
} from './emailTemplate.validation.js';

const router = Router();
const manage = [authenticate, authorize(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)];

router.get('/processes', ...manage, asyncHandler(ctrl.processes));
router.put('/processes/:processKey', ...manage, validate(assignProcessValidators), asyncHandler(ctrl.assign));

router.get('/', ...manage, asyncHandler(ctrl.list));
router.post('/', ...manage, validate(createTemplateValidators), asyncHandler(ctrl.create));
router.get('/:id', ...manage, validate(templateIdParam), asyncHandler(ctrl.get));
router.patch('/:id', ...manage, validate(updateTemplateValidators), asyncHandler(ctrl.update));
router.delete('/:id', ...manage, validate(templateIdParam), asyncHandler(ctrl.remove));

export default router;
