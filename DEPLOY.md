# BrightMango — Deployment Guide (AWS Lightsail + Cloudflare)

End-to-end guide: from a fresh Lightsail instance to a fully live app, built
for the current scale of BrightMango — simple, low-cost, and production-ready
without overengineering.

> ### What changed in this revision
> This guide was corrected against the **actual codebase** and **current AWS
> pricing**. If you followed an earlier version, note these fixes:
>
> 1. **Pricing was wrong.** The $5/mo Lightsail plan is **0.5 GB RAM / 20 GB
>    SSD**, *not* 1 GB / 40 GB. The plan that actually gives 1 GB RAM with a
>    public IPv4 is the **$7/mo dual-stack** bundle. (IPv6-only bundles are
>    cheaper but have **no public IPv4** — don't pick them.)
> 2. **API and workers are now separate containers.** The backend today starts
>    its BullMQ workers *inside* the API process. We split them into an `app`
>    container (HTTP only) and a `worker` container (jobs only), sharing one
>    image. A small code change is required — see **Part 4**.
> 3. **No Docker builds on the server.** The 1 GB box no longer compiles
>    TypeScript or builds images. GitHub Actions builds the image, pushes it to
>    **GitHub Container Registry (GHCR)**, and the server only *pulls*.
> 4. **Deploys are not zero-downtime.** `docker compose up -d` recreates
>    changed containers, causing a brief (seconds) interruption. That's fine at
>    this stage — see **Part 11** for the honest wording and a rollback recipe.
> 5. **SPA deep links need a `_redirects` file.** Cloudflare Pages does not
>    reliably fall back to `index.html` for a `createBrowserRouter` SPA without
>    it — see **Part 9**.
> 6. **Backups go off-box to Cloudflare R2** (compressed `mongodump`, with
>    retention + a restore procedure) — see **Part 13**.
> 7. **Cloudflare SSL/TLS must be Full (strict)**, never Flexible — see
>    **Part 3 / Part 8**.
> 8. **Don't touch the cookie `SameSite` setting.** `SameSite=Lax` with
>    `COOKIE_DOMAIN=.brightmango.in` is already correct for `app.` ↔ `api.`
>    (they're the same site). You do **not** need `SameSite=None`.

---

## The final architecture

```
Users (India)
   │
   ├── app.brightmango.in ──► Cloudflare Pages (frontend SPA, free)
   │
   └── api.brightmango.in ──► Cloudflare DNS/proxy
                                │
                                ▼
                    AWS Lightsail, Mumbai ($7/mo, 1 GB RAM)
                      ├── Caddy         (TLS/HTTPS reverse proxy, only public entry)
                      ├── app           (Node HTTP API — no workers)
                      ├── worker        (BullMQ workers only — no HTTP)
                      └── redis         (local, private, persistent)
                                │
                                └──► MongoDB Atlas M0 (free, AWS Mumbai)

   Image pipeline:  git push ─► GitHub Actions (build + test + docker build)
                              ─► push image to GHCR (ghcr.io)
                              ─► SSH to Lightsail ─► docker compose pull && up -d
```

**Why Lightsail and not EC2 or Lambda?**
- *vs EC2:* Lightsail is AWS's fixed-price VPS. The bundle price includes the
  instance, SSD, a **static IPv4**, and generous transfer — one predictable
  line on the bill, same Mumbai data center.
- *vs Lambda:* the app runs **BullMQ workers** that continuously poll Redis for
  jobs (emails, video-status polling, course deletes). Lambda freezes between
  invocations, so those jobs would never run, and Redis would require paid
  ElastiCache. A persistent instance with Redis alongside is the correct — and
  cheapest — shape for this app.

**Why the app/worker split?** The workers do real background work; if the API
process dies or restarts on deploy, you don't want jobs to stall with it, and
you want to restart/scale the two independently. Same Docker image, two
commands (`node dist/server.js` vs `node dist/worker.js`).

---

## Repo layout

This is a monorepo. **All backend code and infra files live in `backend/`**;
the frontend SPA lives in `frontend/`. Only the CI workflow sits at the repo
root (GitHub requires `.github/workflows/` there).

```
Bright-Mango/
├── .github/workflows/deploy.yml     # CI — builds & pushes the backend image
├── backend/
│   ├── Dockerfile                    # build context is this folder
│   ├── .dockerignore
│   ├── docker-compose.prod.yml       # runs on the server
│   ├── Caddyfile
│   ├── .env                          # production secrets (on server, gitignored)
│   ├── package.json  tsconfig.json
│   └── src/                          # server.ts, worker.ts, config/, jobs/, ...
└── frontend/                         # Vite SPA → Cloudflare Pages (root dir "frontend")
    └── public/_redirects             # SPA deep-link fallback
```

On the server the repo is cloned to `/opt/brightmango`, so **all deploy
commands run from `/opt/brightmango/backend`** (where the compose file lives).

---

## Part 0 — Clean up the AWS account first

Using your existing AWS account (billing already works there):

1. **Pay any past-due balance** (Billing → Payments). AWS suspends accounts
   with unpaid bills, and Lightsail lives in this same account.
2. **Find what's currently billing you**: Billing → Bills shows EC2 compute +
   VPC (that's a public IPv4) + EBS ("EC2-Other"). Go to **EC2 → Instances**
   in Mumbai (check other regions too, region picker top-right). If that
   instance is an old project you no longer need: terminate it, then
   **release its Elastic IP** (EC2 → Elastic IPs) and delete leftover EBS
   volumes/snapshots. Those three line items stop immediately.
3. Enable **MFA** on the root account if you haven't (IAM → Security
   credentials).
4. Safety net: Billing → **Budgets** → create a **$9/mo** budget with an email
   alert (covers the $7 instance + 18% GST + the odd snapshot), so you hear
   about any surprise before it grows.

---

## Part 1 — Create the Lightsail instance

1. Console → search **Lightsail** (it has its own simplified console) →
   **Create instance**.
2. **Region:** Mumbai (`ap-south-1`).
3. **Platform/Blueprint:** Linux/Unix → **Operating system only** →
   **Ubuntu 24.04 LTS**.
4. **SSH key:** use the default Lightsail key (download the `.pem`) or upload
   your own public key. If you download theirs:
   ```bash
   mv ~/Downloads/LightsailDefaultKey-ap-south-1.pem ~/.ssh/brightmango.pem
   chmod 400 ~/.ssh/brightmango.pem
   ```
5. **Plan — read this carefully, the tiers changed:**

   | Plan | RAM | vCPU | SSD | Transfer | Public IPv4? |
   |---|---|---|---|---|---|
   | $5/mo dual-stack | 0.5 GB | 2 | 20 GB | 1 TB | ✅ yes |
   | **$7/mo dual-stack** ← **pick this** | **1 GB** | **2** | **40 GB** | **2 TB** | ✅ **yes** |
   | $12/mo dual-stack | 2 GB | 2 | 60 GB | 3 TB | ✅ yes |
   | $3.50–$10/mo **IPv6-only** | up to 1 GB | 2 | up to 40 GB | — | ❌ **no** |

   Choose the **$7/mo dual-stack (1 GB RAM, 40 GB SSD, 2 TB)** bundle. 1 GB RAM
   is enough for the API + worker + Redis + Caddy (they're all lightweight, and
   the heavy image build happens in CI, not here). You can snapshot & resize to
   the $12 (2 GB) bundle later if memory gets tight (see **Part 12**).

   > ⚠️ **Do NOT pick an "IPv6-only" bundle.** They're 20–30% cheaper but have
   > **no public IPv4 address**. You need a public IPv4 so Cloudflare can point
   > an `A` record at it and Let's Encrypt can reach Caddy for the certificate.
   > "Dual-stack" = IPv4 + IPv6; that's what you want.

6. **Name:** `brightmango-api` → **Create instance**.
7. **Static IP (free, do this now):** Lightsail → **Networking → Create
   static IP** → attach it to `brightmango-api`. Without this, the IP changes
   on stop/start. Static IPs are free *while attached*. **Copy it — you'll use
   it everywhere below.**
8. **Firewall:** open the instance → **Networking** tab → IPv4 Firewall.
   Keep/ensure exactly these rules — nothing else:

   | App | Port | Notes |
   |---|---|---|
   | SSH | 22 | administration + GitHub Actions deploy |
   | HTTP | 80 | Let's Encrypt challenge + HTTP→HTTPS redirect |
   | HTTPS | 443 | live traffic |

   Redis (6379) and the Node port (4000) are **never** exposed — they stay
   inside the private Docker network.

### 1.1 First login & base setup

```bash
ssh -i ~/.ssh/brightmango.pem ubuntu@YOUR_STATIC_IP
```

Then on the server:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker + Compose (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# log out & back in so the docker group applies, then verify:
docker --version && docker compose version

# Add 1 GB swap — EMERGENCY protection against OOM, not extra RAM (see Part 12)
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

(No `ufw` needed — the Lightsail firewall handles it.)

---

## Part 2 — MongoDB Atlas (free managed database)

Don't self-host Mongo — Atlas's free tier is genuinely free and managed.

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a cluster: choose **M0 (Free)** → provider **AWS** → region
   **Mumbai (ap-south-1)** — the *same region as your Lightsail instance*,
   so DB round-trips are ~1 ms.
3. **Database Access** → *Add New Database User* → username `brightmango`,
   generate a strong password, role **Read and write to any database**. Save
   the password.
4. **Network Access** → *Add IP Address* → enter **your static IP**
   (and temporarily your laptop's IP if you want to inspect data with Compass).
   Do **not** use `0.0.0.0/0`.
5. **Clusters → Connect → Drivers** → copy the connection string:
   ```
   mongodb+srv://brightmango:<password>@cluster0.xxxxx.mongodb.net/brightmango?retryWrites=true&w=majority
   ```
   Replace `<password>`, and make sure the database name `brightmango` is in
   the path. This becomes `MONGODB_URI` in your `.env`.

---

## Part 3 — DNS & Cloudflare TLS setup

Assuming `brightmango.in` is already on Cloudflare (you're using R2/Stream):

1. Cloudflare dashboard → your zone → **DNS → Records → Add record**:

   | Type | Name | Content | Proxy |
   |---|---|---|---|
   | A | `api` | `YOUR_STATIC_IP` | **DNS only (grey cloud)** for now |

2. **Keep it grey-cloud (DNS only) until HTTPS works (Part 8).** Caddy needs to
   answer Let's Encrypt's HTTP-01 challenge on port 80 directly the first time.
   With the orange cloud on, that traffic goes through Cloudflare and the first
   issuance can fail.

3. **SSL/TLS mode (set now, matters after you flip to orange):** Cloudflare →
   **SSL/TLS → Overview** → choose **Full (strict)**.
   - **Full (strict)** = Cloudflare → your origin over HTTPS, validating the
     real Let's Encrypt certificate Caddy serves. This is correct and secure.
   - ❌ **Never use "Flexible."** Flexible makes Cloudflare talk to your origin
     over plain HTTP — it defeats encryption, breaks `Secure` cookies, and
     causes redirect loops with Caddy's automatic HTTP→HTTPS redirect.

(`app.brightmango.in` gets created automatically by Cloudflare Pages in Part 9.)

---

## Part 4 — Code changes before first deploy

The backend currently starts the HTTP server **and** all BullMQ workers in one
process (`backend/src/server.ts` → `startWorkers()`). To run them as separate
containers off a single image, make these small, backwards-compatible changes.
Local `npm run dev` keeps running everything in one process as before.

### 4.1 Add a worker entry point — new file `backend/src/worker.ts`

```ts
import { Worker } from 'bullmq';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { disconnectRedis } from './config/redis.js';
import { startWorkers } from './jobs/index.js';
import { logger } from './common/utils/logger.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const workers: Worker[] = startWorkers();
  logger.info(`[worker] ${workers.length} worker(s) running`);

  async function shutdown(signal: string): Promise<void> {
    logger.info(`[worker] ${signal} received, shutting down`);
    await Promise.allSettled(workers.map((w) => w.close()));
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
}

bootstrap().catch((err) => {
  logger.error({ err }, '[worker] failed to start');
  process.exit(1);
});
```

This compiles to `dist/worker.js` automatically via `npm run build` (plain
`tsc`), just like `dist/server.js`.

### 4.2 Gate the inline workers in the API process

So the `app` container runs the HTTP server **without** starting a second copy
of the workers (which would double-process every job).

**`backend/src/config/env.ts`** — add one field to the exported `env` object:

```ts
// alongside the other env reads:
runInlineWorkers: (process.env.RUN_INLINE_WORKERS ?? 'true') !== 'false',
```

**`backend/src/server.ts`** — change the one line that starts workers:

```ts
// before:
const workers: Worker[] = startWorkers();

// after:
const workers: Worker[] = env.runInlineWorkers ? startWorkers() : [];
```

Because the default is `true`, local development (`npm run dev`) is unchanged —
API + workers still run together in one process. In production we set
`RUN_INLINE_WORKERS=false` on the `app` container (Part 6), and the dedicated
`worker` container runs `dist/worker.js`.

### 4.3 Add the env var to `backend/.env.example`

```bash
# Set to "false" on the API container in production so the dedicated
# worker container is the only place BullMQ workers run. Default true.
RUN_INLINE_WORKERS=true
```

### 4.4 (Optional) convenience npm script — `backend/package.json`

```json
"start:worker": "node dist/worker.js"
```

### 4.5 SPA deep-link fallback — new file `frontend/public/_redirects`

```
/*    /index.html   200
```

Vite copies `public/` into `dist/` at build time, so this lands at the site
root and Cloudflare Pages serves `index.html` (HTTP 200) for any unmatched
path. Without it, deep links like `/courses/some-slug` or a page refresh on
`/learn/...` can return a 404 instead of letting React Router handle the route
(see **Part 9**).

> Commit and push these changes before configuring CI in Part 5 — the first
> Actions run must build an image that contains `dist/worker.js`.

---

## Part 5 — Container registry & GitHub secrets

We build the image in GitHub Actions and store it in **GitHub Container
Registry (GHCR)** — free, and it lives right next to the repo. The image will
be `ghcr.io/kunalkhandekar/bright-mango` (GHCR lowercases the owner/repo).

### 5.1 A read-only token for the server to pull

The repo is private, so its GHCR package is private too. The Lightsail server
needs to authenticate once to pull it.

1. GitHub → **Settings → Developer settings → Personal access tokens → Tokens
   (classic)** → **Generate new token (classic)**.
2. Scope: **only `read:packages`**. No repo scope, no write. Set a long expiry
   and a reminder to rotate it.
   > Use a **classic** PAT here — fine-grained PATs have patchy support for
   > pulling org/user container packages. Classic + `read:packages` is reliable.
3. Copy the token. You'll run `docker login ghcr.io` with it on the server in
   Part 6.

### 5.2 Repo secrets for the deploy workflow

GitHub → repo → **Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Value |
|---|---|
| `SERVER_HOST` | your Lightsail **static IP** |
| `SERVER_USER` | `deploy` (the dedicated user you create in Part 6) |
| `SERVER_SSH_KEY` | the **private** key of the dedicated deploy keypair (Part 6) |

Pushing the image to GHCR from Actions uses the built-in `GITHUB_TOKEN` — you
don't create a secret for that.

---

## Part 6 — Put the app on the server

### 6.1 Create a dedicated deploy user & harden SSH

Don't deploy as `root`, and don't reuse a personal SSH key for CI.

```bash
# as ubuntu on the server
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy

# create a dedicated CI keypair FOR the deploy user. Here we generate it on the
# server, print the private key to paste into the SERVER_SSH_KEY GitHub secret,
# then delete the private copy from the server.
sudo -u deploy ssh-keygen -t ed25519 -C "brightmango-ci" -f /home/deploy/.ssh/ci -N ""
sudo -u deploy bash -c 'cat /home/deploy/.ssh/ci.pub >> /home/deploy/.ssh/authorized_keys'
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
sudo cat /home/deploy/.ssh/ci      # <-- copy this PRIVATE key into the SERVER_SSH_KEY secret
sudo rm /home/deploy/.ssh/ci       # remove the private key from the server after copying
```

Harden the SSH daemon:

```bash
sudo tee /etc/ssh/sshd_config.d/hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF
sudo systemctl restart ssh
```

> **On SSH being open to all sources:** GitHub-hosted runners connect from a
> large, changing pool of IPs (published in GitHub's `meta` API but far too
> broad and volatile to allowlist usefully). So port 22 stays open to `0.0.0.0`
> in the Lightsail firewall — **key-only authentication is what keeps it safe**
> (password auth and root login are now disabled). This is the standard,
> practical trade-off; a VPN or self-hosted runner would be overkill at this
> scale.

### 6.2 Log the server in to GHCR (one time)

```bash
# as the deploy user
echo "YOUR_READ_PACKAGES_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

The credential is stored in `/home/deploy/.docker/config.json` so future pulls
just work.

### 6.3 Clone the repo (deploy files live in it)

The repo is private, so give the server read-only access via a **deploy key**:

```bash
# as the deploy user
ssh-keygen -t ed25519 -C "brightmango-server" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copy the output → GitHub repo → **Settings → Deploy keys → Add deploy key** →
paste, leave *write access* unchecked.

```bash
sudo mkdir -p /opt && sudo chown deploy:deploy /opt
cd /opt
git clone git@github.com:KunalKhandekar/Bright-Mango.git brightmango
cd brightmango
```

The server never builds anything from this checkout — it only needs
`backend/docker-compose.prod.yml` and `backend/Caddyfile` from it (and
`git pull` to update them). The `Dockerfile`/`.dockerignore` are used by CI,
not the server. All deploy commands below run from **`/opt/brightmango/backend`**.

### 6.4 Add the deployment files to the repo

These four files belong in the repo under **`backend/`** (commit them from your
laptop, then `git pull` on the server). They do **not** exist yet — create them.
The Docker **build context is `backend/`**, so the paths inside the Dockerfile
are relative to that folder (unchanged from a root layout):

**`backend/Dockerfile`** — multi-stage; the runtime image ships only
compiled JS + production deps, runs as a non-root user:

```dockerfile
# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- production deps only ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]   # the worker service overrides this command
```

**`backend/.dockerignore`** (the `frontend/`, `.github/`, `postman/` dirs sit
outside the `backend/` build context, so they don't need listing):

```
node_modules
dist
.git
.env
.env.*
*.log
coverage
*.md
.DS_Store
```

**`backend/docker-compose.prod.yml`** — four services, one image for
`app` + `worker` (different `command`), Redis private with persistence, only
Caddy publishes ports:

```yaml
services:
  app:
    image: ghcr.io/kunalkhandekar/bright-mango:${IMAGE_TAG:-latest}
    command: ["node", "dist/server.js"]
    env_file: .env
    environment:
      RUN_INLINE_WORKERS: "false"     # API container must NOT start workers
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    networks: [internal]

  worker:
    image: ghcr.io/kunalkhandekar/bright-mango:${IMAGE_TAG:-latest}
    command: ["node", "dist/worker.js"]
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks: [internal]

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "noeviction"]
    volumes:
      - redis-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [internal]

  caddy:
    image: caddy:2-alpine
    depends_on:
      app:
        condition: service_started
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data          # certificates & ACME account — MUST persist
      - caddy-config:/config
    restart: unless-stopped
    networks: [internal]

volumes:
  redis-data:
  caddy-data:
  caddy-config:

networks:
  internal:
    driver: bridge
```

Key points baked into this compose file:
- **`restart: unless-stopped`** on every service — they come back after a crash
  or a server reboot. The `worker` restarts on its own if a job crashes it.
- **Health checks:** `app` is polled on `/api/v1/health`; `redis` on `PING`.
  `app`/`worker` wait for Redis to be *healthy* before starting.
- **Redis persistence** via `appendonly yes` on a **named volume**
  (`redis-data`), so queued jobs and sessions survive restarts.
- **`--maxmemory-policy noeviction`** is deliberate: Redis holds BullMQ jobs
  *and* user sessions. Eviction would silently corrupt queues and log people
  out. On a 1 GB box, capping Redis at 256 MB and refusing evictions is the
  safe choice — if it ever fills, writes fail loudly instead of losing data
  (your cue to upgrade — Part 12).
- **Caddy persistence:** `caddy-data` holds the Let's Encrypt cert and ACME
  account. Persisting it avoids re-issuing (and hitting rate limits) on every
  restart.
- **Networking:** everything is on the private `internal` bridge network and
  reaches each other by service name (`app`, `redis`). **Only Caddy publishes
  `80`/`443`.** Redis and the Node `4000` port are never published, so they're
  unreachable from the internet regardless of the Lightsail firewall.
- **`env_file: .env`** loads all app secrets; `${IMAGE_TAG:-latest}` lets CI
  and rollbacks pin an exact image (Part 11).

**`backend/Caddyfile`** — Caddy obtains & auto-renews the TLS cert:

```
api.brightmango.in {
	reverse_proxy app:4000
}
```

### 6.5 Create the production `.env` on the server

It lives next to the compose file, at `/opt/brightmango/backend/.env`:

```bash
cd /opt/brightmango/backend
nano .env
```

Fill it based on `.env.example`. The values that **must differ from local dev**:

```bash
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1
WEB_APP_URL=https://app.brightmango.in
CORS_ORIGINS=https://app.brightmango.in,https://brightmango.in

# API container overrides this to false via compose; harmless to set here too
RUN_INLINE_WORKERS=false

# From Part 2 (Atlas)
MONGODB_URI=mongodb+srv://brightmango:PASSWORD@cluster0.xxxxx.mongodb.net/brightmango?retryWrites=true&w=majority

# 'redis' is the docker-compose service name — containers reach each other by name
REDIS_URL=redis://redis:6379

# Generate with: openssl rand -hex 48
OTP_HMAC_SECRET=<long-random-string>

# Leading dot => cookie is valid on app.brightmango.in AND api.brightmango.in
COOKIE_DOMAIN=.brightmango.in

# Then all your real keys, same names as .env.example:
# RESEND_API_KEY, MAIL_FROM, RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET (LIVE keys),
# R2_* (incl. R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY), CF_STREAM_*
```

Lock it down: `chmod 600 /opt/brightmango/backend/.env`

> **Cookie note (don't "fix" this):** the session cookie is `SameSite=Lax`,
> `Secure` (in production), `HttpOnly`, with `domain=.brightmango.in`.
> `app.brightmango.in` and `api.brightmango.in` are the **same site** (same
> registrable domain), so `Lax` correctly allows the SPA's credentialed
> requests. You do **not** need `SameSite=None`.

---

## Part 7 — First deploy & smoke test

Because there's no image in GHCR yet, do the very first build/push by pushing to
`main` (the workflow in Part 11 runs). Then on the server:

```bash
cd /opt/brightmango/backend
git pull                                   # get compose + Caddyfile
export IMAGE_TAG=latest                     # first time; CI pins SHAs after
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Verify:

```bash
docker compose -f docker-compose.prod.yml ps          # all four services up; app/redis healthy
docker compose -f docker-compose.prod.yml logs -f app # look for "[server] listening on :4000"
docker compose -f docker-compose.prod.yml logs -f worker  # "[worker] 3 worker(s) running"
curl http://localhost:4000/api/v1/health              # {"success":true,...} from inside the box
```

### 7.1 Seed the mentor account (one-time)

```bash
docker compose -f docker-compose.prod.yml exec app node dist/scripts/seedMentor.js
```

(The compiled `dist/scripts/seedMentor.js` ships in the image.)

---

## Part 8 — HTTPS goes live

With the `api` DNS record grey-cloud (Part 3) and ports 80/443 open, Caddy
automatically obtains and renews a Let's Encrypt certificate for
`api.brightmango.in` — no certbot, no cron jobs.

Test from your laptop:

```bash
curl https://api.brightmango.in/api/v1/health
```

If that returns your health JSON over HTTPS — the backend is live. 🎉

**Now flip on Cloudflare's proxy (optional but recommended):**
1. Cloudflare → DNS → set the `api` record to **orange-cloud (Proxied)**.
2. Confirm **SSL/TLS mode is Full (strict)** (Part 3). Caddy keeps its valid
   Let's Encrypt cert, so Full (strict) validates cleanly.
3. Leave ports **80 and 443** open — Caddy uses 443 (TLS-ALPN) to renew when
   proxied, and 80 for the HTTP→HTTPS redirect.

> If you enable the proxy, be aware there are now **two** hops in front of the
> app (Cloudflare → Caddy). The backend sets `trust proxy = 1`; if you rely on
> precise client IPs in logs/rate-limits you may bump that to `2`. Optional —
> functionality works either way.

---

## Part 9 — Frontend on Cloudflare Pages (free)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to
   Git** → authorize GitHub → pick the `Bright-Mango` repo.
2. Build settings:
   - **Framework preset:** Vite
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`  (runs `tsc -b && vite build`)
   - **Build output directory:** `dist`
3. The production API URL is already committed in `frontend/.env.production`
   (`VITE_API_URL=https://api.brightmango.in/api/v1`), so no env vars are needed
   in the Pages dashboard.
4. Deploy. Then **Custom domains → Add** → `app.brightmango.in`. Since DNS is on
   the same Cloudflare account, it wires up automatically with HTTPS.
5. **SPA deep links:** this app uses `createBrowserRouter` (HTML5 history
   routes like `/courses/:slug`, `/learn/...`). Cloudflare Pages does **not**
   reliably serve `index.html` for those paths on a hard refresh unless you
   tell it to — which is why you added **`frontend/public/_redirects`** in
   Part 4.5:
   ```
   /*    /index.html   200
   ```
   Vite copies it into `dist/`, and Pages then returns `index.html` (200) for
   any unmatched route so React Router can take over. Verify after deploy by
   loading a deep link directly (e.g. open `app.brightmango.in/login` in a new
   tab and refresh).

From now on, every push to `main` that touches `frontend/` auto-deploys via
Pages.

---

## Part 10 — Third-party service updates

- **Razorpay:** Dashboard → Settings → Webhooks → add
  `https://api.brightmango.in/api/v1/payments/webhook`, select the payment
  events you handle, and make sure the webhook secret matches
  `RAZORPAY_WEBHOOK_SECRET` in `.env`. Switch `RAZORPAY_KEY_ID/SECRET` to
  **live-mode** keys when you're ready for real payments.
- **Resend:** verify the `brightmango.in` domain (DNS records in Cloudflare)
  so mail from `no-reply@brightmango.in` (`MAIL_FROM`) doesn't land in spam.
- **Cloudflare Stream / R2:** already configured — copy the same `R2_*` and
  `CF_STREAM_*` keys into the server's `.env`.

---

## Part 11 — Auto-deploy the backend (GitHub Actions)

So you never build on the server. On every push to `main` that touches
`backend/**`, Actions **builds + tests + pushes** the image to GHCR, then SSHes
in and tells the server to **pull** it. (Frontend-only pushes are handled by
Cloudflare Pages, Part 9.)

Create **`.github/workflows/deploy.yml`** (this stays at the repo root — GitHub
requires it there — even though everything else backend lives in `backend/`):

```yaml
name: Deploy backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy.yml'

concurrency:
  group: deploy-backend
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    defaults:
      run:
        working-directory: backend      # npm steps run inside backend/
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,format=long
            type=raw,value=latest
      - uses: docker/build-push-action@v6
        with:
          context: ./backend             # build context is the backend folder
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            set -e
            cd /opt/brightmango/backend
            git pull --ff-only
            export IMAGE_TAG=sha-${{ github.sha }}
            echo "$IMAGE_TAG" > .last_deploy
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker image prune -f
```

What this gives you:
- **Build & test run in CI**, not on the 1 GB box — typecheck + lint + `tsc`
  build must pass before an image is pushed.
- Images are tagged with the **immutable commit SHA** (`sha-<full-sha>`) *and*
  `latest`. The server deploys the exact SHA and records it in `.last_deploy`.
- `git pull --ff-only` on the server just refreshes `docker-compose.prod.yml` /
  `Caddyfile`; it never builds.

### 11.1 Deployments cause a brief interruption (be honest about this)

`docker compose up -d` **recreates** the `app` and `worker` containers when the
image tag changes — the old container stops, the new one starts. For a few
seconds during that swap, `app` is down and Caddy will return `502` for
requests that land in the gap. **This is not a zero-downtime rolling swap**, and
that's acceptable at the current scale (deploys are infrequent and quick).

Caddy and Redis are *not* recreated on a normal deploy, so TLS and queued jobs
are unaffected. If you later need true zero-downtime, that's a bigger change
(multiple `app` replicas behind Caddy) — deliberately out of scope here; no
Kubernetes/ECS.

### 11.2 Rollback (previous known-good image)

Because every build is tagged with its commit SHA, rolling back is just
re-pointing `IMAGE_TAG` at an older SHA — no rebuild:

```bash
cd /opt/brightmango/backend

# what's live right now?
cat .last_deploy

# find a previous good tag (from git log, or list what's cached locally):
git log --oneline -n 10
docker images ghcr.io/kunalkhandekar/bright-mango

# roll back:
export IMAGE_TAG=sha-<previous-good-full-sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
echo "$IMAGE_TAG" > .last_deploy
```

`latest` always points at the newest build; the SHA tags are your stable,
immutable rollback targets.

---

## Part 12 — Resource & memory considerations (1 GB box)

1 GB RAM is enough for API + worker + Redis + Caddy at the current scale, but
it's not roomy. Keep an eye on it.

- **Swap is emergency protection, not extra RAM.** The 1 GB swapfile (Part 1.1)
  stops the kernel's OOM killer from nuking a container during a brief spike,
  but swapping is slow — if the box is *sustainedly* in swap, that's a signal
  to upgrade, not a solution.
- **Watch memory & disk** with these (no heavy monitoring stack needed):
  ```bash
  docker stats --no-stream     # live CPU/RAM per container
  free -h                      # system RAM + swap in use
  df -h                        # disk (watch /; Docker images/logs grow)
  docker system df             # what Docker is using (images, volumes, build cache)
  ```
- **Redis memory growth:** it's capped at 256 MB with `noeviction`. Check it
  (from `/opt/brightmango/backend`):
  ```bash
  docker compose -f docker-compose.prod.yml exec redis redis-cli info memory
  ```
  Failed BullMQ jobs are trimmed (`removeOnFail: 5000`), but a backlog can still
  grow — if `used_memory` approaches the cap, investigate stuck jobs.
- **Node memory:** the `app` and `worker` RSS should each sit well under a few
  hundred MB. If `worker` climbs, suspect a job doing heavy in-memory work
  (large file/video processing) — jobs should stream, not buffer whole payloads.
- **When to upgrade:** if you see consistent swap usage or the OOM killer in
  `dmesg`, snapshot the instance and resize to the **$12/mo (2 GB)** dual-stack
  bundle. It's a Lightsail console operation — no code changes.

---

## Part 13 — Backups (MongoDB → Cloudflare R2)

Atlas M0 has **no automated backups**. Until you move to a paid tier, run a
nightly `mongodump`, compress it, and ship it **off the server** to R2 (you're
already using R2 for assets). Never keep the only copy on the Lightsail box.

### 13.1 One-time setup

1. In Cloudflare R2, create a **dedicated** bucket `brightmango-backups`
   (separate from your assets bucket, so retention rules don't touch assets).
2. Add an R2 **lifecycle rule** on that bucket: delete objects under the
   `mongo/` prefix after **30 days** (your retention policy — adjust as needed).
3. The backup reuses your existing `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` /
   `R2_SECRET_ACCESS_KEY` from `.env`.

### 13.2 The backup script — `/opt/brightmango/backend/backup.sh`

Secrets are **sourced from `.env`**, never passed on the command line (so they
never appear in `ps` output or shell history):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Load secrets from the app's .env without echoing them
set -a
source /opt/brightmango/backend/.env
set +a

TS=$(date -u +%Y%m%d-%H%M%S)
OUT="/tmp/bm-$TS.archive.gz"

# Dump a compressed archive using the mongo tools image (URI via env, not argv)
docker run --rm -e MONGODB_URI="$MONGODB_URI" mongo:7 \
  sh -c 'mongodump --uri="$MONGODB_URI" --archive --gzip' > "$OUT"

# Upload to R2 (S3-compatible) using the AWS CLI image; keys via env, not argv
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -v "$OUT:$OUT:ro" \
  amazon/aws-cli \
  s3 cp "$OUT" "s3://brightmango-backups/mongo/$(basename "$OUT")" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"

rm -f "$OUT"
```

```bash
chmod 700 /opt/brightmango/backend/backup.sh
```

### 13.3 Schedule it (as the deploy user)

```bash
crontab -e
# nightly at 03:00 UTC; the secrets are inside the script, not in this line:
0 3 * * * /opt/brightmango/backend/backup.sh >> /var/log/brightmango-backup.log 2>&1
```

### 13.4 Restore from a backup

```bash
# pick the object you want from R2, then stream it back into Mongo:
set -a; source /opt/brightmango/backend/.env; set +a

docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  amazon/aws-cli \
  s3 cp "s3://brightmango-backups/mongo/bm-YYYYMMDD-HHMMSS.archive.gz" - \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
| docker run --rm -i -e MONGODB_URI="$MONGODB_URI" mongo:7 \
  sh -c 'mongorestore --uri="$MONGODB_URI" --archive --gzip --drop'
```

(`--drop` replaces existing collections — test restores against a scratch
database first.)

### 13.5 When to switch to managed backups

`mongodump` is fine while you're small. Once you have **real users and data you
can't afford to lose**, upgrade the cluster to **Atlas Flex** (~$8–30/mo
depending on usage), which includes continuous/point-in-time managed backups —
more reliable than a nightly dump, and you can retire this script.

---

## Part 14 — Day-2 operations cheat sheet

```bash
cd /opt/brightmango/backend
C="docker compose -f docker-compose.prod.yml"

# Logs (pino JSON)
$C logs -f app        # API
$C logs -f worker     # background jobs
$C logs -f caddy      # TLS / proxy

# Restart just one service
$C restart app
$C restart worker

# Redeploy a specific image (normally CI does this)
export IMAGE_TAG=sha-<sha> && $C pull && $C up -d

# Disk cleanup (old images pile up)
docker image prune -f
docker system df

# Resources at a glance
docker stats --no-stream
free -h && df -h
```

**Monitoring (free):**
- Lightsail console graphs CPU/network per instance and can email alerts
  (instance → Metrics → add alarm). Watch the **CPU burst capacity** graph —
  Lightsail instances burst, and sustained 100% CPU gets throttled. Your
  workload (API + light workers) is normally fine.
- Point <https://uptimerobot.com> (free) at
  `https://api.brightmango.in/api/v1/health` — it emails you if the API goes
  down.

**Snapshots:** after your first clean deploy, take a Lightsail **snapshot**
(instance → Snapshots) — a whole-server restore point for ~$0.05/GB-month.

---

## Cost summary

### Base required (monthly)

| Item | Cost |
|---|---|
| Lightsail **$7 dual-stack** (Mumbai): 1 GB RAM + 40 GB SSD + static IPv4 + 2 TB transfer | $7 + 18% GST ≈ **$8.26 ≈ ₹710** |
| Cloudflare Pages (frontend) | Free |
| MongoDB Atlas M0 | Free |
| Redis (on the instance) | Free |
| Caddy / Let's Encrypt TLS | Free |
| GitHub Container Registry (private package) | Free (within GitHub limits) |
| **Base total** | **≈ ₹710/month (~$8.3)** |

### Optional / as-you-grow

| Item | Cost |
|---|---|
| Lightsail snapshots (incremental) | ~$0.05/GB-month → cents–~$1/mo |
| R2 backup storage | within R2's 10 GB free tier at this scale → ~free |
| Atlas Flex (managed backups) — when you have real users | ~$8–30/mo |
| Upgrade to $12 (2 GB) Lightsail bundle — if memory pressure is sustained | +$5/mo + GST |
| `brightmango.in` domain registration | separate existing annual cost (not billed here) |

That's roughly a third of the ~$15/mo an equivalent EC2 setup would cost — and
because the whole backend is Docker Compose, it moves to any Ubuntu box with
zero code changes. *(An earlier version of this guide quoted ~₹520/mo based on
an incorrect $5 = 1 GB claim; the correct figure is ~₹710/mo.)*

---

## Deployment verification checklist

Run through this after the first deploy:

- [ ] `docker compose -f docker-compose.prod.yml ps` — `app`, `worker`,
      `redis`, `caddy` all **Up**; `app` and `redis` show **healthy**.
- [ ] `app` logs show `[server] listening on :4000`.
- [ ] `worker` logs show `[worker] 3 worker(s) running` (email, course-delete,
      video-status).
- [ ] **No** duplicate-worker logs in the `app` container (confirms
      `RUN_INLINE_WORKERS=false` took effect).
- [ ] `curl http://localhost:4000/api/v1/health` on the box → `{"success":true,…}`.
- [ ] `curl https://api.brightmango.in/api/v1/health` from your laptop → same,
      over a valid HTTPS cert.
- [ ] Cloudflare SSL/TLS mode is **Full (strict)** (once proxied).
- [ ] `redis` and port `4000` are **not** reachable from the internet
      (only 22/80/443 in the Lightsail firewall).
- [ ] Frontend loads at `https://app.brightmango.in`; a **deep link refresh**
      (e.g. `/login`) works (confirms `_redirects`).
- [ ] Log in end-to-end: the `bm_session` cookie is set and sent on
      `app.` → `api.` requests (CORS + cookie domain correct).
- [ ] Trigger an email (OTP) and confirm the `worker` processes the job.
- [ ] Razorpay webhook reaches `/api/v1/payments/webhook`.
- [ ] Mentor seeded (`dist/scripts/seedMentor.js`).
- [ ] `backup.sh` runs and an object appears under `brightmango-backups/mongo/`.
- [ ] Lightsail snapshot taken; UptimeRobot monitor is green.

---

## Rollback procedure (quick reference)

```bash
cd /opt/brightmango/backend
cat .last_deploy                                   # current tag
git log --oneline -n 10                            # find a previous good SHA
export IMAGE_TAG=sha-<previous-good-full-sha>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
echo "$IMAGE_TAG" > .last_deploy
```

Rollback is just re-pointing `IMAGE_TAG` — no rebuild. SHA tags are immutable;
`latest` follows the newest build. (Brief interruption during the swap, same as
a normal deploy — see Part 11.1.)

---

## Assumptions still requiring manual verification

- **GHCR classic PAT** (`read:packages`) is used for server pulls. Fine-grained
  PATs have inconsistent package support — verify the classic token works with
  `docker login ghcr.io` before relying on CI deploys.
- The **`mongo:7`** tools image and your Atlas cluster version are compatible
  for dump/restore. If Atlas is on a newer major, bump the image tag to match.
- The backup path assumes the static IP is in the **Atlas Network Access
  allowlist** and the **`brightmango-backups`** R2 bucket exists with a
  lifecycle rule.
- **`trust proxy`** is `1` in the code. With Cloudflare's proxy enabled there
  are two hops; if precise client IPs matter for rate-limiting/logging, consider
  bumping it to `2` (functionality works either way).
- Confirm your GitHub username/org casing resolves to
  `ghcr.io/kunalkhandekar/bright-mango` (GHCR lowercases it). Adjust the image
  name in `docker-compose.prod.yml` if your repo path differs.
