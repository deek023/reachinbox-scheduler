import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Reschedule Email</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 block mb-1">Recipient</span>
            <span className="font-mono text-white font-semibold">{email.recipient}</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              New Execution Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledAtStr}
              onChange={(e) => setScheduledAtStr(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 5 * 60 * 1000)))}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
            >
              +5 mins
            </button>
            <button
              type="button"
              onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 60 * 60 * 1000)))}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
            >
              +1 hour
            </button>
            <button
              type="button"
              onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 24 * 60 * 60 * 1000)))}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
            >
              +24 hours
            </button>
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-white rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow"
            >
              {isSubmitting ? 'Updating...' : 'Update Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
