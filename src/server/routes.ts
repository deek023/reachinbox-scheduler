import { Router } from 'express';
import crypto from 'node:crypto';
import {
  getUser,
  getUserByEmail,
  getSenders,
  getSenderById,
  createSender,
  getEmailById,
  getEmailByIdempotencyKey,
  getEmails,
  createEmail,
  updateEmail,
  deleteEmail,
  getSlackConnection,
  saveSlackConnection,
  removeSlackConnection,
  getStats as getDbStats,
  isDatabaseConnected,
  getDatabaseStatus,
} from './db.ts';
import {
  emailQueue,
  addEmailJob,
  cancelEmailJob,
  triggerJobNow,
  getQueueStats,
  getQueueJobsList,
} from './queue.ts';
import { workerConfig } from './worker.ts';
import { isRedisConnected, getRedisStatus } from './redis.ts';
import {
  searchEmailDocuments,
  indexEmailDocument,
  deleteEmailDocument,
  getElasticsearchStatus,
  isElasticsearchConnected,
} from './elasticsearch.ts';
import {
  isGoogleOAuthConfigured,
  generateGoogleAuthUrl,
  handleGoogleOAuthCallback,
} from './auth.ts';
import {
  slackService,
  isSlackOAuthConfigured,
  getSlackOAuthUrl,
  exchangeSlackCodeForToken,
} from './slack.ts';
import { mailer } from './mailer.ts';

export const apiRouter = Router();

// ==========================================
// 1. Health & Infrastructure Status
// ==========================================
apiRouter.get('/health', async (req, res) => {
  const dbStatus = getDatabaseStatus();
  const redisStatus = getRedisStatus();
  const esStatus = getElasticsearchStatus();
  const queueStats = await getQueueStats(workerConfig);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
      bullmq: {
        active: isRedisConnected(),
        queue: 'email-queue',
        concurrency: workerConfig.concurrency,
      },
      smtp: mailer.getCredentials(),
      googleAuth: { configured: isGoogleOAuthConfigured() },
      slack: { configured: isSlackOAuthConfigured() },
    },
    queueStats,
  });
});

// Helper for session user id
function getSessionUserId(req: any): string {
  return req.session?.userId || 'usr_default';
}

// ==========================================
// 2. Real Google OAuth
// ==========================================
apiRouter.get('/auth/me', async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.json({ authenticated: false, user: null });
  }

  const user = await getUser(userId);
  if (!user) {
    return res.json({ authenticated: false, user: null });
  }

  res.json({ authenticated: true, user });
});

apiRouter.get('/auth/google/url', (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(400).json({
      configured: false,
      error:
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.',
    });
  }

  try {
    const url = generateGoogleAuthUrl();
    res.json({ configured: true, url });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Authorization code missing from Google callback.');
  }

  try {
    const user = await handleGoogleOAuthCallback(code);
    if (req.session) {
      req.session.userId = user.id;
    }
    // Redirect back to frontend
    res.redirect('/?auth=success');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Google OAuth Callback Error]:', msg);
    res.redirect(`/?auth=error&message=${encodeURIComponent(msg)}`);
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  if (req.session) {
    req.session = null;
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// 3. Senders
// ==========================================
apiRouter.get('/senders', async (req, res) => {
  try {
    const senders = await getSenders();
    res.json({ senders });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/senders', async (req, res) => {
  const { name, email, isDefault } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const newSender = await createSender({ name, email, isDefault });
    res.status(201).json({ sender: newSender });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ==========================================
// 4. Email Scheduling (Real BullMQ + PostgreSQL)
// ==========================================

/**
 * POST /api/emails/schedule
 * Requirement 1: Every recipient gets its own BullMQ job.
 * Requirement 3: Real PostgreSQL storage.
 * Requirement 4: Idempotency protection with unique idempotency_key.
 */
apiRouter.post('/emails/schedule', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const {
      recipient,
      recipients,
      subject,
      body,
      senderId,
      scheduledAt,
      idempotencyKey,
      delayBetweenEmailsMs = 2000,
    } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const senders = await getSenders();
    const defaultSender = senders.find((s) => s.isDefault) || senders[0];
    const targetSender = senderId ? (await getSenderById(senderId)) || defaultSender : defaultSender;

    interface NormalizedRecipient {
      email: string;
      name?: string;
      company?: string;
      customFields?: Record<string, string>;
    }

    const recipientList: NormalizedRecipient[] = [];

    if (Array.isArray(recipients) && recipients.length > 0) {
      for (const r of recipients) {
        if (typeof r === 'string' && r.includes('@')) {
          recipientList.push({ email: r.trim() });
        } else if (typeof r === 'object' && r.email && r.email.includes('@')) {
          recipientList.push({
            email: r.email.trim(),
            name: r.name,
            company: r.company,
            customFields: r.customFields,
          });
        }
      }
    } else if (recipient && typeof recipient === 'string') {
      recipientList.push({ email: recipient.trim() });
    }

    if (recipientList.length === 0) {
      return res.status(400).json({ error: 'At least one valid recipient email is required' });
    }

    const baseScheduledTime = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
    const scheduledRecords = [];

    // Schedule each lead individually: one DB record + one BullMQ job per recipient
    for (let i = 0; i < recipientList.length; i++) {
      const rec = recipientList[i];
      const leadScheduledTimestamp = baseScheduledTime + i * delayBetweenEmailsMs;
      const leadScheduledIso = new Date(leadScheduledTimestamp).toISOString();

      // Templating variables
      let personalizedBody = body.replace(/\{\{\s*email\s*\}\}/gi, rec.email);
      if (rec.name) {
        personalizedBody = personalizedBody.replace(/\{\{\s*name\s*\}\}/gi, rec.name);
      }
      if (rec.company) {
        personalizedBody = personalizedBody.replace(/\{\{\s*company\s*\}\}/gi, rec.company);
      }

      let personalizedSubject = subject;
      if (rec.name) {
        personalizedSubject = personalizedSubject.replace(/\{\{\s*name\s*\}\}/gi, rec.name);
      }
      if (rec.company) {
        personalizedSubject = personalizedSubject.replace(/\{\{\s*company\s*\}\}/gi, rec.company);
      }

      // Unique idempotency key per recipient
      const uniqueIdempotencyKey =
        idempotencyKey && recipientList.length === 1
          ? idempotencyKey
          : `idemp_${crypto.createHash('md5').update(`${userId}_${rec.email}_${subject}_${leadScheduledIso}`).digest('hex')}`;

      // Check PostgreSQL idempotency
      const existing = await getEmailByIdempotencyKey(uniqueIdempotencyKey);
      if (existing) {
        scheduledRecords.push({ ...existing, alreadyScheduled: true });
        continue;
      }

      // 1. Create PostgreSQL record
      const emailRecord = await createEmail({
        userId,
        senderId: targetSender ? targetSender.id : undefined,
        senderName: targetSender ? targetSender.name : undefined,
        senderEmail: targetSender ? targetSender.email : undefined,
        recipient: rec.email,
        subject: personalizedSubject,
        body: personalizedBody,
        scheduledAt: leadScheduledIso,
        status: 'SCHEDULED',
        idempotencyKey: uniqueIdempotencyKey,
      });

      // 2. Add real BullMQ delayed job (stored in Redis)
      const job = await addEmailJob({
        emailId: emailRecord.id,
        senderId: emailRecord.senderId,
        recipient: emailRecord.recipient,
        subject: emailRecord.subject,
        scheduledAt: emailRecord.scheduledAt,
      });

      // Update BullMQ job ID on DB record
      await updateEmail(emailRecord.id, { bullmqJobId: job.id });

      // 3. Index in real Elasticsearch (if online)
      await indexEmailDocument(emailRecord);

      scheduledRecords.push({
        ...emailRecord,
        bullmqJobId: job.id,
      });
    }

    res.status(201).json({
      success: true,
      count: scheduledRecords.length,
      emails: scheduledRecords,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API /emails/schedule Error]:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/emails/scheduled
apiRouter.get('/emails/scheduled', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const { emails: scheduled } = await getEmails({ userId, status: 'SCHEDULED', limit: 200 });
    const { emails: processing } = await getEmails({ userId, status: 'PROCESSING', limit: 50 });
    res.json({
      emails: [...processing, ...scheduled],
      total: scheduled.length + processing.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/emails/sent
apiRouter.get('/emails/sent', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const { emails, total } = await getEmails({ userId, status: 'SENT', limit: 200 });
    res.json({ emails, total });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/emails/failed
apiRouter.get('/emails/failed', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const { emails, total } = await getEmails({ userId, status: 'FAILED', limit: 200 });
    res.json({ emails, total });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/emails/search (Real Elasticsearch)
apiRouter.get('/emails/search', async (req, res) => {
  const query = req.query.q as string | undefined;
  const status = req.query.status as any;
  const userId = getSessionUserId(req);

  const results = await searchEmailDocuments({
    query,
    status,
    userId,
    limit: 100,
  });

  res.json(results);
});

// Actions on individual emails
apiRouter.delete('/emails/:id', async (req, res) => {
  const emailId = req.params.id;
  try {
    const email = await getEmailById(emailId);
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Cancel BullMQ job
    await cancelEmailJob(emailId);
    // Delete from PostgreSQL & Elasticsearch
    await deleteEmail(emailId);
    await deleteEmailDocument(emailId);

    res.json({ success: true, message: 'Email schedule and BullMQ job removed' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.patch('/emails/:id/reschedule', async (req, res) => {
  const emailId = req.params.id;
  const { scheduledAt } = req.body;
  if (!scheduledAt) {
    return res.status(400).json({ error: 'scheduledAt is required' });
  }

  try {
    const updated = await updateEmail(emailId, {
      scheduledAt,
      status: 'SCHEDULED',
      error: undefined,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Cancel existing job and re-add with new delay
    await cancelEmailJob(emailId);
    await addEmailJob({
      emailId: updated.id,
      senderId: updated.senderId,
      recipient: updated.recipient,
      subject: updated.subject,
      scheduledAt: updated.scheduledAt,
    });

    await indexEmailDocument(updated);
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/emails/:id/send-now', async (req, res) => {
  const emailId = req.params.id;
  try {
    const updated = await updateEmail(emailId, {
      scheduledAt: new Date().toISOString(),
      status: 'SCHEDULED',
    });

    if (!updated) {
      return res.status(404).json({ error: 'Email not found' });
    }

    await triggerJobNow(emailId);
    res.json({ success: true, email: updated });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ==========================================
// 5. BullMQ & Bull Board Queue Management
// ==========================================
apiRouter.get('/queue/stats', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const stats = await getQueueStats(workerConfig);
    const dbStats = await getDbStats(userId);
    res.json({ queue: stats, database: dbStats });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.get('/queue/jobs', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const jobs = await getQueueJobsList(limit);
    res.json({ jobs });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/queue/pause', async (req, res) => {
  try {
    const isPaused = await emailQueue.isPaused();
    if (isPaused) {
      await emailQueue.resume();
    } else {
      await emailQueue.pause();
    }
    res.json({ success: true, paused: !isPaused });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/queue/retry/:jobId', async (req, res) => {
  try {
    const job = await emailQueue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in BullMQ' });
    }
    await job.retry();
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ==========================================
// 6. Slack OAuth & Webhooks
// ==========================================
apiRouter.get('/slack/status', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const conn = await getSlackConnection(userId);
    res.json({
      configured: isSlackOAuthConfigured(),
      connected: !!conn,
      connection: conn || null,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.get('/slack/connect', (req, res) => {
  try {
    const url = getSlackOAuthUrl();
    res.redirect(url);
  } catch (err: unknown) {
    res.status(400).send(err instanceof Error ? err.message : String(err));
  }
});

apiRouter.get('/slack/callback', async (req, res) => {
  const code = req.query.code as string;
  const userId = getSessionUserId(req);

  if (!code) {
    return res.status(400).send('Authorization code missing from Slack callback.');
  }

  try {
    await exchangeSlackCodeForToken(code, userId);
    res.redirect('/?slack=connected');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Slack Callback Error]:', msg);
    res.redirect(`/?slack=error&message=${encodeURIComponent(msg)}`);
  }
});

apiRouter.post('/slack/webhook', async (req, res) => {
  const { teamName, channel, webhookUrl } = req.body;
  const userId = getSessionUserId(req);

  if (!webhookUrl) {
    return res.status(400).json({ error: 'webhookUrl is required' });
  }

  try {
    const conn = await saveSlackConnection({
      userId,
      teamName: teamName || 'Slack Workspace',
      channel: channel || '#email-scheduler-alerts',
      webhookUrl,
    });
    res.json({ success: true, connection: conn });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.delete('/slack/disconnect', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    await removeSlackConnection(userId);
    res.json({ success: true, message: 'Slack disconnected' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/slack/test', async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const result = await slackService.sendTestMessage(userId);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
