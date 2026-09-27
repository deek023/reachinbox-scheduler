export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isDefault?: boolean;
}

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  senderName?: string;
  senderEmail?: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  bullmqJobId?: string;
  messageId?: string;
  sentAt?: string;
  previewUrl?: string; // Ethereal email preview link
  error?: string;
  idempotencyKey: string;
  attempts?: number;
  rescheduledCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlackConnection {
  id: string;
  userId: string;
  teamName: string;
  channel: string;
  webhookUrl: string;
  connectedAt: string;
}

export interface QueueJob {
  id: string;
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  scheduledAt: number;
  delayMs: number;
  status: 'delayed' | 'waiting' | 'active' | 'completed' | 'failed';
  attempts: number;
  addedAt: number;
  processedAt?: number;
  finishedAt?: number;
  error?: string;
  previewUrl?: string;
}

export interface QueueStats {
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
  paused: boolean;
  concurrency: number;
  minDelayBetweenEmailsMs: number;
  maxEmailsPerHour: number;
  activeHourlyCount: number;
  currentHourWindow: string;
}

export interface QueueConfig {
  concurrency: number;
  minDelayBetweenEmailsMs: number;
  maxEmailsPerHour: number;
}

export interface ScheduleEmailPayload {
  recipient: string;
  subject: string;
  body: string;
  senderId?: string;
  scheduledAt: string;
  idempotencyKey?: string;
}

export interface BulkSchedulePayload {
  senderId: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsMs?: number;
  recipients: Array<{
    email: string;
    name?: string;
    company?: string;
    customFields?: Record<string, string>;
  }>;
}
