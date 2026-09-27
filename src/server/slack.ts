import { getSlackConnection, saveSlackConnection, removeSlackConnection } from './db.ts';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const SLACK_REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI ||
  (process.env.APP_URL ? `${process.env.APP_URL}/api/slack/callback` : 'http://localhost:3000/api/slack/callback');

export interface SlackAlertParams {
  userId: string;
  senderEmail: string;
  senderName: string;
  hourlyLimit: number;
  postponedCount: number;
  nextAvailableHour: string;
}

export function isSlackOAuthConfigured(): boolean {
  return Boolean(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}

export function getSlackOAuthUrl(): string {
  if (!isSlackOAuthConfigured()) {
    throw new Error('Slack OAuth is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env.');
  }

  const scopes = encodeURIComponent('incoming-webhook,chat:write');
  return `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(
    SLACK_REDIRECT_URI
  )}`;
}

export async function exchangeSlackCodeForToken(code: string, userId: string) {
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    client_secret: SLACK_CLIENT_SECRET,
    code,
    redirect_uri: SLACK_REDIRECT_URI,
  });

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Failed to exchange Slack OAuth code for token');
  }

  const webhookUrl = data.incoming_webhook?.url;
  const channel = data.incoming_webhook?.channel;
  const channelId = data.incoming_webhook?.channel_id;
  const teamName = data.team?.name;
  const teamId = data.team?.id;
  const accessToken = data.access_token;

  return saveSlackConnection({
    userId,
    teamName,
    teamId,
    channel,
    channelId,
    webhookUrl,
    accessToken,
  });
}

class SlackService {
  async notifyRateLimitReached(params: SlackAlertParams): Promise<boolean> {
    const conn = await getSlackConnection(params.userId);
    if (!conn) {
      console.log(`[Slack] No Slack connection for user ${params.userId}, skipping alert.`);
      return false;
    }

    const payload = {
      text: `🚨 ReachInbox Rate Limit Reached for sender *${params.senderName}* (<${params.senderEmail}>)`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Sending Rate Limit Hit',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Sender *${params.senderName}* (${params.senderEmail}) has reached the hourly limit of *${params.hourlyLimit} emails/hr*.\n\n*Action Taken:* ${params.postponedCount} email(s) have been postponed and rescheduled into the next window: *${params.nextAvailableHour}*.`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Scheduler • BullMQ Delayed Queue • Channel: ${conn.channel || 'Slack'}`,
            },
          ],
        },
      ],
    };

    if (conn.webhookUrl) {
      try {
        const res = await fetch(conn.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error(`[Slack] Webhook returned error (${res.status}):`, txt);
          return false;
        }
        console.log(`[Slack] Successfully posted rate-limit alert to webhook for ${conn.teamName}`);
        return true;
      } catch (err: unknown) {
        console.error('[Slack] Failed to post webhook alert:', err instanceof Error ? err.message : String(err));
        return false;
      }
    }

    return false;
  }

  async sendTestMessage(userId: string): Promise<{ success: boolean; message: string }> {
    const conn = await getSlackConnection(userId);
    if (!conn) {
      return {
        success: false,
        message: 'No Slack account connected. Please connect Slack first via OAuth or Webhook.',
      };
    }

    if (!conn.webhookUrl) {
      return {
        success: false,
        message: 'No incoming webhook URL available for the connected Slack workspace.',
      };
    }

    try {
      const payload = {
        text: '👋 *ReachInbox Scheduler Test Alert*\nYour Slack connection is active! You will receive instant notifications here whenever a sender reaches their hourly rate-limit cap.',
      };

      const res = await fetch(conn.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        return {
          success: false,
          message: `Slack API error (${res.status}): ${body}`,
        };
      }

      return {
        success: true,
        message: `Test notification sent successfully to ${conn.channel || 'Slack'} (${conn.teamName || 'Workspace'})!`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to deliver Slack message: ${errorMsg}`,
      };
    }
  }
}

export const slackService = new SlackService();
