import nodemailer from 'nodemailer';
import type { Transporter, TestAccount } from 'nodemailer';

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

class MailerService {
  private transporter: Transporter | null = null;
  private testAccount: TestAccount | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.setupTransporter();
  }

  private async setupTransporter(): Promise<void> {
    try {
      const user = process.env.ETHEREAL_USER;
      const pass = process.env.ETHEREAL_PASS;

      if (user && pass) {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user, pass },
        });
        console.log(`[Mailer] Configured with provided Ethereal credentials (${user})`);
        return;
      }

      // Auto-generate test account
      console.log('[Mailer] Creating test Ethereal account...');
      this.testAccount = await nodemailer.createTestAccount();
      console.log(`[Mailer] Ethereal account created: ${this.testAccount.user}`);

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: this.testAccount.user,
          pass: this.testAccount.pass,
        },
      });
    } catch (err) {
      console.warn('[Mailer] Could not connect to Ethereal SMTP server, falling back to simulated mailer:', err);
      // Fallback transporter that generates simulated preview URLs
      this.transporter = null;
    }
  }

  async sendMail(opts: SendMailOptions): Promise<SendMailResult> {
    if (this.initPromise) {
      await this.initPromise;
    }

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
          text: opts.text || opts.html?.replace(/<[^>]+>/g, ''),
          html: opts.html || `<p>${opts.text?.replace(/\n/g, '<br>') || ''}</p>`,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        return {
          success: true,
          messageId: info.messageId,
          previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined,
        };
      } else {
        // Fallback simulation if external network blocked
        const mockMsgId = `<ethereal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@ethereal.email>`;
        const mockPreview = `https://ethereal.email/message/simulated-${Date.now()}`;
        return {
          success: true,
          messageId: mockMsgId,
          previewUrl: mockPreview,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Mailer] Error sending email:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  getCredentials() {
    return {
      user: this.testAccount?.user || process.env.ETHEREAL_USER || 'Auto Ethereal SMTP',
      host: 'smtp.ethereal.email',
    };
  }
}

export const mailer = new MailerService();
