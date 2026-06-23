# BrightMango Backend — Local Setup & API Testing

A step-by-step guide to run the API locally against **MongoDB Atlas + Redis Cloud** and
test it in **Postman**.

> **Why cloud Mongo?** Payments, content reorder, and coupon usage use MongoDB
> multi-document **transactions**, which require a **replica set**. Atlas clusters are
> replica sets, so transactions just work. A plain standalone `mongod` would throw
> `Transaction numbers are only allowed on a replica set member`.

---

## 1. Prerequisites
- Node ≥ 20 (`node -v`) and npm
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account
- A free [Redis Cloud](https://redis.com/try-free/) account (Upstash also works)
- [Postman](https://www.postman.com/downloads/)

## 2. MongoDB Atlas
1. Create a free **M0** cluster.
2. **Database Access** → **Add New Database User** (username + password).
3. **Network Access** → **Add IP Address** → your IP (or `0.0.0.0/0` for dev only).
4. **Connect → Drivers** → copy the connection string and fill in the password + db name:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/brightmango?retryWrites=true&w=majority
   ```

## 3. Redis Cloud
1. Create a free database.
2. Copy its public endpoint URL:
   ```
   redis://default:PASSWORD@HOST:PORT
   ```
   (Use `rediss://` if TLS is enabled.) ioredis accepts this URL directly.

## 4. Configure `.env`
```bash
cp .env.example .env
```
Set at minimum (the server fails fast at boot without these):
```ini
NODE_ENV=development
PORT=4000
API_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:3000
MONGODB_URI=<your Atlas string>
REDIS_URL=<your Redis Cloud URL>
OTP_HMAC_SECRET=<any long random string>
SEED_MENTOR_EMAIL=mentor@brightmango.in
SEED_MENTOR_NAME=BrightMango Mentor
```
Leave **Razorpay / Cloudflare R2 / Cloudflare Stream / SMTP** blank for now — endpoints that
need them return `503 INTEGRATION_NOT_CONFIGURED`, everything else works. With SMTP blank the
mailer just logs emails (and the OTP is fetchable via the dev endpoint below).

## 5. Install, seed, run
```bash
npm install
npm run seed:mentor   # creates the bootstrap mentor (idempotent) — required before login
npm run dev           # starts on http://localhost:4000
```
You should see `[mongo] connected`, `[redis] connected`, and the listening log.
Sanity check:
```bash
curl http://localhost:4000/api/v1/health
```

## 6. Import the Postman collection
1. Postman → **Import** → `postman/BrightMango.postman_collection.json`.
2. The `baseUrl` collection variable defaults to `http://localhost:4000/api/v1`.
3. Postman's **cookie jar** keeps the `bm_session` cookie automatically after login.

## 7. Log in (do this first — everything else needs the session cookie)
There are two identities:
- **Mentor** — the `SEED_MENTOR_EMAIL` (all mentor-only endpoints).
- **Student** — any other email (auto-created and mapped to the mentor on first verify).

Set the `loginEmail` collection variable, then run the **Auth** folder in order:
1. **Request OTP** → `200`.
2. **Get Dev OTP** → returns the OTP and saves it to `{{otp}}` (dev-only route; not mounted in production).
3. **Verify OTP** → `200`, sets the `bm_session` cookie.
4. **Me** → confirms your role.

To test student endpoints, change `loginEmail` to the student email and repeat (use a
separate Postman session/cookie context if testing both at once).

## 8. Suggested test flow (no external services needed)
As **mentor**:
1. **Courses → Create course** (saves `{{courseId}}`, `{{courseSlug}}`).
2. **Chapters → Create chapter** (saves `{{chapterId}}`).
3. **Lessons → Create lesson** (saves `{{lessonId}}`; set `isPreview: true` to test playback gating later).
4. **Courses → Publish course** (requires ≥1 lesson).
5. **Enrollments → Manual enroll** with the student email.

As **student** (re-login with student email):
6. **Enrollments → My enrollments**.
7. **Progress → Save progress**, then **Course progress** / **Recently watched**.
8. **Comments → Post comment**, **List comments**.
9. **Coupons → Validate coupon** (after the mentor creates one).

## 9. What needs external credentials (expect `503` until set)
| Feature | Env vars |
|---|---|
| Lesson video upload + playback | `CF_STREAM_*` (Cloudflare Stream) |
| Resource upload/download | `R2_*` (Cloudflare R2) |
| Orders + payment verify | `RAZORPAY_*` |

## 10. Quick error reference
- `OTP_EXPIRED` / `OTP_INVALID` / `OTP_MAX_ATTEMPTS` — OTP problems (5 attempts max).
- `401 UNAUTHENTICATED` — missing/expired session cookie (log in again).
- `403 FORBIDDEN` — wrong role for a mentor-only route.
- `403 ACCESS_NOT_ENROLLED` — student hitting content for a course they're not enrolled in.
- `409 SESSION_LIMIT_EXCEEDED` — student's 3rd concurrent login; revoke a session and retry.
- `409 ALREADY_ENROLLED` — ordering/enrolling a course the student already has.
- `503 INTEGRATION_NOT_CONFIGURED` — that feature's external credentials aren't set.

## 11. Verify transactions work (Atlas)
Run **Chapters → Reorder chapters** with a valid `orderedIds` list and confirm `200` + the
new order persists on **List chapters**. This exercises a `withTransaction` path and proves
the replica-set requirement is satisfied.
