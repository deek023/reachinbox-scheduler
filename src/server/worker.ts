import { Worker, Job } from 'bullmq';
import { QUEUE_NAME, EmailJobData, rescheduleJobToDate } from './queue.ts';
import {
  createRedisClient,
  checkAndAcquireRateLimitSlot,
  getNextHourWindowDate,
} from './redis.ts';
import {
  claimEmailForWorker,
  getEmailById,
  updateEmail,
  getSenderById,
} from './db.ts';
import { mailer } from './mailer.ts';
import { indexEmailDocument } from './elasticsearch.ts';
import { slackService } from './slack.ts';

const workerRedisClient = createRedisClient();

export const workerConfig = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  minDelayBetweenEmailsMs: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { emailId, senderId } = job.data;
    console.log(`[BullMQ Worker] Picked up job ${job.id} for email ${emailId}`);

    // ==========================================
    // 1. Idempotency Check & Atomic Row Claim
    // ==========================================
    // Uses atomic UPDATE WHERE status = 'SCHEDULED' in PostgreSQL.
    // If another worker thread claimed this email, claimEmailForWorker returns null.
    const email = await claimEmailForWorker(emailId);
    if (!email) {
      console.log(`[BullMQ Idempotency] Email ${emailId} was already claimed or sent. Skipping duplicate send.`);
      return { skipped: true, reason: 'ALREADY_PROCESSED' };
    }

    const sender = (await getSenderById(senderId)) || (await getSenderById(email.senderId));
    const effectiveSenderId = sender ? sender.id : email.senderId || 'default_sender';

    // ==========================================
    // 2. Redis Atomic Rate Limiting Check
    // ==========================================
    let slotAcquired = false;
    let attempts = 0;

    while (!slotAcquired && attempts < 5) {
      attempts++;
      const check = await checkAndAcquireRateLimitSlot(
        effectiveSenderId,
        workerConfig.maxEmailsPerHour,
        workerConfig.minDelayBetweenEmailsMs
      );

      if (check.allowed) {
        slotAcquired = true;
        break;
      }

      if (check.reason === 'HOURLY_LIMIT_REACHED') {
        // Step 10 & 12: Reschedule into next hourly window and notify Slack!
        const nextHour = getNextHourWindowDate();
        console.warn(`[BullMQ Rate Limit] Sender ${effectiveSenderId} hit hourly cap (${workerConfig.maxEmailsPerHour}/hr). Rescheduling job ${job.id} to ${nextHour.toISOString()}`);

        // Revert DB status to SCHEDULED with updated scheduledAt
        const rescheduledCount = (email.rescheduledCount || 0) + 1;
        await updateEmail(email.id, {
          status: 'SCHEDULED',
          scheduledAt: nextHour.toISOString(),
          rescheduledCount,
        });

        // Reschedule in BullMQ
        await rescheduleJobToDate(job, nextHour);

        // Notify Slack
        await slackService.notifyRateLimitReached({
          userId: email.userId,
          senderEmail: sender?.email || email.senderEmail || 'unknown@domain.com',
          senderName: sender?.name || email.senderName || 'Sender',
          hourlyLimit: workerConfig.maxEmailsPerHour,
          postponedCount: 1,
          nextAvailableHour: nextHour.toLocaleTimeString(),
        });

        return { rescheduled: true, nextScheduledAt: nextHour.toISOString() };
      } else if (check.reason === 'MIN_DELAY_NOT_ELAPSED') {
        // Enforce spacing between consecutive sends
        const waitMs = Math.min(check.remainingWaitMs || 1000, 5000);
        console.log(`[BullMQ Rate Limit] Enforcing min delay spacing for sender ${effectiveSenderId}. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
      }
    }

    // ==========================================
    // 3. Dispatch Real SMTP Email (Ethereal)
    // ==========================================
    try {
      const fromAddress = sender
        ? `"${sender.name}" <${sender.email}>`
        : email.senderEmail || 'scheduler@reachinbox.ai';

      const mailResult = await mailer.sendMail({
        from: fromAddress,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        html: `<div style="font-family: sans-serif; line-height: 1.6; color: #111;">
          <p>${email.body.replace(/\n/g, '<br>')}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 11px; color: #6b7280;">Sent via ReachInbox Scheduler • BullMQ Delayed Queue • Ethereal SMTP</p>
        </div>`,
      });

      if (!mailResult.success) {
        throw new Error(mailResult.error || 'Failed to dispatch email via Ethereal SMTP');
      }

      // ==========================================
      // 4. Update Database: status = 'SENT'
      // ==========================================
      const updated = await updateEmail(email.id, {
        status: 'SENT',
        sentAt: new Date().toISOString(),
        messageId: mailResult.messageId,
        previewUrl: mailResult.previewUrl,
        error: undefined,
      });

      // ==========================================
      // 5. Sync Elasticsearch Index
      // ==========================================
      if (updated) {
        await indexEmailDocument(updated);
      }

      console.log(`[BullMQ Worker] ✅ Successfully sent email ${email.id} to ${email.recipient} (Preview: ${mailResult.previewUrl || 'N/A'})`);
      return { success: true, messageId: mailResult.messageId, previewUrl: mailResult.previewUrl };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[BullMQ Worker] ❌ Email ${email.id} dispatch error:`, errorMsg);

      await updateEmail(email.id, {
        status: 'FAILED',
        error: errorMsg,
      });

      throw err; // Trigger BullMQ backoff retry
    }
  },
  {
    connection: workerRedisClient,
    concurrency: workerConfig.concurrency,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[BullMQ Worker] Job ${job.id} marked as completed.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
});
