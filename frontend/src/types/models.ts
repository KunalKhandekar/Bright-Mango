// Mirrors backend Mongoose models (src/modules/*/**.model.ts).
// The auth `user` object is mapped to `id` by the backend; all other
// documents serialize raw, so they carry `_id`.

export type Role = 'mentor' | 'student'

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  role: Role
  emailVerified: boolean
  status: 'active' | 'banned'
}

/** Raw user document as returned by /users/* admin endpoints */
export interface UserDoc {
  _id: string
  email: string
  name?: string
  avatar?: string
  role: Role
  emailVerified: boolean
  status: 'active' | 'banned'
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  sessionId: string
  deviceName?: string
  userAgent?: string
  ipAddress?: string
  lastSeenAt?: string
  current?: boolean
}

export type CourseStatus = 'draft' | 'published' | 'scheduled_delete'

export interface Course {
  _id: string
  mentorId: string
  title: string
  slug: string
  thumbnailUrl?: string
  thumbnailKey?: string
  shortDescription?: string
  description?: string
  /** paise */
  price: number
  status: CourseStatus
  publishedAt?: string
  /** When the scheduled hard-delete will run (present only while status is scheduled_delete). */
  scheduledDeleteAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  _id: string
  courseId: string
  title: string
  description?: string
  order: number
  createdAt: string
  updatedAt: string
}

export type VideoStatus = 'none' | 'processing' | 'ready'

export interface Lesson {
  _id: string
  courseId: string
  chapterId: string
  title: string
  description?: string
  thumbnailUrl?: string
  videoUid?: string
  videoPlaybackId?: string
  videoStatus: VideoStatus
  durationSeconds?: number
  subtitlesUrl?: string
  order: number
  isPreview: boolean
  createdAt: string
  updatedAt: string
}

export interface LessonResource {
  _id: string
  lessonId: string
  courseId: string
  title: string
  fileName: string
  fileSize?: number
  contentType?: string
  createdAt: string
}

export interface Enrollment {
  _id: string
  studentId: string | UserDoc
  mentorId: string
  courseId: string | Pick<Course, '_id' | 'title' | 'slug' | 'thumbnailUrl'>
  orderId?: string
  accessType: 'paid' | 'manual'
  enrolledAt: string
}

export interface Order {
  _id: string
  studentId: string
  mentorId: string
  courseId: string | Pick<Course, '_id' | 'title' | 'slug' | 'thumbnailUrl'>
  /** paise */
  amount: number
  /** paise, after discount */
  finalAmount: number
  couponId?: string
  razorpayOrderId: string
  status: 'pending' | 'paid' | 'failed'
  createdAt: string
}

export interface Coupon {
  _id: string
  mentorId: string
  /** null = valid for all courses */
  courseId: string | Pick<Course, '_id' | 'title' | 'slug'> | null
  code: string
  discountType: 'fixed' | 'percentage'
  /** paise for fixed, percent for percentage */
  value: number
  /** 0 = unlimited */
  usageLimit: number
  usedCount: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
}

export interface CommentUser {
  _id: string
  name?: string
  email?: string
  avatar?: string
  role: Role
}

export interface CommentNode {
  _id: string
  lessonId: string | Pick<Lesson, '_id' | 'title'>
  courseId: string | Pick<Course, '_id' | 'title' | 'slug'>
  userId: string | CommentUser
  parentCommentId: string | null
  rootCommentId?: string | null
  ancestorIds?: string[]
  depth: number
  directReplyCount: number
  content: string
  isEdited: boolean
  createdAt: string
  updatedAt: string
}

export interface LessonProgress {
  _id: string
  studentId: string
  courseId: string
  lessonId: string
  watchedSeconds: number
  lastPositionSeconds: number
  completed: boolean
  completionPercentage: number
  lastWatchedAt: string
}

export interface CourseProgress {
  totalLessons: number
  playableLessons: number
  completedLessons: number
  percentage: number
  lessons: Array<{
    lessonId: string
    completionPercentage: number
    completed: boolean
    lastPositionSeconds: number
    watchedSeconds: number
    durationSeconds: number
  }>
}

export interface RecentlyWatchedItem {
  _id: string
  studentId: string
  courseId: string
  lessonId:
    | string
    | (Pick<Lesson, '_id' | 'title' | 'chapterId' | 'courseId'> & { durationSeconds?: number })
  watchedAt: string
}

export interface CampaignAudience {
  type: 'all' | 'course' | 'students'
  courseId?: string
  studentIds?: string[]
}

export interface Campaign {
  _id: string
  mentorId: string
  subject: string
  body: string
  audience?: CampaignAudience
  totalRecipients: number
  sentCount: number
  status: 'pending' | 'scheduled' | 'sending' | 'completed' | 'cancelled'
  scheduledFor?: string
  createdAt: string
}

export interface EmailTemplate {
  _id: string
  name: string
  subject: string
  body: string
  /** Process this template is assigned to (absent = not assigned). */
  processKey?: string
  createdAt: string
  updatedAt: string
}

export interface EmailProcess {
  key: string
  label: string
  description: string
  variables: string[]
  defaultSubject: string
  defaultBody: string
  assignedTemplateId: string | null
  assignedTemplateName: string | null
}

export interface AuditLog {
  _id: string
  userId?: string | CommentUser
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface BlacklistEntry {
  _id: string
  email: string
  reason?: string
  blockedBy?: string
  createdAt: string
}

/** Get the string id whether or not a ref field was populated */
export function refId(ref: string | { _id: string }): string {
  return typeof ref === 'string' ? ref : ref._id
}
