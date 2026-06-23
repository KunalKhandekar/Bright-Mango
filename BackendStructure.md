# BrightMango LMS - Database Architecture

## Tech Stack

### Backend

* Node.js
* Express.js
* MongoDB
* Redis
* BullMQ
* Cloudflare R2
* Cloudflare Stream
* Razorpay

---

# Authentication Architecture

## Session Based Authentication

Authentication will be:

* Email + OTP
* Redis Session Based
* Stateful
* No JWT
* Session Management by Mentor
* Maximum 2 Active Sessions per Student

### Session Flow

1. User enters email
2. OTP sent
3. OTP verified
4. Session ID generated using crypto.randomBytes()
5. Session stored in Redis
6. Session ID stored in HttpOnly Cookie
7. Session valid for 7 days

---

# MongoDB Collections

---

## Users

Single users collection.

Do NOT create separate student and mentor collections.

```js
{
  _id: ObjectId,

  role: "mentor" | "student",

  email: String,
  emailVerified: Boolean,

  name: String,
  avatar: String,

  status: "active" | "banned",

  lastLoginAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```js
email: unique
role
status
```

---

## MentorStudents

Allows future mentor scaling.

```js
{
  _id: ObjectId,

  mentorId: ObjectId,
  studentId: ObjectId,

  createdAt: Date
}
```

Indexes:

```js
mentorId
studentId
mentorId + studentId (unique)
```

---

## UserSessions

Session analytics.

Authentication source remains Redis.

```js
{
  _id: ObjectId,

  sessionId: String,

  userId: ObjectId,

  deviceName: String,

  userAgent: String,

  ipAddress: String,

  isActive: Boolean,

  lastSeenAt: Date,

  createdAt: Date
}
```

Indexes:

```js
userId
sessionId
```

---

## EmailBlacklist

```js
{
  _id: ObjectId,

  email: String,

  reason: String,

  blockedBy: ObjectId,

  createdAt: Date
}
```

Indexes:

```js
email (unique)
```

---

# Course Management

---

## Courses

```js
{
  _id: ObjectId,

  mentorId: ObjectId,

  title: String,

  slug: String,

  thumbnailUrl: String,

  shortDescription: String,

  description: String,

  price: Number,

  status:
    "draft" |
    "published" |
    "scheduled_delete",

  publishedAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```js
mentorId
slug (unique)
status
```

---

## Chapters

```js
{
  _id: ObjectId,

  courseId: ObjectId,

  title: String,

  description: String,

  order: Number,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```js
courseId
courseId + order
```

---

## Lessons

```js
{
  _id: ObjectId,

  courseId: ObjectId,

  chapterId: ObjectId,

  title: String,

  description: String,

  thumbnailUrl: String,

  videoPlaybackId: String,

  durationSeconds: Number,

  subtitlesUrl: String,

  order: Number,

  isPreview: Boolean,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```js
courseId
chapterId
chapterId + order
```

---

## LessonResources

```js
{
  _id: ObjectId,

  lessonId: ObjectId,

  title: String,

  fileUrl: String,

  fileSize: Number,

  uploadedAt: Date
}
```

Indexes:

```js
lessonId
```

---

# Payments

---

## Orders

Created before Razorpay payment.

```js
{
  _id: ObjectId,

  studentId: ObjectId,

  mentorId: ObjectId,

  courseId: ObjectId,

  amount: Number,

  razorpayOrderId: String,

  couponId: ObjectId,

  finalAmount: Number,

  status:
    "pending" |
    "paid" |
    "failed",

  createdAt: Date
}
```

Indexes:

```js
studentId
courseId
razorpayOrderId
```

---

## Payments

Payment record.

```js
{
  _id: ObjectId,

  orderId: ObjectId,

  razorpayOrderId: String,

  razorpayPaymentId: String,

  razorpaySignature: String,

  verified: Boolean,

  paidAt: Date
}
```

Indexes:

```js
orderId
razorpayPaymentId
```

---

## Enrollments

Source of truth.

```js
{
  _id: ObjectId,

  studentId: ObjectId,

  mentorId: ObjectId,

  courseId: ObjectId,

  orderId: ObjectId,

  accessType:
    "paid" |
    "manual",

  enrolledAt: Date
}
```

Indexes:

```js
studentId
courseId
studentId + courseId (unique)
```

---

# Coupons

---

## Coupons

```js
{
  _id: ObjectId,

  mentorId: ObjectId,

  courseId: ObjectId,

  code: String,

  discountType:
    "fixed" |
    "percentage",

  value: Number,

  usageLimit: Number,

  usedCount: Number,

  expiresAt: Date,

  createdAt: Date
}
```

Indexes:

```js
mentorId
code
```

---

## CouponUsages

```js
{
  _id: ObjectId,

  couponId: ObjectId,

  studentId: ObjectId,

  orderId: ObjectId,

  usedAt: Date
}
```

Indexes:

```js
couponId
studentId
```

---

# Progress Tracking

---

## LessonProgress

Main progress collection.

```js
{
  _id: ObjectId,

  studentId: ObjectId,

  courseId: ObjectId,

  lessonId: ObjectId,

  watchedSeconds: Number,

  completed: Boolean,

  completionPercentage: Number,

  lastWatchedAt: Date
}
```

Indexes:

```js
studentId
courseId
lessonId

studentId + lessonId (unique)
```

---

## RecentlyWatchedLessons

```js
{
  _id: ObjectId,

  studentId: ObjectId,

  lessonId: ObjectId,

  watchedAt: Date
}
```

Indexes:

```js
studentId
watchedAt
```

---

# Comments

---

## Comments

Supports nested replies.

```js
{
  _id: ObjectId,

  lessonId: ObjectId,

  userId: ObjectId,

  parentCommentId: ObjectId,

  content: String,

  isEdited: Boolean,

  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```js
lessonId
parentCommentId
```

---

# Email System

---

## EmailCampaigns

```js
{
  _id: ObjectId,

  mentorId: ObjectId,

  subject: String,

  body: String,

  totalRecipients: Number,

  sentCount: Number,

  status:
    "pending" |
    "sending" |
    "completed",

  createdAt: Date
}
```

Indexes:

```js
mentorId
status
```

---

# Audit & Security

---

## AuditLogs

Track sensitive actions.

```js
{
  _id: ObjectId,

  userId: ObjectId,

  action: String,

  entityType: String,

  entityId: ObjectId,

  metadata: Object,

  createdAt: Date
}
```

Examples:

* Course Deleted
* Student Banned
* Coupon Created
* Enrollment Revoked

---

## CourseDeletionRequests

OTP protected deletion.

```js
{
  _id: ObjectId,

  courseId: ObjectId,

  mentorId: ObjectId,

  otpVerified: Boolean,

  executeAt: Date,

  createdAt: Date
}
```

BullMQ delayed job deletes course after 24 hours.

````

# Redis Structure

```text
otp:{email}
````

Value:

```json
{
  "otpHash": "...",
  "attempts": 0
}
```

TTL:

```text
5 minutes
```

---

```text
session:{sessionId}
```

Value:

```json
{
  "userId": "...",
  "role": "student",
  "deviceId": "...",
  "ip": "...",
  "userAgent": "..."
}
```

TTL:

```text
7 days
```

---

```text
user_sessions:{userId}
```

Value:

```json
[
  "session1",
  "session2"
]
```

Used for:

* Session limit
* Force logout
* Mentor session management

---

```text
trusted_device:{userId}:{deviceId}
```

TTL:

```text
7 days
```

Prevents OTP re-verification.

```
```

Ready for review
Select text to add comments on the plan
BrightMango LMS — Backend System Plan
Context
BrightMango is a single-mentor (multi-mentor-ready) LMS. Two design docs already exist (Structure.MD, BackendStructure.md) defining the DB models, Redis layout, and feature set. The repo is currently greenfield — only the two markdown docs and a LICENSE, no code.

This plan turns those specs into a concrete, secure backend architecture: a feature/module folder structure, a strict routes → controller → service request flow, normalized success/error response classes, and a fully fleshed-out Auth & Session module (every service + endpoint, all edge cases) as the reference implementation that every other module will mirror.

Locked decisions: TypeScript · Feature/module-based layout · express-validator · Auth & Session is the reference module.

Stack: Node.js + Express 5 + TypeScript · MongoDB (Mongoose) · Redis (ioredis) · BullMQ · Cloudflare R2 (files) + Cloudflare Stream (video) · Razorpay · Nodemailer.

1. Folder Structure
brightmango-backend/
├── src/
│   ├── config/
│   │   ├── env.ts                 # load + validate process.env (fail-fast on boot)
│   │   ├── db.ts                  # mongoose connection
│   │   ├── redis.ts               # ioredis client (single shared instance)
│   │   ├── queue.ts               # BullMQ connection + queue registry
│   │   └── index.ts
│   │
│   ├── common/
│   │   ├── http/
│   │   │   ├── ApiResponse.ts     # success envelope class
│   │   │   ├── ApiError.ts        # error class (extends Error)
│   │   │   ├── httpStatus.ts      # status code constants
│   │   │   └── errorCodes.ts      # machine-readable error code enum
│   │   ├── middlewares/
│   │   │   ├── asyncHandler.ts    # wraps async controllers, forwards errors
│   │   │   ├── authenticate.ts    # session-cookie → Redis lookup → req.auth
│   │   │   ├── authorize.ts       # role + permission gate
│   │   │   ├── validate.ts        # runs express-validator chains → ApiError
│   │   │   ├── rateLimiter.ts     # Redis-backed limiter (per IP / per email)
│   │   │   ├── notFound.ts        # 404 catch-all
│   │   │   └── errorHandler.ts    # global error handler → ApiError envelope
│   │   ├── utils/
│   │   │   ├── crypto.util.ts     # session ids, OTP hashing, signature verify
│   │   │   ├── otp.util.ts        # generate / format OTP
│   │   │   ├── cookie.util.ts     # set/clear HttpOnly session cookie
│   │   │   ├── pagination.util.ts # parse page/limit → skip; build meta
│   │   │   └── logger.ts          # pino logger
│   │   ├── constants/
│   │   │   ├── roles.ts           # ROLES = { MENTOR, STUDENT }
│   │   │   ├── permissions.ts     # PERMISSIONS + role→permission map
│   │   │   └── redisKeys.ts       # key builders: otp(), session(), userSessions()...
│   │   └── types/
│   │       ├── express.d.ts       # augment Express.Request with `auth`
│   │       └── common.types.ts
│   │
│   ├── modules/
│   │   ├── auth/                   # ◀ FULLY FLESHED reference module
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── session.service.ts
│   │   │   ├── auth.validation.ts
│   │   │   └── auth.types.ts
│   │   ├── user/                  # User + MentorStudents + EmailBlacklist
│   │   ├── course/                # Courses (+ OTP-protected delete)
│   │   ├── chapter/               # Chapters (+ reorder)
│   │   ├── lesson/                # Lessons (+ reorder, signed video URLs)
│   │   ├── resource/              # LessonResources (R2 upload/download)
│   │   ├── enrollment/            # Enrollments (+ manual enroll)
│   │   ├── payment/               # Orders + Payments + Razorpay verify
│   │   ├── coupon/                # Coupons + CouponUsages
│   │   ├── progress/              # LessonProgress + RecentlyWatched
│   │   ├── comment/               # nested Comments
│   │   ├── email/                 # EmailCampaigns (bulk mail)
│   │   └── audit/                 # AuditLogs
│   │
│   │   # each module dir mirrors auth/: <m>.routes / .controller / .service
│   │   #   / .validation / .model (Mongoose schema) / .types
│   │
│   ├── integrations/              # external service wrappers (thin, swappable)
│   │   ├── r2.service.ts          # Cloudflare R2 presigned URLs
│   │   ├── stream.service.ts      # Cloudflare Stream upload + signed playback
│   │   ├── razorpay.service.ts    # order create + signature verify
│   │   └── mailer.service.ts      # Nodemailer transport
│   │
│   ├── jobs/                      # BullMQ
│   │   ├── queues.ts              # queue definitions (email, courseDelete, video)
│   │   ├── workers/
│   │   │   ├── email.worker.ts        # OTP + bulk campaign + notifications
│   │   │   ├── courseDelete.worker.ts # 24h delayed course deletion
│   │   │   └── videoStatus.worker.ts  # poll Cloudflare Stream encode status
│   │   └── index.ts
│   │
│   ├── routes/
│   │   └── index.ts               # mounts every module router under /api/v1
│   │
│   ├── app.ts                     # express app: helmet, cors, cookies, routes, errors
│   └── server.ts                  # bootstrap: connect db/redis, start workers, listen
│
├── tests/                         # vitest/jest — mirrors modules/
├── .env.example
├── .eslintrc / .prettierrc
├── tsconfig.json
└── package.json
Models placement: each Mongoose schema lives in its owning module as <m>.model.ts (e.g. modules/user/user.model.ts, modules/course/course.model.ts). The User, MentorStudents, EmailBlacklist, and UserSessions schemas live under modules/user/ and modules/auth/ respectively. Mongoose's global model registry avoids circular-import issues across modules.

2. Request Flow (strict layering)
HTTP → Router → [global mw: helmet/cors/cookieParser/rateLimit]
            → [route mw: validate(chains) → authenticate → authorize(perms)]
            → Controller (thin: read req, call service, send ApiResponse)
            → Service (all business logic, DB + Redis + integrations)
            → Model / Redis / Integration
Layer rules:

Router — declares path + attaches middleware chain + maps to one controller method. No logic.
Controller — extracts validated input, calls a service, wraps result in ApiResponse, calls res. Never touches Mongoose/Redis directly. Wrapped in asyncHandler.
Service — pure business logic; returns plain data or throws ApiError. No req/res knowledge. Reusable across HTTP, jobs, and CLI.
Model / integration — data access only.
asyncHandler wraps every controller so thrown errors (incl. ApiError) flow to the global errorHandler, which renders the normalized error envelope.

3. Normalized Response Classes
Success — ApiResponse<T> (common/http/ApiResponse.ts)
class ApiResponse<T> {
  readonly success = true;
  constructor(
    public statusCode: number,
    public message: string,
    public data: T | null = null,
    public meta?: Record<string, unknown>,  // pagination, counts, etc.
  ) {}
  send(res: Response) { return res.status(this.statusCode).json(this); }
}
// usage: return new ApiResponse(200, "OTP sent", { cooldown: 60 }).send(res);
Wire shape:

{ "success": true, "statusCode": 200, "message": "OTP sent",
  "data": { "cooldown": 60 }, "meta": { "page": 1, "limit": 20, "total": 57 } }
Error — ApiError (common/http/ApiError.ts)
class ApiError extends Error {
  readonly success = false;
  readonly isOperational = true;
  constructor(
    public statusCode: number,
    public errorCode: string,         // from errorCodes.ts, e.g. "OTP_EXPIRED"
    message: string,
    public details?: unknown,         // validation issues array, etc.
  ) { super(message); }

  static badRequest(code, msg, details?) { return new ApiError(400, code, msg, details); }
  static unauthorized(code, msg)         { return new ApiError(401, code, msg); }
  static forbidden(code, msg)            { return new ApiError(403, code, msg); }
  static notFound(code, msg)             { return new ApiError(404, code, msg); }
  static conflict(code, msg, details?)   { return new ApiError(409, code, msg, details); }
  static tooMany(code, msg)              { return new ApiError(429, code, msg); }
}
Wire shape:

{ "success": false, "statusCode": 409, "errorCode": "SESSION_LIMIT_EXCEEDED",
  "message": "Maximum 2 active sessions reached",
  "details": { "activeSessions": [ { "sessionId": "…", "deviceName": "…", "lastSeenAt": "…" } ] } }
Global errorHandler: if err instanceof ApiError → render as above; else log full stack + return generic 500 INTERNAL_ERROR (never leak internals). Handles Mongoose ValidationError/CastError/duplicate-key (11000) → mapped ApiErrors.

4. Auth & Session — Full Reference Module
Implements: Email+OTP login, Redis stateful sessions (no JWT), crypto.randomBytes session ids, HttpOnly cookie, 7-day session TTL, max 2 active student sessions, trusted-device (skip OTP for 7 days), and mentor-side session management.

Redis keys (common/constants/redisKeys.ts)
Key	Value	TTL	Purpose
otp:{email}	{ otpHash, attempts, requestedAt }	5 min	OTP verify
otp:cooldown:{email}	1	60 s	resend throttle
session:{sessionId}	{ userId, role, deviceId, ip, userAgent, createdAt }	7 d	auth source of truth
user_sessions:{userId}	Set of sessionIds	—	limit / list / force-logout
trusted_device:{userId}:{deviceId}	1	7 d	skip OTP re-verify
rl:otp:ip:{ip} / rl:otp:email:{email}	counter	window	rate limit
Endpoints (mounted at /api/v1/auth)
Public

POST /otp/request — { email } → send OTP. Checks blacklist, banned, rate limit, cooldown.
POST /otp/verify — { email, otp, deviceName?, rememberDevice? } → verify, upsert user, create session, set cookie. May return 409 SESSION_LIMIT_EXCEEDED with active sessions.
POST /otp/resend — { email } → resend (cooldown-guarded).
POST /login/trusted — uses deviceId cookie + trusted_device key to create a session without OTP (7-day no-relogin requirement).
Protected (authenticate)

GET /me — current user + active session summary.
POST /logout — destroy current session, clear cookie.
POST /logout-all — destroy every session for the user.
GET /sessions — list caller's active sessions (joins Redis set ↔ UserSessions).
DELETE /sessions/:sessionId — revoke a specific session (used to free a slot when limit hit, then retry verify).
POST /session/heartbeat — slide TTL + update lastSeenAt (called periodically by client).
Mentor-only (authenticate + authorize(MANAGE_SESSIONS))

GET /admin/students/:studentId/sessions — view a student's sessions.
DELETE /admin/students/:studentId/sessions — force-logout student (all).
DELETE /admin/students/:studentId/sessions/:sessionId — revoke one.
Services
auth.service.ts

requestOtp(email, ctx) · resendOtp(email, ctx) · verifyOtp(email, otp, ctx)
loginWithTrustedDevice(userId, deviceId, ctx)
getCurrentUser(userId)
internal: resolveOrCreateUser(email) → upsert user, auto-map new student to default mentor via MentorStudents.
session.service.ts

createSession(userId, role, ctx) — crypto.randomBytes(32) id; write session:*; add to user_sessions:*; persist UserSessions doc.
enforceSessionLimit(userId, role) — students capped at 2; returns active sessions if exceeded.
getActiveSessions(userId) · touchSession(sessionId) (sliding TTL + lastSeenAt)
revokeSession(userId, sessionId) · destroyCurrentSession(sessionId) · destroyAllSessions(userId)
markTrustedDevice(userId, deviceId) · isTrustedDevice(userId, deviceId)
crypto.util.ts / otp.util.ts

generateOtp() (6-digit) · hashOtp(otp) (HMAC-SHA256 w/ server secret) · verifyOtp(otp, hash)
generateSessionId() · generateDeviceId() · verifyRazorpaySignature() (shared).
Auth edge cases (all → typed ApiError with errorCode)
OTP_EXPIRED (key TTL gone) · OTP_INVALID (mismatch → increment attempts) · OTP_MAX_ATTEMPTS (≥5 → delete key, force re-request) · OTP_RATE_LIMITED / cooldown active.
EMAIL_BLACKLISTED (403) · ACCOUNT_BANNED (403, status==="banned").
SESSION_LIMIT_EXCEEDED (409, students only; payload lists sessions to revoke).
UNAUTHENTICATED (401, missing/tampered/expired cookie → not in Redis).
Concurrent verify race → atomic Redis ops (GETDEL / Lua) on the OTP key.
Trusted-device expired → falls back to OTP flow.
Email normalized (trim + lowercase) everywhere; mentor exempt from 2-session cap (config flag).
Logout of an already-dead session → idempotent success.
5. Other Modules (endpoints summary — built later, mirroring Auth)
user — GET /users/me, PATCH /users/me; mentor: list/get/ban/unban students, blacklist/unblacklist email, view enrollments per student.
course — public: GET /courses, GET /courses/:slug (detail page); mentor CRUD; POST /courses/:id/delete-request (OTP) → BullMQ 24h delayed delete; POST /courses/:id/publish.
chapter / lesson — mentor CRUD; PATCH /courses/:id/chapters/reorder & .../lessons/reorder (drag-and-drop bulk order update in a transaction); GET /lessons/:id/playback → signed Cloudflare Stream URL gated by enrollment.
resource — mentor POST /lessons/:id/resources (R2 presigned upload); student GET /resources/:id/download (presigned, enrollment-gated).
enrollment — GET /enrollments/me; mentor POST /enrollments/manual ({ email, courseId } → create/enroll + notify) and DELETE /enrollments/:id (revoke).
payment — POST /orders (create Razorpay order; coupon applied server-side), POST /payments/verify (HMAC signature verify → create Payment + Enrollment atomically), POST /payments/webhook (Razorpay webhook, idempotent).
coupon — mentor CRUD; POST /coupons/validate ({ code, courseId } → server-computed discount; checks expiry/usage limit/course match).
progress — PUT /progress/:lessonId (throttled watchedSeconds/completion), GET /courses/:id/progress (overall %), GET /progress/recent (Recently Watched).
comment — GET /lessons/:id/comments (nested), student CRUD on own; mentor reply + moderate/delete any.
email — mentor POST /campaigns (bulk mail w/ dynamic {{name}},{{progress}} fields → BullMQ fan-out), GET /campaigns, GET /campaigns/:id (status/progress).
audit — internal auditLog(...) helper called by sensitive services; mentor GET /audit-logs.
6. Security Criteria → Implementation
Concern	Implementation
Authentication	Redis stateful sessions, crypto.randomBytes ids, HttpOnly+Secure+SameSite=Lax cookie, no JWT, 7-day TTL, OTP hashed (HMAC) never stored plaintext.
Authorization	authorize(...perms) middleware + central role→permission map (constants/permissions.ts); ownership checks in services (mentor owns course, student owns comment).
Payment verification	Server-side Razorpay HMAC signature verify; amount/coupon recomputed server-side (never trust client); webhook idempotency; Order→Payment→Enrollment in a Mongo transaction.
API protection	helmet, strict CORS allowlist, Redis rate limiting (global + per-route OTP/login), body size limits, mongo-sanitize against operator injection.
Input validation	express-validator chains per route → validate middleware → VALIDATION_ERROR (400) with field details.
Access control	Lesson video + resource endpoints gated by an Enrollment lookup before issuing signed URLs; isPreview lessons exempt.
Content protection	Cloudflare Stream signed/expiring playback tokens; R2 short-lived presigned download URLs; no raw asset URLs ever returned.
Auditing	AuditLogs for course delete, ban, enrollment revoke, coupon create, manual enroll.
7. Implementation Order
Scaffold — package.json, tsconfig, eslint/prettier, src/app.ts + server.ts, config (env/db/redis/queue), logger.
Common layer — ApiResponse, ApiError, errorCodes, httpStatus, all middlewares (asyncHandler, validate, errorHandler, notFound, rateLimiter), crypto/otp/cookie utils, constants.
User module — User, MentorStudents, EmailBlacklist, UserSessions models + seed first mentor.
Auth module (full) — services, controller, routes, validation, authenticate + authorize middlewares, email worker for OTP. This is the deliverable reference module.
Remaining modules in dependency order: course → chapter → lesson → resource → enrollment → payment → coupon → progress → comment → email → audit.
Jobs — BullMQ queues + workers (email, courseDelete, videoStatus).
Integrations — R2, Stream, Razorpay, mailer wrappers.
8. Verification
npm run build (tsc) passes with no type errors; npm run lint clean.
npm run dev boots: connects Mongo + Redis, registers BullMQ workers, listens.
Auth E2E (curl / REST client):
POST /otp/request → 200, OTP enqueued (log/mail), otp:{email} present in Redis.
POST /otp/verify wrong code ×5 → OTP_INVALID then OTP_MAX_ATTEMPTS.
POST /otp/verify correct → 200, Set-Cookie present, session:* + user_sessions:* in Redis.
Create 2 sessions, attempt a 3rd (student) → 409 SESSION_LIMIT_EXCEEDED with session list.
DELETE /sessions/:id then retry verify → succeeds.
GET /me with cookie → user; with tampered cookie → 401 UNAUTHENTICATED.
POST /login/trusted within 7 days → session without OTP.
Mentor DELETE /admin/students/:id/sessions → student forced out (Redis keys gone).
Confirm every error response matches the ApiError envelope and every success the ApiResponse envelope.
Unit tests for auth.service / session.service edge cases (mock Redis + models).
PART 2 — Remaining Modules Implementation Plan
Context (Part 2)
Part 1 (foundation + Auth) is already implemented and compiling: config layer, common/ (ApiResponse/ApiError, all middlewares, utils, constants), the User models + user.service, the full Auth & Session module, app/server wiring, the email queue + worker, and the mentor seed. npm run build passes.

Part 2 builds the remaining 11 feature modules on top of that, reusing the existing primitives — every module follows the Auth module's exact file layout (src/modules/auth/) and strict routes → controller → service → model flow. Two locked decisions drive the design:

Video: browser uploads directly to Cloudflare Stream via a one-time upload URL the API issues; a videoStatus BullMQ worker polls encode status and backfills videoPlaybackId/durationSeconds.
Checkout: reuse the existing /auth OTP flow to authenticate the buyer (session + 7‑day trusted device), then protected /orders + /payments/verify endpoints handle the purchase.
Reused building blocks (do not re-create): ApiResponse, ApiError/errorCodes, asyncHandler, validate, authenticate, authorize/requireRole, rateLimiter, PERMISSIONS, pagination util, crypto util (verifyRazorpaySignature already present), enqueueEmail/enqueueCourseDeletion.

A. Shared infrastructure to add FIRST (prerequisites)
These are cross-cutting pieces several modules depend on — build them before the modules.

A1. New dependencies
@aws-sdk/client-s3 + @aws-sdk/s3-request-presigner — presigned R2 (S3-compatible) URLs.
razorpay (already in deps) — order creation; signature verify already in crypto util.
A2. Integrations (src/integrations/)
r2.service.ts — S3 client pointed at the R2 endpoint. getPresignedUploadUrl(key, contentType) (PUT, short TTL), getPresignedDownloadUrl(key, filename) (GET, short TTL), deleteObject(key). Never returns raw bucket URLs.
stream.service.ts — Cloudflare Stream REST wrapper: createDirectUpload({maxDurationSeconds}) → { uploadUrl, uid }; getVideoStatus(uid) → { ready, playbackId, durationSeconds }; getSignedPlaybackToken(uid) → time-limited signed token (uses CF_STREAM_SIGNING_KEY_*); deleteVideo(uid).
razorpay.service.ts — createOrder(amountPaise, receipt, notes) → razorpay order; verifyWebhookSignature(rawBody, signature) using RAZORPAY_WEBHOOK_SECRET.
A3. Reusable OTP-for-actions (src/modules/auth/otp.service.ts — light refactor)
Extract the OTP generate/store/verify core (currently inline in auth.service.ts) into requestActionOtp(email, purpose) / verifyActionOtp(email, purpose, otp) keyed otp:action:{purpose}:{email}. Auth login keeps its existing path; course deletion reuses this for mentor OTP confirmation. Add redisKeys.otpAction(purpose, email) to redisKeys.ts.

A4. Access-control middleware (src/common/middlewares/requireEnrollment.ts)
requireEnrollment(courseIdFrom) — loads the caller's Enrollment for the resolved courseId; throws 403 ACCESS_NOT_ENROLLED if absent. Mentors (course owner) bypass. Used by lesson playback, resource download, comment write, progress write.

A5. Audit helper (built with the audit module, used everywhere)
auditLog({ userId, action, entityType, entityId, metadata }) — fire-and-forget insert into AuditLogs. Called by sensitive services (course delete, ban, enrollment revoke/grant, coupon create, campaign send).

A6. Jobs
courseDelete.worker.ts — consumes the delayed job; hard-deletes a course only if its CourseDeletionRequest is still valid and status==='scheduled_delete' (guards against a cancelled deletion). Cascades: chapters, lessons (+ Stream videos), resources (+ R2 objects), enrollments? (keep enrollments + orders for records; block access via course gone).
videoStatus.worker.ts — repeatable/poll job per uploaded lesson uid; on ready writes videoPlaybackId + durationSeconds to the lesson, then removes itself.
Register both in src/jobs/index.ts; add producers to src/jobs/queues.ts (enqueueVideoStatusPoll, campaign fan-out already typed in EmailJob).
B. Module specs
Each module dir = <m>.model.ts, <m>.service.ts, <m>.controller.ts, <m>.validation.ts, <m>.routes.ts (+ <m>.types.ts when needed), mounted in src/routes/index.ts. Listed in dependency order. M = mentor-only (authorize(...)), S = student/self, P = public.

B1. user (complete the module — only models + service exist today)
Add user.routes/controller/validation.

GET /users/me (S) · PATCH /users/me (S — name, avatar).
GET /users/students (M, paginated, search by email/name) · GET /users/students/:id (M).
POST /users/students/:id/ban · POST /users/students/:id/unban (M, STUDENT_BAN) → also destroyAllSessions on ban + auditLog.
GET /users/students/:id/enrollments (M, ENROLLMENT_VIEW_ALL).
POST /users/blacklist {email, reason} · DELETE /users/blacklist/:email (M, EMAIL_BLACKLIST) → ban + blacklist + force logout.
Service reuses existing user.service.ts; add ban/unban/list/blacklist fns.
Edge/security: cannot ban a mentor; banning revokes sessions immediately; blacklist insert is idempotent.
B2. course
Model course.model.ts (Courses schema).
POST /courses (M, COURSE_CREATE) · PATCH /courses/:id (M, COURSE_UPDATE) · POST /courses/:id/publish (M, COURSE_PUBLISH).
GET /courses (P — only published, paginated) · GET /courses/:slug (P — detail page; includes curriculum outline, not signed video URLs).
GET /courses/admin (M — all statuses, own courses) · GET /courses/:id/admin (M).
OTP-protected delete (24h): POST /courses/:id/delete/request (M) → requestActionOtp(mentorEmail,'course_delete'); POST /courses/:id/delete/confirm {otp} (M) → verify, create CourseDeletionRequest, set status='scheduled_delete', enqueueCourseDeletion(courseId, 24h), auditLog. POST /courses/:id/delete/cancel (M) → clear request, restore status, remove delayed job.
Service: slug uniqueness + auto-slugify, ownership check (course.mentorId === auth.userId) factored into a assertCourseOwner helper reused by chapter/lesson/resource.
Edge/security: slug collisions → CONFLICT; publish requires ≥1 lesson; price ≥ 0; only owner mutates; public list never leaks drafts.
B3. chapter
Model chapter.model.ts.
POST /courses/:courseId/chapters (M) · PATCH /chapters/:id (M) · DELETE /chapters/:id (M, cascades lessons).
PATCH /courses/:courseId/chapters/reorder { orderedIds: [] } (M) — bulk order update inside a Mongo transaction (drag-and-drop).
GET /courses/:courseId/chapters (enrollment-gated for full content; public sees outline on detail page).
Edge: reorder validates the id set matches the course's chapters exactly; new chapter order = max+1.
B4. lesson (Cloudflare Stream)
Model lesson.model.ts.
POST /chapters/:chapterId/lessons (M) — creates lesson (draft, no video yet).
POST /lessons/:id/video/upload-url (M) → stream.createDirectUpload(), store uid, enqueueVideoStatusPoll(lessonId, uid); client uploads directly to returned URL.
PATCH /lessons/:id (M — title, description, isPreview, thumbnail) · DELETE /lessons/:id (M → delete Stream video).
PATCH /chapters/:chapterId/lessons/reorder (M, transactional, same pattern as chapters).
GET /lessons/:id/playback (S, requireEnrollment OR isPreview) → stream.getSignedPlaybackToken(uid) — short-lived, never the raw uid to non-enrolled users.
Edge/security: playback gated by enrollment unless isPreview; signed token TTL minutes; video status backfilled async (lesson shows "processing" until ready).
B5. resource (Cloudflare R2)
Model lessonResource.model.ts.
POST /lessons/:lessonId/resources/upload-url (M) → r2.getPresignedUploadUrl(); POST /lessons/:lessonId/resources (M) → persist metadata (title, key, fileSize) after upload.
DELETE /resources/:id (M → r2.deleteObject).
GET /lessons/:lessonId/resources (S, requireEnrollment) — lists metadata.
GET /resources/:id/download (S, requireEnrollment) → short-lived r2.getPresignedDownloadUrl().
Edge/security: download URL expiry short; only enrolled students; file size/type validated at metadata persist.
B6. enrollment
Model enrollment.model.ts (unique studentId+courseId).
GET /enrollments/me (S, paginated) — student's courses.
GET /enrollments/me/:courseId (S) — single access check (used by app gate).
POST /enrollments/manual {email, courseId} (M, ENROLLMENT_GRANT) → resolve/create student, map to mentor, create accessType:'manual' enrollment (idempotent), enqueueEmail({type:'manual-enroll'}), auditLog.
DELETE /enrollments/:id (M, ENROLLMENT_REVOKE) → remove access + auditLog.
Service exposes hasAccess(studentId, courseId) — the single source used by requireEnrollment middleware.
Edge: duplicate enroll → ALREADY_ENROLLED; manual enroll for existing paid student is a no-op success.
B7. payment (Razorpay, depends on enrollment + coupon)
Models order.model.ts, payment.model.ts.
POST /orders {courseId, couponCode?} (S) — server recomputes price & coupon discount (never trusts client amount); blocks if already enrolled (ALREADY_ENROLLED); creates Order(pending) + Razorpay order; returns razorpayOrderId + final amount.
POST /payments/verify {razorpayOrderId, razorpayPaymentId, razorpaySignature} (S) → verifyRazorpaySignature (crypto util); on success, in a Mongo transaction: mark Order paid, insert Payment, create Enrollment(paid), increment coupon usedCount + CouponUsage. Idempotent on razorpayPaymentId.
POST /payments/webhook (P, raw-body, verifyWebhookSignature) — authoritative fallback that performs the same fulfillment idempotently (handles client that closes the tab after paying).
Edge/security: signature mismatch → PAYMENT_VERIFICATION_FAILED; double verify → idempotent; webhook + verify converge on one fulfillment path (fulfillOrder() shared); amounts in paise.
B8. coupon
Models coupon.model.ts, couponUsage.model.ts.
POST /coupons · PATCH /coupons/:id · DELETE /coupons/:id · GET /coupons (M, COUPON_MANAGE).
POST /coupons/validate {code, courseId} (S) → server-computed discount; checks expiry, usedCount < usageLimit, course match, active.
Service exposes applyCoupon(code, courseId, price) → {couponId, discount, finalAmount} reused by POST /orders.
Edge: expired/limit-reached/wrong-course → COUPON_INVALID; usedCount increment happens only on successful payment (in the payment transaction), not at validate.
B9. progress
Models lessonProgress.model.ts (unique studentId+lessonId), recentlyWatched.model.ts.
PUT /progress/lessons/:lessonId {watchedSeconds} (S, requireEnrollment, throttled per-lesson via rateLimiter) → upsert progress, compute completionPercentage vs lesson duration, set completed at ≥90%, upsert RecentlyWatched.
GET /courses/:courseId/progress (S) → overall % (completed lessons / total) + per-lesson map.
GET /progress/recent (S) → Recently Watched (most-recent N, joined to lesson/course).
Edge: watchedSeconds clamped to [0, duration]; progress monotonic (never decreases on seek-back); RecentlyWatched capped (keep latest ~20 per student).
B10. comment (nested)
Model comment.model.ts (self-ref parentCommentId).
GET /lessons/:lessonId/comments (S, requireEnrollment, paginated; returns threaded structure — top-level + replies).
POST /lessons/:lessonId/comments {content, parentCommentId?} (S, requireEnrollment).
PATCH /comments/:id · DELETE /comments/:id (S own only; sets isEdited).
POST /comments/:id/reply (M, COMMENT_REPLY) · DELETE /comments/:id mentor override (M, COMMENT_MODERATE).
GET /comments/recent (M — recent across all lessons, for dashboard).
Edge/security: ownership enforced on edit/delete; parent must belong to same lesson; reply depth limited (store flat, render 2 levels); content length/sanitization in validation.
B11. email (bulk campaigns)
Model emailCampaign.model.ts.
POST /campaigns {subject, body} (M, CAMPAIGN_SEND) → create campaign, resolve recipients (all mentor's students), fan-out one EmailJob{type:'campaign'} per recipient with dynamic fields ({{name}}, {{progress}}) interpolated; update sentCount as jobs complete.
GET /campaigns (M, paginated) · GET /campaigns/:id (M — status + progress).
Dynamic fields resolved per recipient (name from User, progress from progress service) before enqueue.
Edge: skip banned/blacklisted recipients; large lists fan out in batches; status transitions pending→sending→completed driven by worker.
B12. audit
Model auditLog.model.ts.
auditLog() helper (A5) — the write path used by other services.
GET /audit-logs (M, AUDIT_VIEW, paginated, filter by action/entityType/date).
Edge: logs are append-only (no update/delete endpoints).
C. Cross-cutting security (Part 2)
Concern	Where enforced
Access control	requireEnrollment on every content endpoint (lesson playback, resources, comments, progress); mentor-owner bypass.
Payment integrity	Server recomputes amount + coupon; signature verify; transactional fulfillment; webhook idempotency; one fulfillOrder().
Content protection	Stream signed playback tokens + R2 short-TTL presigned URLs only; raw uids/keys never leave the server.
Ownership	assertCourseOwner reused across course/chapter/lesson/resource mutations.
Input validation	express-validator chains per route (file types/sizes, ObjectId params, content length, price/amount ranges).
Auditing	auditLog() on delete/ban/grant/revoke/coupon/campaign.
Rate limiting	progress writes + coupon validate + order create throttled via existing rateLimiter.
D. Implementation order (Part 2)
Shared infra (A1–A6) — deps, integrations, otp.service refactor, requireEnrollment, audit helper, courseDelete + videoStatus workers.
user (finish) → course → chapter → lesson → resource.
coupon → enrollment → payment (payment depends on enrollment + coupon).
progress → comment → email → audit (audit model/helper can land in step 1; routes here).
Mount each module router in src/routes/index.ts as it's built.
E. Verification (Part 2)
npm run build clean after each module; npm run lint clean.
Course/content E2E: create course → add chapter → add lesson → get upload URL → (mock Stream) videoStatus worker fills playbackId → publish → GET /courses/:slug shows it; non-enrolled GET /lessons/:id/playback → 403 ACCESS_NOT_ENROLLED; isPreview lesson playable.
Purchase E2E: OTP login → POST /orders (coupon applied, amount server-computed) → POST /payments/verify with valid signature → Enrollment created, coupon usedCount++; replay verify → idempotent; tampered signature → PAYMENT_VERIFICATION_FAILED; webhook fulfills if verify never called.
Manual enroll: POST /enrollments/manual → student gets access + email; revoke → access gone.
Course delete: request → OTP confirm → status=scheduled_delete + delayed job; cancel restores; after 24h worker hard-deletes (cascades Stream/R2).
Progress: PUT progress advances %, completes at ≥90%, appears in /progress/recent; seek-back doesn't lower progress.
Comments: nested reply belongs to same lesson; non-owner edit → 403; mentor moderate delete works.
Bulk mail: campaign fan-out enqueues one job/recipient, skips banned/blacklisted, sentCount reaches totalRecipients.
Every response conforms to the ApiResponse/ApiError envelopes.
