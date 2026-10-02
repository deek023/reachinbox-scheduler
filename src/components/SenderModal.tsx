import React, { useState } from 'react';
import { X, UserPlus, Star } from 'lucide-react';
import type { Sender } from '../types/email.ts';

interface SenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onAddSender: (data: { name: string; email: string; isDefault?: boolean }) => Promise<void>;
}

export const SenderModal: React.FC<SenderModalProps> = ({
  isOpen,
  onClose,
  senders,
  onAddSender,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    setIsSubmitting(true);
    try {
      await onAddSender({ name, email, isDefault });
      setName('');
      setEmail('');
      setIsDefault(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center">
              <UserPlus className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Sender Identities
              </h3>
              <p className="text-[11px] text-slate-400">Multiple senders with independent rate limits</p>
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

        <div className="p-5 space-y-4 text-xs">
          {/* Senders List */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Active Senders</label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {senders.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-medium text-white">{s.name}</span>
                      {s.isDefault && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-blue-400 border border-slate-700">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-blue-400" /> Default
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{s.email}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
                    Verified
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Sender Form */}
          <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-800 space-y-2.5">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Add New Sender</h4>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sales Outreach"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="outreach@company.com"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-slate-800 text-blue-600 focus:ring-0"
              />
              <label htmlFor="isDefault" className="text-xs text-slate-300">
                Set as default sender identity
              </label>
            </div>
            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded shadow-sm transition-colors"
              >
                {isSubmitting ? 'Registering...' : 'Register Sender'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
