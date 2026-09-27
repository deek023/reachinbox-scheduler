import React from 'react';
import { X, Mail, Clock, ExternalLink, ShieldCheck, Tag, AlertCircle } from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface EmailDetailModalProps {
  email: EmailRecord | null;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ email, onClose }) => {
  if (!email) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Email Inspection</h3>
              <p className="text-[11px] text-slate-400 font-mono">ID: {email.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
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
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${
                  email.status === 'SENT'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : email.status === 'SCHEDULED'
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                }`}
              >
                {email.status}
              </span>
            </div>
          </div>

          {/* Idempotency & BullMQ info */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 font-mono text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span className="text-slate-500">BullMQ Job ID:</span>
              <span className="text-indigo-400">{email.bullmqJobId || 'Pending'}</span>
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
            <label className="text-[11px] font-semibold text-slate-300 block">Subject</label>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white font-medium">
              {email.subject}
            </div>

            <label className="text-[11px] font-semibold text-slate-300 block pt-1">Rendered Body</label>
            <div className="p-3.5 rounded-lg bg-slate-800/60 border border-slate-700/80 text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {email.body}
            </div>
          </div>

          {/* Ethereal preview link if sent */}
          {email.previewUrl && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-300">
                <ExternalLink className="h-4 w-4" />
                <span>View rendered email in Ethereal web interface</span>
              </div>
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
              >
                Open Preview ↗
              </a>
            </div>
          )}

          {email.error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center space-x-2 text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Error: {email.error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
