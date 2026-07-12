import { ROLES, Role } from './roles.js';

/**
 * Fine-grained permissions. The `authorize()` middleware checks these against the
 * caller's role via ROLE_PERMISSIONS below. Adding a capability = add a permission
 * here and grant it to a role — never branch on role strings inside controllers.
 */
export const PERMISSIONS = {
  // Courses & content
  COURSE_CREATE: 'course:create',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',
  COURSE_PUBLISH: 'course:publish',
  CONTENT_MANAGE: 'content:manage', // chapters, lessons, resources, reorder

  // Admin panel
  ADMIN_PANEL: 'admin:panel',

  // Enrollment management
  ENROLLMENT_GRANT: 'enrollment:grant', // manual add
  ENROLLMENT_REVOKE: 'enrollment:revoke',
  ENROLLMENT_VIEW_ALL: 'enrollment:view_all',

  // Student management
  STUDENT_VIEW_ALL: 'student:view_all',
  STUDENT_BAN: 'student:ban',
  EMAIL_BLACKLIST: 'email:blacklist',

  // Sessions
  SESSION_MANAGE: 'session:manage', // mentor force-logout / view student sessions

  // Comments
  COMMENT_MODERATE: 'comment:moderate',
  COMMENT_REPLY: 'comment:reply',

  // Coupons & marketing
  COUPON_MANAGE: 'coupon:manage',
  CAMPAIGN_SEND: 'campaign:send',
  EMAIL_TEMPLATE_MANAGE: 'email_template:manage',

  // Payments & income
  PAYMENT_VIEW_ALL: 'payment:view_all',

  // Audit
  AUDIT_VIEW: 'audit:view',

  // Bug reports
  BUG_REPORT_MANAGE: 'bug_report:manage',

  // Student-facing
  CONTENT_CONSUME: 'content:consume', // watch purchased videos
  COMMENT_CRUD_OWN: 'comment:crud_own',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const MENTOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.COURSE_CREATE,
  PERMISSIONS.COURSE_UPDATE,
  PERMISSIONS.COURSE_DELETE,
  PERMISSIONS.COURSE_PUBLISH,
  PERMISSIONS.CONTENT_MANAGE,
  PERMISSIONS.ADMIN_PANEL,
  PERMISSIONS.ENROLLMENT_GRANT,
  PERMISSIONS.ENROLLMENT_REVOKE,
  PERMISSIONS.ENROLLMENT_VIEW_ALL,
  PERMISSIONS.STUDENT_VIEW_ALL,
  PERMISSIONS.STUDENT_BAN,
  PERMISSIONS.EMAIL_BLACKLIST,
  PERMISSIONS.SESSION_MANAGE,
  PERMISSIONS.COMMENT_MODERATE,
  PERMISSIONS.COMMENT_REPLY,
  PERMISSIONS.COUPON_MANAGE,
  PERMISSIONS.CAMPAIGN_SEND,
  PERMISSIONS.EMAIL_TEMPLATE_MANAGE,
  PERMISSIONS.PAYMENT_VIEW_ALL,
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.BUG_REPORT_MANAGE,
];

const STUDENT_PERMISSIONS: Permission[] = [
  PERMISSIONS.CONTENT_CONSUME,
  PERMISSIONS.COMMENT_CRUD_OWN,
  PERMISSIONS.COMMENT_REPLY,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.MENTOR]: MENTOR_PERMISSIONS,
  [ROLES.STUDENT]: STUDENT_PERMISSIONS,
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
