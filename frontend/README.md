# BrightMango Frontend

React 18 + Vite + TypeScript single-page app for the BrightMango course platform — student experience and mentor admin panel in one app.

**Stack:** Tailwind CSS v4 + shadcn/ui, TanStack Query (server state), Zustand (client state), Axios, React Router, Vidstack (video), dnd-kit (reorder), Razorpay checkout.

## Run locally

1. Start the backend on `:4000` (see repo root `SETUP.md`) and seed the mentor: `npm run seed:mentor`.
2. In this directory:

```bash
npm install
npm run dev   # http://localhost:3000 (must be 3000 — backend CORS allowlist)
```

Auth is cookie-based (`bm_session`, HttpOnly). In dev, use the **"Fetch dev OTP"** button on the login screen — no SMTP needed.

## Env

- `.env.development` / `.env.production`
- `VITE_API_URL` — backend base URL including `/api/v1`
- `VITE_STREAM_CUSTOMER_DOMAIN` — Cloudflare Stream customer subdomain (e.g. `customer-abc123.cloudflarestream.com`), needed for video playback

## Checks

```bash
npx tsc -b        # typecheck
npm run build     # production build
```
