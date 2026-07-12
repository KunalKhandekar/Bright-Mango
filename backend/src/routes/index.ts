import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import courseRoutes from '../modules/course/course.routes.js';
import chapterRoutes from '../modules/chapter/chapter.routes.js';
import lessonRoutes from '../modules/lesson/lesson.routes.js';
import resourceRoutes from '../modules/resource/resource.routes.js';
import enrollmentRoutes from '../modules/enrollment/enrollment.routes.js';
import paymentRoutes from '../modules/payment/payment.routes.js';
import couponRoutes from '../modules/coupon/coupon.routes.js';
import progressRoutes from '../modules/progress/progress.routes.js';
import commentRoutes from '../modules/comment/comment.routes.js';
import emailRoutes from '../modules/email/email.routes.js';
import emailTemplateRoutes from '../modules/emailTemplate/emailTemplate.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';

/** Root API router. Every module router mounts here under the API prefix. */
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, statusCode: 200, message: 'ok', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/coupons', couponRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/progress', progressRoutes);
router.use('/comments', commentRoutes);
router.use('/campaigns', emailRoutes);
router.use('/email-templates', emailTemplateRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/dashboard', dashboardRoutes);

// Content routes use mixed path roots (/courses, /chapters, /lessons, /resources),
// so they mount at the API root rather than under a single prefix.
router.use('/', chapterRoutes);
router.use('/', lessonRoutes);
router.use('/', resourceRoutes);
router.use('/', paymentRoutes);

export default router;
