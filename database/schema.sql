-- ReachInbox Email Scheduler PostgreSQL Schema
-- Tables: users, senders, emails, slack_connections

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS senders (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) REFERENCES senders(id) ON DELETE SET NULL,
  sender_name VARCHAR(255),
  sender_email VARCHAR(255),
  recipient VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
  bullmq_job_id VARCHAR(255),
  message_id VARCHAR(255),
  sent_at TIMESTAMPTZ,
  preview_url TEXT,
  error TEXT,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  attempts INT DEFAULT 0,
  reschedule_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slack_connections (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  team_name VARCHAR(255),
  team_id VARCHAR(64),
  channel VARCHAR(255),
  channel_id VARCHAR(64),
  webhook_url TEXT,
  access_token TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance & Idempotency Indexes
CREATE INDEX IF NOT EXISTS idx_emails_status_scheduled_at ON emails (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails (user_id);
CREATE INDEX IF NOT EXISTS idx_emails_idempotency_key ON emails (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails (recipient);

-- Per-email hourly rate limit
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS hourly_limit INT DEFAULT 200;

