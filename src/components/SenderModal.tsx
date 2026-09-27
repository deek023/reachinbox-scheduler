import React, { useState } from 'react';
import { X, UserPlus, Check, Star } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Sender Identities</h3>
              <p className="text-xs text-slate-400">Multiple senders with independent rate limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Senders List */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Active Senders</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {senders.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-white">{s.name}</span>
                      {s.isDefault && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          <Star className="h-2.5 w-2.5 mr-0.5 fill-indigo-300" /> Default
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{s.email}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Verified
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Sender Form */}
          <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-white">Add New Sender</h4>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rachel Green (Sales Lead)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rachel@reachinbox.ai"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="isDefaultSender"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isDefaultSender" className="text-xs text-slate-300 cursor-pointer">
                Set as default sender
              </label>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                Done
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow transition"
              >
                {isSubmitting ? 'Adding...' : 'Add Sender'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
