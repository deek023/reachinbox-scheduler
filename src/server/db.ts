import "dotenv/config";
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { User, Sender, EmailRecord, SlackConnection, EmailStatus } from '../types/email.ts';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'reachinbox'}`;

let isConnected = false;
let lastDbError: string | null = null;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  isConnected = false;
  lastDbError = err.message;
  console.error('[PostgreSQL Pool Error]:', err.message);
});

export function isDatabaseConnected(): boolean {
  return isConnected;
}

export function getDatabaseStatus() {
  return {
    connected: isConnected,
    url: DATABASE_URL.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'),
    error: lastDbError,
  };
}

export async function initDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    isConnected = true;
    lastDbError = null;
    client.release();

    // Read and run schema.sql
    const schemaPath = path.resolve(process.cwd(), 'database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(sql);
      console.log('[PostgreSQL] Database schema verified and initialized.');
    }

    // Ensure at least one default sender exists for immediate outreach
    const sendersRes = await pool.query('SELECT id FROM senders LIMIT 1');
    if (sendersRes.rowCount === 0) {
      const defaultSenderId = 'snd_' + crypto.randomUUID().slice(0, 8);
      await pool.query(
        `INSERT INTO senders (id, name, email, is_default)
         VALUES ($1, $2, $3, $4)`,
        [defaultSenderId, 'ReachInbox Growth', 'growth@reachinbox.ai', true]
      );
      console.log('[PostgreSQL] Seeded default sender identity.');
    }

    return true;
  } catch (err: unknown) {
    isConnected = false;
    lastDbError = err instanceof Error ? err.message : String(err);
    console.warn('[PostgreSQL] Could not connect to PostgreSQL:', lastDbError);
    return false;
  }
}

// ==========================================
// 1. Users
// ==========================================
export async function getUser(id: string): Promise<User | undefined> {
  const res = await pool.query<any>(
    'SELECT id, email, name, avatar, created_at as "createdAt" FROM users WHERE id = $1',
    [id]
  );
  return res.rows[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const res = await pool.query<any>(
    'SELECT id, email, name, avatar, created_at as "createdAt" FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return res.rows[0];
}

export async function upsertUser(user: { id: string; email: string; name: string; avatar?: string }): Promise<User> {
  const res = await pool.query<any>(
    `INSERT INTO users (id, email, name, avatar)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name, avatar = EXCLUDED.avatar
     RETURNING id, email, name, avatar, created_at as "createdAt"`,
    [user.id, user.email, user.name, user.avatar || null]
  );
  return res.rows[0];
}

// ==========================================
// 2. Senders
// ==========================================
export async function getSenders(): Promise<Sender[]> {
  const res = await pool.query<any>(
    'SELECT id, name, email, is_default as "isDefault", created_at as "createdAt" FROM senders ORDER BY created_at ASC'
  );
  return res.rows;
}

export async function getSenderById(id: string): Promise<Sender | undefined> {
  const res = await pool.query<any>(
    'SELECT id, name, email, is_default as "isDefault", created_at as "createdAt" FROM senders WHERE id = $1',
    [id]
  );
  return res.rows[0];
}

export async function createSender(sender: { name: string; email: string; isDefault?: boolean }): Promise<Sender> {
  const id = 'snd_' + crypto.randomUUID().slice(0, 8);
  const res = await pool.query<any>(
    `INSERT INTO senders (id, name, email, is_default)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, is_default as "isDefault", created_at as "createdAt"`,
    [id, sender.name, sender.email, !!sender.isDefault]
  );
  return res.rows[0];
}

// ==========================================
// 3. Emails
// ==========================================
export async function getEmailById(id: string): Promise<EmailRecord | undefined> {
  const res = await pool.query<any>(
    `SELECT
      id, user_id as "userId", sender_id as "senderId",
      sender_name as "senderName", sender_email as "senderEmail",
      recipient, subject, body,
      scheduled_at as "scheduledAt", status,
      bullmq_job_id as "bullmqJobId", message_id as "messageId",
      sent_at as "sentAt", preview_url as "previewUrl",
      error, idempotency_key as "idempotencyKey",
      attempts, reschedule_count as "rescheduledCount",
      created_at as "createdAt", updated_at as "updatedAt"
     FROM emails
     WHERE id = $1`,
    [id]
  );
  return res.rows[0];
}

export async function getEmailByIdempotencyKey(key: string): Promise<EmailRecord | undefined> {
  const res = await pool.query<any>(
    `SELECT
      id, user_id as "userId", sender_id as "senderId",
      sender_name as "senderName", sender_email as "senderEmail",
      recipient, subject, body,
      scheduled_at as "scheduledAt", status,
      bullmq_job_id as "bullmqJobId", message_id as "messageId",
      sent_at as "sentAt", preview_url as "previewUrl",
      error, idempotency_key as "idempotencyKey",
      attempts, reschedule_count as "rescheduledCount",
      created_at as "createdAt", updated_at as "updatedAt"
     FROM emails
     WHERE idempotency_key = $1`,
    [key]
  );
  return res.rows[0];
}

export async function getEmails(options?: {
  userId?: string;
  status?: EmailStatus;
  limit?: number;
  offset?: number;
}): Promise<{ emails: EmailRecord[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (options?.userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    params.push(options.userId);
  }

  if (options?.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(options.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*) as total FROM emails ${whereClause}`, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  params.push(limit);
  const limitIdx = paramIdx++;
  params.push(offset);
  const offsetIdx = paramIdx++;

  const listRes = await pool.query<any>(
    `SELECT
      id, user_id as "userId", sender_id as "senderId",
      sender_name as "senderName", sender_email as "senderEmail",
      recipient, subject, body,
      scheduled_at as "scheduledAt", status,
      bullmq_job_id as "bullmqJobId", message_id as "messageId",
      sent_at as "sentAt", preview_url as "previewUrl",
      error, idempotency_key as "idempotencyKey",
      attempts, reschedule_count as "rescheduledCount",
      created_at as "createdAt", updated_at as "updatedAt"
     FROM emails
     ${whereClause}
     ORDER BY scheduled_at DESC, created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return { emails: listRes.rows, total };
}

export async function createEmail(email: {
  userId: string;
  senderId?: string;
  senderName?: string;
  senderEmail?: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status?: EmailStatus;
  idempotencyKey: string;
}): Promise<EmailRecord> {
  const id = 'eml_' + crypto.randomUUID().slice(0, 10);
  const status = email.status || 'SCHEDULED';

  const res = await pool.query<any>(
    `INSERT INTO emails (
      id, user_id, sender_id, sender_name, sender_email,
      recipient, subject, body, scheduled_at, status, idempotency_key
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING
      id, user_id as "userId", sender_id as "senderId",
      sender_name as "senderName", sender_email as "senderEmail",
      recipient, subject, body,
      scheduled_at as "scheduledAt", status,
      bullmq_job_id as "bullmqJobId", message_id as "messageId",
      sent_at as "sentAt", preview_url as "previewUrl",
      error, idempotency_key as "idempotencyKey",
      attempts, reschedule_count as "rescheduledCount",
      created_at as "createdAt", updated_at as "updatedAt"`,
    [
      id,
      email.userId,
      email.senderId || null,
      email.senderName || null,
      email.senderEmail || null,
      email.recipient,
      email.subject,
      email.body,
      email.scheduledAt,
      status,
      email.idempotencyKey,
    ]
  );
  return res.rows[0];
}

/**
 * Concurrency-Safe Atomic Claim for Workers
 * Uses a single atomic UPDATE with status condition.
 * If another worker already claimed or sent the email, rowCount will be 0.
 */
export async function claimEmailForWorker(emailId: string): Promise<EmailRecord | null> {
  const res = await pool.query<any>(
    `UPDATE emails
     SET status = 'PROCESSING',
         attempts = attempts + 1,
         updated_at = NOW()
     WHERE id = $1 AND (status = 'SCHEDULED' OR status = 'FAILED')
     RETURNING
      id, user_id as "userId", sender_id as "senderId",
      sender_name as "senderName", sender_email as "senderEmail",
      recipient, subject, body,
      scheduled_at as "scheduledAt", status,
      bullmq_job_id as "bullmqJobId", message_id as "messageId",
      sent_at as "sentAt", preview_url as "previewUrl",
      error, idempotency_key as "idempotencyKey",
      attempts, reschedule_count as "rescheduledCount",
      created_at as "createdAt", updated_at as "updatedAt"`,
    [emailId]
  );
  return res.rows[0] || null;
}

export async function updateEmail(id: string, patch: Partial<EmailRecord>): Promise<EmailRecord | undefined> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (patch.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    params.push(patch.status);
  }
  if (patch.bullmqJobId !== undefined) {
    setClauses.push(`bullmq_job_id = $${paramIdx++}`);
    params.push(patch.bullmqJobId);
  }
  if (patch.messageId !== undefined) {
    setClauses.push(`message_id = $${paramIdx++}`);
    params.push(patch.messageId);
  }
  if (patch.sentAt !== undefined) {
    setClauses.push(`sent_at = $${paramIdx++}`);
    params.push(patch.sentAt);
  }
  if (patch.previewUrl !== undefined) {
    setClauses.push(`preview_url = $${paramIdx++}`);
    params.push(patch.previewUrl);
  }
  if (patch.error !== undefined) {
    setClauses.push(`error = $${paramIdx++}`);
    params.push(patch.error);
  }
  if (patch.scheduledAt !== undefined) {
    setClauses.push(`scheduled_at = $${paramIdx++}`);
    params.push(patch.scheduledAt);
  }
  if (patch.rescheduledCount !== undefined) {
    setClauses.push(`reschedule_count = $${paramIdx++}`);
    params.push(patch.rescheduledCount);
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);
  const idIdx = paramIdx++;

  const res = await pool.query<any>(
    `UPDATE emails
     SET ${setClauses.join(', ')}
     WHERE id = $${idIdx}
     RETURNING
      id, user_id as "userId", sender_id as "senderId",
      sender_name as "senderName", sender_email as "senderEmail",
      recipient, subject, body,
      scheduled_at as "scheduledAt", status,
      bullmq_job_id as "bullmqJobId", message_id as "messageId",
      sent_at as "sentAt", preview_url as "previewUrl",
      error, idempotency_key as "idempotencyKey",
      attempts, reschedule_count as "rescheduledCount",
      created_at as "createdAt", updated_at as "updatedAt"`,
    params
  );

  return res.rows[0];
}

export async function deleteEmail(id: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM emails WHERE id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
}

// ==========================================
// 4. Slack Connections
// ==========================================
export async function getSlackConnection(userId: string): Promise<SlackConnection | undefined> {
  const res = await pool.query<any>(
    `SELECT
      id, user_id as "userId", team_name as "teamName",
      channel, webhook_url as "webhookUrl", connected_at as "connectedAt"
     FROM slack_connections
     WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0];
}

export async function saveSlackConnection(conn: {
  userId: string;
  teamName?: string;
  teamId?: string;
  channel?: string;
  channelId?: string;
  webhookUrl?: string;
  accessToken?: string;
}): Promise<SlackConnection> {
  const id = 'slk_' + crypto.randomUUID().slice(0, 8);
  const res = await pool.query<any>(
    `INSERT INTO slack_connections (id, user_id, team_name, team_id, channel, channel_id, webhook_url, access_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING
     RETURNING
      id, user_id as "userId", team_name as "teamName",
      channel, webhook_url as "webhookUrl", connected_at as "connectedAt"`,
    [
      id,
      conn.userId,
      conn.teamName || null,
      conn.teamId || null,
      conn.channel || null,
      conn.channelId || null,
      conn.webhookUrl || null,
      conn.accessToken || null,
    ]
  );
  return res.rows[0];
}

export async function removeSlackConnection(userId: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM slack_connections WHERE user_id = $1', [userId]);
  return (res.rowCount ?? 0) > 0;
}

// ==========================================
// 5. Aggregate Stats
// ==========================================
export async function getStats(userId?: string) {
  const params: any[] = [];
  const where = userId ? 'WHERE user_id = $1' : '';
  if (userId) params.push(userId);

  const res = await pool.query<any>(
    `SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
      COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) as processing,
      COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
      COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
     FROM emails ${where}`,
    params
  );

  const row = res.rows[0] || {};
  return {
    total: parseInt(row.total || '0', 10),
    scheduled: parseInt(row.scheduled || '0', 10),
    processing: parseInt(row.processing || '0', 10),
    sent: parseInt(row.sent || '0', 10),
    failed: parseInt(row.failed || '0', 10),
  };
}
