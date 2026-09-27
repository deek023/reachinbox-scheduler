import React, { useState } from 'react';
import {
  CheckCircle,
  ExternalLink,
  Eye,
  Mail,
  Search,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface SentTableProps {
  emails: EmailRecord[];
  isLoading: boolean;
  onViewDetails: (email: EmailRecord) => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  isLoading,
  onViewDetails,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = emails.filter((e) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      e.recipient.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      (e.senderName && e.senderName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Sent Emails</h3>
            <p className="text-xs text-slate-400">
              {emails.length} delivered email{emails.length === 1 ? '' : 's'} via Ethereal SMTP
            </p>
          </div>
        </div>

        {/* Filter input */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter sent emails..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-semibold">
            <tr>
              <th className="px-5 py-3">Recipient</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Sender Identity</th>
              <th className="px-4 py-3">Sent Timestamp</th>
              <th className="px-4 py-3">Ethereal Preview</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-400 mb-2" />
                  Loading sent history...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto text-center space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                      <Mail className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">No sent emails yet</p>
                    <p className="text-[11px] text-slate-500">
                      Scheduled jobs will automatically appear here once dispatched.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition group">
                  {/* Recipient */}
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-white font-mono">{item.recipient}</span>
                    <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                      MsgID: {item.messageId || 'N/A'}
                    </div>
                  </td>

                  {/* Subject */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => onViewDetails(item)}
                      className="text-left font-medium text-slate-200 hover:text-indigo-300 transition line-clamp-1 max-w-xs"
                    >
                      {item.subject}
                    </button>
                    <div className="text-[10px] text-slate-500 line-clamp-1 max-w-xs">
                      {item.body.slice(0, 60)}...
                    </div>
                  </td>

                  {/* Sender */}
                  <td className="px-4 py-3.5 text-slate-400">
                    <span className="text-slate-300">{item.senderName || 'Sender'}</span>
                    <div className="text-[10px] text-slate-500">{item.senderEmail}</div>
                  </td>

                  {/* Sent Timestamp */}
                  <td className="px-4 py-3.5 text-slate-300 whitespace-nowrap">
                    <div>{item.sentAt ? new Date(item.sentAt).toLocaleDateString() : '—'}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.sentAt ? new Date(item.sentAt).toLocaleTimeString() : ''}
                    </div>
                  </td>

                  {/* Ethereal Preview Button */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {item.previewUrl ? (
                      <a
                        href={item.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition shadow-sm"
                      >
                        <span>View on Ethereal</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">Preview pending</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1" />
                      Delivered
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => onViewDetails(item)}
                      title="View full email details"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
