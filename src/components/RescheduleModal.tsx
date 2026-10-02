import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface RescheduleModalProps {
  email: EmailRecord | null;
  onClose: () => void;
  onConfirm: (id: string, newScheduledAt: string) => Promise<void>;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  email,
  onClose,
  onConfirm,
}) => {
  if (!email) return null;

  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const initialDate = new Date(email.scheduledAt);
  const [scheduledAtStr, setScheduledAtStr] = useState<string>(toLocalIso(initialDate));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const iso = new Date(scheduledAtStr).toISOString();
      await onConfirm(email.id, iso);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Reschedule Email</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5 uppercase tracking-wider">Recipient</span>
            <span className="font-mono text-white font-medium">{email.recipient}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              New Execution Date and Time
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledAtStr}
              onChange={(e) => setScheduledAtStr(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex space-x-1.5">
            <button
              type="button"
              onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 5 * 60 * 1000)))}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] transition-colors"
            >
              +5 mins
            </button>
            <button
              type="button"
              onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 60 * 60 * 1000)))}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] transition-colors"
            >
              +1 hour
            </button>
            <button
              type="button"
              onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 24 * 60 * 60 * 1000)))}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] transition-colors"
            >
              +24 hours
            </button>
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded shadow-sm transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
