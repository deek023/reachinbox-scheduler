import type {
  User,
  Sender,
  EmailRecord,
  QueueStats,
  QueueJob,
  QueueConfig,
  SlackConnection,
} from '../types/email.ts';

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

// User / Auth
export async function fetchCurrentUser(): Promise<{ authenticated: boolean; user: User | null }> {
  const res = await fetch(`${BASE_URL}/auth/me`);
  return res.json();
}

export async function getGoogleAuthUrl(): Promise<{ configured: boolean; url?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/auth/google/url`);
  return res.json();
}

export async function logoutUser() {
  const res = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
  return res.json();
}

// Senders
export async function fetchSenders(): Promise<{ senders: Sender[] }> {
  const res = await fetch(`${BASE_URL}/senders`);
  return res.json();
}

export async function createSender(data: { name: string; email: string; isDefault?: boolean }): Promise<{ sender: Sender }> {
  const res = await fetch(`${BASE_URL}/senders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Emails
export async function fetchScheduledEmails(): Promise<{ emails: EmailRecord[]; total: number }> {
  const res = await fetch(`${BASE_URL}/emails/scheduled`);
  return res.json();
}

export async function fetchSentEmails(): Promise<{ emails: EmailRecord[]; total: number }> {
  const res = await fetch(`${BASE_URL}/emails/sent`);
  return res.json();
}

export async function searchEmails(query: string, status?: string): Promise<{
  connected: boolean;
  error?: string;
  hits: Array<EmailRecord & { score: number; highlight?: { field: string; snippet: string } }>;
  total: number;
  facets: { byStatus: Record<string, number> };
}> {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (status) params.append('status', status);
  const res = await fetch(`${BASE_URL}/emails/search?${params.toString()}`);
  return res.json();
}

export async function scheduleEmail(payload: {
  recipient?: string;
  recipients?: Array<{ email: string; name?: string; company?: string }>;
  subject: string;
  body: string;
  senderId?: string;
  scheduledAt: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  idempotencyKey?: string;
}) {
  const res = await fetch(`${BASE_URL}/emails/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function cancelScheduledEmail(id: string) {
  const res = await fetch(`${BASE_URL}/emails/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function rescheduleEmail(id: string, scheduledAt: string) {
  const res = await fetch(`${BASE_URL}/emails/${id}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledAt }),
  });
  return res.json();
}

export async function sendEmailNow(id: string) {
  const res = await fetch(`${BASE_URL}/emails/${id}/send-now`, { method: 'POST' });
  return res.json();
}

// Queue & Bull Board
export async function fetchQueueStats(): Promise<{ queue: QueueStats; database: any }> {
  const res = await fetch(`${BASE_URL}/queue/stats`);
  return res.json();
}

export async function fetchQueueJobs(limit = 100): Promise<{ jobs: QueueJob[] }> {
  const res = await fetch(`${BASE_URL}/queue/jobs?limit=${limit}`);
  return res.json();
}

export async function toggleQueuePause(): Promise<{ success: boolean; paused: boolean }> {
  const res = await fetch(`${BASE_URL}/queue/pause`, { method: 'POST' });
  return res.json();
}

export async function retryQueueJob(jobId: string) {
  const res = await fetch(`${BASE_URL}/queue/retry/${jobId}`, { method: 'POST' });
  return res.json();
}

// Slack
export async function fetchSlackStatus(): Promise<{ configured: boolean; connected: boolean; connection: SlackConnection | null }> {
  const res = await fetch(`${BASE_URL}/slack/status`);
  return res.json();
}

export async function connectSlackWebhook(payload: { teamName?: string; channel?: string; webhookUrl: string }) {
  const res = await fetch(`${BASE_URL}/slack/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function disconnectSlack() {
  const res = await fetch(`${BASE_URL}/slack/disconnect`, { method: 'DELETE' });
  return res.json();
}

export async function testSlackNotification(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/slack/test`, { method: 'POST' });
  return res.json();
}
