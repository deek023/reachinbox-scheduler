import React from 'react';
import { X, Mail, ExternalLink, AlertCircle } from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface EmailDetailModalProps {
  email: EmailRecord | null;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ email, onClose }) => {
  if (!email) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Email Inspection</h3>
              <p className="text-[11px] text-slate-400 font-mono">ID: {email.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2.5 bg-slate-950 p-3 rounded border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Recipient</span>
              <span className="font-mono text-white font-medium">{email.recipient}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Sender</span>
              <span className="text-slate-200">
                {email.senderName} ({email.senderEmail})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Scheduled Time</span>
              <span className="text-slate-300">
                {new Date(email.scheduledAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Delivery Status</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium mt-0.5 ${
                  email.status === 'SENT'
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
                    : email.status === 'SCHEDULED'
                    ? 'bg-blue-950/40 text-blue-400 border border-blue-800/60'
                    : 'bg-amber-950/40 text-amber-400 border border-amber-800/60'
                }`}
              >
                {email.status}
              </span>
            </div>
          </div>

          {/* Idempotency & BullMQ info */}
          <div className="space-y-1 p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span className="text-slate-500">BullMQ Job ID:</span>
              <span className="text-blue-400">{email.bullmqJobId || 'Pending'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Idempotency Key:</span>
              <span className="text-slate-300 truncate max-w-[260px]">{email.idempotencyKey}</span>
            </div>
            {email.messageId && (
              <div className="flex justify-between">
                <span className="text-slate-500">SMTP Message ID:</span>
                <span className="text-emerald-400 truncate max-w-[260px]">{email.messageId}</span>
              </div>
            )}
          </div>

          {/* Subject & Body */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-300 block uppercase tracking-wider">Subject</label>
            <div className="p-2 rounded bg-slate-950 border border-slate-800 text-white font-medium">
              {email.subject}
            </div>

            <label className="text-[11px] font-semibold text-slate-300 block uppercase tracking-wider pt-1">Rendered Body</label>
            <div className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {email.body}
            </div>
          </div>

          {email.error && (
            <div className="p-2.5 rounded bg-rose-950/30 border border-rose-800/60 text-rose-300 space-y-1">
              <div className="font-semibold flex items-center space-x-1.5 text-[11px] uppercase tracking-wider">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Error Details</span>
              </div>
              <p className="font-mono text-[11px]">{email.error}</p>
            </div>
          )}

          {email.previewUrl && (
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-[11px]">Ethereal SMTP Delivery</p>
                <p className="text-[10px] text-slate-400">Captured in test mailbox with full HTML headers</p>
              </div>
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                <span>Open Preview</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <div className="pt-2 flex justify-end border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
