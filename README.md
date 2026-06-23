# BrightMango LMS — Backend

Node.js + Express + TypeScript · MongoDB (Mongoose) · Redis (sessions/OTP) · BullMQ.
Stateful, Redis-backed, **no-JWT** session auth with email + OTP login.

## Architecture

Strict request flow: **routes → controller → service → model/redis/integration**.

```
src/
  config/        env, db, redis, queue, logger bootstrap
  common/        http (ApiResponse/ApiError), middlewares, utils, constants, types
  modules/<m>/   <m>.routes / .controller / .service / .validation / .model / .types
  integrations/  cloudflare R2, cloudflare Stream, razorpay, mailer (thin wrappers)
  jobs/          BullMQ queues + workers
  routes/        mounts every module router under API_PREFIX
  scripts/       seedMentor
  app.ts         express app (helmet, cors, cookies, rate limit, routes, errors)
  server.ts      bootstrap + graceful shutdown
```

- **Success envelope** — `ApiResponse`: `{ success, statusCode, message, data, meta? }`
- **Error envelope** — `ApiError` → global `errorHandler`: `{ success:false, statusCode, errorCode, message, details? }`
- Every controller is wrapped in `asyncHandler`; all errors funnel to one handler.

The **Auth & Session** module is the fully-implemented reference; other modules follow the
same file layout.

## Prerequisites

- Node ≥ 20
- MongoDB and Redis reachable (set their URIs in `.env`)

## Setup

```bash
npm install
cp .env.example .env          # fill in secrets
npm run seed:mentor           # create the bootstrap mentor (required before student login)
npm run dev                   # tsx watch
# or
npm run build && npm start
```

## Auth endpoints (`{API_PREFIX}/auth`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/otp/request` | – | Send OTP (blacklist + rate-limit + cooldown checks) |
| POST | `/otp/resend` | – | Resend OTP (cooldown-guarded) |
| POST | `/otp/verify` | – | Verify OTP → session cookie (or `409 SESSION_LIMIT_EXCEEDED`) |
| POST | `/login/trusted` | – | Session without OTP for a trusted device |
| GET | `/me` | session | Current user + session id |
| POST | `/logout` | session | Revoke current session |
| POST | `/logout-all` | session | Revoke all sessions |
| GET | `/sessions` | session | List own active sessions |
| DELETE | `/sessions/:sessionId` | session | Revoke a specific session |
| POST | `/session/heartbeat` | session | Slide TTL + update lastSeen |
| GET | `/admin/students/:studentId/sessions` | mentor | View a student's sessions |
| DELETE | `/admin/students/:studentId/sessions/:sessionId` | mentor | Revoke one student session |
| DELETE | `/admin/students/:studentId/sessions` | mentor | Force-logout a student |

## Modules & key endpoints

All under `{API_PREFIX}` (default `/api/v1`). `M` = mentor, `S` = student/self, `P` = public.

| Module | Highlights |
|---|---|
| **users** | `GET/PATCH /users/me`; mentor: list/get/ban/unban students, view enrollments, blacklist email |
| **courses** | `POST/PATCH /courses`, `POST /courses/:id/publish`, public `GET /courses` + `/:slug`; OTP-protected delete: `/:id/delete/request|confirm|cancel` (24h delayed job) |
| **chapters** | CRUD + `PATCH /courses/:courseId/chapters/reorder` (transactional drag-and-drop) |
| **lessons** | CRUD + reorder; `POST /lessons/:id/video/upload-url` (direct-to-Stream); `GET /lessons/:id/playback` (signed token, enrollment-gated, preview-exempt) |
| **resources** | R2 presigned upload + metadata; `GET /resources/:id/download` (short-TTL, enrollment-gated) |
| **enrollments** | `GET /enrollments/me`; mentor `POST /enrollments/manual`, `DELETE /enrollments/:id` |
| **payments** | `POST /orders` (server-computed amount), `POST /payments/verify`, `POST /payments/webhook` (raw-body, idempotent) |
| **coupons** | mentor CRUD; `POST /coupons/validate` (server-computed discount) |
| **progress** | `PUT /progress/lessons/:lessonId` (throttled, monotonic), `GET /progress/courses/:courseId`, `GET /progress/recent` |
| **comments** | nested threads, own-CRUD, mentor reply + moderate, `GET /comments/recent` |
| **campaigns** | `POST /campaigns` (bulk fan-out with `{{name}}` tokens), `GET /campaigns[/:id]` |
| **audit-logs** | `GET /audit-logs` (mentor, filterable) |

**Security baked in:** enrollment-gated content (`requireEnrollment`), server-side payment amount + signature verification with idempotent fulfillment, Cloudflare Stream signed playback tokens + R2 short-TTL presigned URLs (no raw asset URLs), `assertCourseOwner` on all content mutations, audit logging on sensitive actions, per-route rate limiting.

## Scripts

- `npm run dev` — watch mode
- `npm run build` / `npm start` — compile to `dist/` and run
- `npm run typecheck` / `npm run lint` / `npm run format`
- `npm run seed:mentor` — seed bootstrap mentor

See `BackendStructure.md` for the full DB schema and `Structure.MD` for product requirements.
The implementation plan lives in the plan file referenced during design.
