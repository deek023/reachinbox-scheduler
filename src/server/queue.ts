import { Queue, Job } from 'bullmq';
import { createRedisClient, isRedisConnected, getRedisStatus } from './redis.ts';
import type { QueueJob, QueueStats, QueueConfig } from '../types/email.ts';

export const QUEUE_NAME = 'email-queue';

// BullMQ recommends a dedicated connection for Queue instance
export const queueRedisClient = createRedisClient();

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: queueRedisClient,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export interface EmailJobData {
  emailId: string;
  senderId: string;
  recipient?: string;
  subject?: string;
  rescheduleAttempts?: number;
}

/**
 * Adds a real BullMQ delayed job for an email.
 * Every recipient gets its own BullMQ job.
 * Delayed until scheduledAt.
 * Preserves job state across restarts in Redis.
 */
export async function addEmailJob(payload: {
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
}): Promise<Job<EmailJobData>> {
  if (!isRedisConnected()) {
    throw new Error('Cannot schedule BullMQ job: Redis is not connected. Please verify REDIS_URL.');
  }

  const scheduledTimestamp = new Date(payload.scheduledAt).getTime();
  const now = Date.now();
  const delay = Math.max(0, scheduledTimestamp - now);

  const job = await emailQueue.add(
    'send-email',
    {
      emailId: payload.emailId,
      senderId: payload.senderId,
      recipient: payload.recipient,
      subject: payload.subject,
      rescheduleAttempts: 0,
    },
    {
      jobId: `job_${payload.emailId}`,
      delay,
    }
  );

  console.log(`[BullMQ Queue] Enqueued job ${job.id} for email ${payload.emailId} (delay: ${(delay / 1000).toFixed(1)}s)`);
  return job;
}

/**
 * Reschedules a BullMQ job into the next available hourly window (e.g. when rate limit hit)
 */
export async function rescheduleJobToDate(
  job: Job<EmailJobData>,
  newScheduledDate: Date
): Promise<Job<EmailJobData>> {
  const newTimestamp = newScheduledDate.getTime();
  const delay = Math.max(0, newTimestamp - Date.now());

  // Remove existing job
  try {
    await job.remove();
  } catch (err) {
    // Already removed or active
  }

  // Re-add with new delay and incremented reschedule counter
  const newJob = await emailQueue.add(
    'send-email',
    {
      ...job.data,
      rescheduleAttempts: (job.data.rescheduleAttempts || 0) + 1,
    },
    {
      jobId: `job_${job.data.emailId}_resched_${Date.now()}`,
      delay,
    }
  );

  console.log(`[BullMQ Queue] Rescheduled job for email ${job.data.emailId} to ${newScheduledDate.toISOString()} (delay: ${(delay / 1000).toFixed(1)}s)`);
  return newJob;
}

export async function cancelEmailJob(emailId: string): Promise<boolean> {
  const jobId = `job_${emailId}`;
  const job = await emailQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}

export async function triggerJobNow(emailId: string): Promise<boolean> {
  const jobId = `job_${emailId}`;
  const job = await emailQueue.getJob(jobId);
  if (job) {
    await job.promote();
    return true;
  }
  return false;
}

export async function getQueueStats(config: QueueConfig): Promise<QueueStats> {
  if (!isRedisConnected()) {
    return {
      waiting: 0,
      delayed: 0,
      active: 0,
      completed: 0,
      failed: 0,
      paused: false,
      concurrency: config.concurrency,
      minDelayBetweenEmailsMs: config.minDelayBetweenEmailsMs,
      maxEmailsPerHour: config.maxEmailsPerHour,
      activeHourlyCount: 0,
      currentHourWindow: 'N/A (Redis offline)',
    };
  }

  const counts = await emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
  const isPaused = await emailQueue.isPaused();

  return {
    waiting: counts.waiting || 0,
    delayed: counts.delayed || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    paused: isPaused,
    concurrency: config.concurrency,
    minDelayBetweenEmailsMs: config.minDelayBetweenEmailsMs,
    maxEmailsPerHour: config.maxEmailsPerHour,
    activeHourlyCount: 0, // Computed from Redis
    currentHourWindow: new Date().toISOString().slice(0, 13),
  };
}

export async function getQueueJobsList(limit = 100): Promise<QueueJob[]> {
  if (!isRedisConnected()) return [];

  const rawJobs = await emailQueue.getJobs(
    ['delayed', 'waiting', 'active', 'completed', 'failed'],
    0,
    limit,
    true
  );

  const jobsWithStatus: QueueJob[] = [];
  for (const j of rawJobs) {
    const rawState = await j.getState();
    let status: QueueJob['status'] = 'waiting';
    if (rawState === 'delayed') status = 'delayed';
    else if (rawState === 'active') status = 'active';
    else if (rawState === 'completed') status = 'completed';
    else if (rawState === 'failed') status = 'failed';

    jobsWithStatus.push({
      id: j.id || '',
      emailId: j.data?.emailId || '',
      senderId: j.data?.senderId || '',
      recipient: j.data?.recipient || '',
      subject: j.data?.subject || '',
      scheduledAt: j.timestamp + (j.opts.delay || 0),
      delayMs: j.opts.delay || 0,
      status,
      attempts: j.attemptsMade,
      addedAt: j.timestamp,
      processedAt: j.processedOn,
      finishedAt: j.finishedOn,
      error: j.failedReason,
    });
  }

  return jobsWithStatus;
}
