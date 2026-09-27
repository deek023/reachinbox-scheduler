# ReachInbox Scheduler — Full-Stack Production Architecture

A high-performance email scheduling system built with **BullMQ**, **Redis**, **PostgreSQL**, **Nodemailer (Ethereal SMTP)**, **Elasticsearch**, **Google OAuth**, and **Bull Board**.

---

## Live Demo

**Hosted Application:** https://reachinbox-scheduler-1bgv.onrender.com

> The hosted version demonstrates the email scheduling dashboard, background job processing, rate limiting, and queue management.

---

## Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Tailwind CSS | Interactive dashboard, lead CSV upload, scheduling controls |
| **Backend** | Node.js + Express + TypeScript | REST API, OAuth endpoints, Bull Board mount |
| **Database** | PostgreSQL (`pg`) | Persistent relational storage for users, senders, emails, slack |
| **Queue** | BullMQ (`Queue`, `Worker`) | Delayed email jobs, concurrency control, exponential retry backoff |
| **Queue Storage** | Redis (`ioredis`) | Job state persistence, atomic rate-limit counters & Lua scripts |
| **Search Engine** | Elasticsearch (`@elastic/elasticsearch`) | Full-text tokenization and scoring across recipient, subject, body |
| **Email SMTP** | Nodemailer + Ethereal Email | SMTP-based test delivery with rendered web preview URLs |
| **Queue UI** | Bull Board (`@bull-board/express`) | Real-time queue visualizer mounted at `/admin/queues` |
| **Auth** | Google OAuth 2.0 (`google-auth-library`) | Secure user authentication and session management |
| **Alerts** | Slack OAuth & Incoming Webhooks | Automated notifications when sender hourly rate limit is hit |

---

## 1. Prerequisites

- **Node.js** >= 18 or **Bun**
- **Docker** and **Docker Compose** (for running PostgreSQL, Redis, and Elasticsearch locally)
- A web browser (Google Chrome, Firefox, Safari)

---

## 2. Infrastructure Setup (Docker Compose)

Create or run the following services using Docker:

### PostgreSQL
```bash
docker run -d \
  --name reachinbox-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=reachinbox \
  postgres:16-alpine
```

### Redis
```bash
docker run -d \
  --name reachinbox-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Elasticsearch
```bash
docker run -d \
  --name reachinbox-elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  elasticsearch:8.11.0
```

---

## 3. Database Initialization

The PostgreSQL schema is located in `database/schema.sql`.

When `server.ts` starts, `initDatabase()` automatically connects to PostgreSQL and applies `database/schema.sql` if tables do not exist.

To manually initialize the database with `psql`:
```bash
psql -h localhost -U postgres -d reachinbox -f database/schema.sql
```

The database includes tables:
- `users`: Authenticated user profiles (id, email, name, avatar)
- `senders`: Multiple sender identities (id, name, email, is_default)
- `emails`: Individual email records (id, recipient, subject, body, scheduled_at, status, bullmq_job_id, idempotency_key, preview_url, message_id)
- `slack_connections`: Connected Slack workspaces, channels, and webhook tokens

---

## 4. Google OAuth Setup

1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add Authorized Redirect URI:
   ```text
   http://localhost:3000/api/auth/google/callback
   ```
4. Copy `Client ID` and `Client Secret` into your `.env`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"
   ```

---

## 5. Slack OAuth & Webhook Setup

1. Open [Slack API Apps](https://api.slack.com/apps) and create a new App.
2. Under **OAuth & Permissions**, add Redirect URL:
   ```text
   http://localhost:3000/api/slack/callback
   ```
3. Add Scopes: `incoming-webhook`, `chat:write`.
4. Configure in `.env`:
   ```env
   SLACK_CLIENT_ID="your-slack-client-id"
   SLACK_CLIENT_SECRET="your-slack-client-secret"
   SLACK_REDIRECT_URI="http://localhost:3000/api/slack/callback"
   ```
   *(Alternatively, you can paste an Incoming Webhook URL directly in the dashboard UI).*

---

## 6. Ethereal Email Setup

Ethereal is a fake SMTP service that captures outgoing mail and provides a web preview link.
- By default, ReachInbox automatically creates a test account on boot via `nodemailer.createTestAccount()`.
- To use an existing account, set `ETHEREAL_USER` and `ETHEREAL_PASS` in `.env`.

---

## 7. Starting the Application

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack server (runs Express API, BullMQ worker, and mounts Vite)
npm run dev

# Or build and run in production:
npm run build
npm start
```

- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Bull Board Dashboard**: [http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)
- **Health API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## Core Engineering Decisions

### 1. One Database Record Per Recipient Email
When uploading a CSV with 100 leads, the system creates **100 independent PostgreSQL records** and **100 BullMQ delayed jobs**.
- Granular delivery tracking per recipient.
- Individual retry capability for failed sends.
- Per-recipient rate-limit checking.
- Exact-match search indexing in Elasticsearch.

### 2. How Delayed Jobs Work (No Cron)
Scheduled emails calculate `delay = scheduledAt - Date.now()`. BullMQ places the job in a Redis sorted set scored by execution timestamp (`bull:email-queue:delayed`). BullMQ's internal timer triggers when the job becomes ready and transitions it into `waiting` for worker consumption.

### 3. Restart Persistence (Step 8 Demo Requirement)
Because all queue state is stored in Redis (not in-memory JS maps or timeouts):
1. An email scheduled for 5 minutes later is recorded in PostgreSQL and Redis.
2. If the backend process is killed (`kill -9`) or restarted, zero jobs are lost.
3. Upon restart, the BullMQ worker reconnects to Redis and resumes delayed jobs at their exact remaining countdown.

### 4. Idempotency & Safe Concurrency
To guarantee that two concurrent worker processes never send the same email twice:
- Every email has a unique `idempotency_key` with a PostgreSQL `UNIQUE` database constraint.
- When a worker picks up a job, it executes an atomic compare-and-swap SQL statement:
  ```sql
  UPDATE emails
  SET status = 'PROCESSING', attempts = attempts + 1, updated_at = NOW()
  WHERE id = $1 AND (status = 'SCHEDULED' OR status = 'FAILED')
  RETURNING *;
  ```
- If another worker already claimed the row, the query returns 0 rows, and the second worker skips the job.
- *External SMTP Window*: While database state transitions are strictly atomic, external SMTP operations are network side-effects. The email is marked `PROCESSING` before SMTP dispatch to prevent duplicate calls, and finalized as `SENT` with `messageId` and `previewUrl` immediately upon acknowledgment.

### 5. Multi-Worker Rate Limiting (Atomic Redis Lua Script)
Rate limiting must be safe when multiple worker processes execute concurrently. We use an atomic Redis Lua script (`RATE_LIMIT_LUA` in `src/server/redis.ts`):
- **Minimum delay between sends**: Tracks `sender_last_sent:{senderId}`.
- **Hourly limit per sender**: Tracks `email_rate_limit:{senderId}:{YYYYMMDDHH}` with atomic increment and automatic TTL.
- **Behavior on limit reach**: The email is **never failed or dropped**. The worker reschedules it into the next hourly window (`getNextHourWindowDate()`), updates PostgreSQL, and fires a real notification to Slack.

---

## Verification Checklist

1. [x] Real `bullmq` (`Queue`, `Worker`, delayed jobs)
2. [x] Real `ioredis` Redis connection
3. [x] Real `pg` PostgreSQL connection with `database/schema.sql`
4. [x] Real `@elastic/elasticsearch` client and search mapping
5. [x] Real `@bull-board/express` mounted at `/admin/queues`
6. [x] Real `google-auth-library` OAuth2 client
7. [x] Real Slack OAuth & Webhook notification handler
8. [x] Real Nodemailer Ethereal SMTP with rendered web previews
9. [x] Atomic Lua script rate-limiting across concurrent workers
10. [x] Zero mock JSON databases (`data/database.json` and `data/queue.json` eliminated)
