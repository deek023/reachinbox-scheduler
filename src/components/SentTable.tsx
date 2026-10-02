import React, { useState } from 'react';
import {
  ExternalLink,
  Eye,
  MailCheck,
  Search,
  Send,
} from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface SentTableProps {
  emails: EmailRecord[];
  isLoading: boolean;
  onViewDetails: (email: EmailRecord) => void;
  onOpenCompose?: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  isLoading,
  onViewDetails,
  onOpenCompose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = emails.filter((e) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      e.recipient.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      (e.senderName && e.senderName.toLowerCase().includes(q)) ||
      (e.senderEmail && e.senderEmail.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      {/* Table Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950">
        <div>
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            Sent History
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {emails.length} delivered email{emails.length === 1 ? '' : 's'} via Ethereal SMTP
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter sent emails..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="px-4 py-2.5">Recipient</th>
              <th className="px-4 py-2.5">Subject</th>
              <th className="px-4 py-2.5">Sender Identity</th>
              <th className="px-4 py-2.5">Sent Timestamp</th>
              <th className="px-4 py-2.5">Preview</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              // Realistic Skeleton Loader Rows (Rule 20)
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-3.5 bg-slate-800 rounded w-32 mb-1" />
                    <div className="h-2.5 bg-slate-800/60 rounded w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 bg-slate-800 rounded w-48 mb-1" />
                    <div className="h-2.5 bg-slate-800/60 rounded w-36" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 bg-slate-800 rounded w-24 mb-1" />
                    <div className="h-2.5 bg-slate-800/60 rounded w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 bg-slate-800 rounded w-20 mb-1" />
                    <div className="h-2.5 bg-slate-800/60 rounded w-16" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 bg-slate-800 rounded w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-slate-800 rounded w-16" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="h-6 bg-slate-800 rounded w-8 ml-auto" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              /* Clean Empty State */
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-2.5">
                    <div className="h-10 w-10 rounded-md bg-slate-800 flex items-center justify-center text-slate-400">
                      <MailCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        {filterQuery ? 'No matching sent emails' : 'No sent emails yet'}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                        {filterQuery
                          ? 'Clear your search query to see all dispatched emails.'
                          : 'Emails dispatched by the BullMQ worker will appear here with Ethereal preview links.'}
                      </p>
                    </div>
                    {filterQuery ? (
                      <button
                        type="button"
                        onClick={() => setFilterQuery('')}
                        className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        Clear Filter
                      </button>
                    ) : onOpenCompose ? (
                      <button
                        type="button"
                        onClick={onOpenCompose}
                        className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Compose Email</span>
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Recipient */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-white text-xs">{item.recipient}</span>
                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                      {item.messageId || 'MsgID: pending'}
                    </div>
                  </td>

                  {/* Subject */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onViewDetails(item)}
                      className="text-left font-medium text-slate-200 hover:text-blue-400 transition-colors line-clamp-1 max-w-xs"
                    >
                      {item.subject}
                    </button>
                    <div className="text-[10px] text-slate-500 line-clamp-1 max-w-xs">
                      {item.body.slice(0, 55)}...
                    </div>
                  </td>

                  {/* Sender */}
                  <td className="px-4 py-3 text-slate-400">
                    <span className="text-slate-200 block">{item.senderName || 'Sender'}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.senderEmail}</span>
                  </td>

                  {/* Sent Timestamp */}
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    <div>{item.sentAt ? new Date(item.sentAt).toLocaleDateString() : 'N/A'}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {item.sentAt ? new Date(item.sentAt).toLocaleTimeString() : ''}
                    </div>
                  </td>

                  {/* Ethereal Preview */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.previewUrl ? (
                      <a
                        href={item.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 font-medium text-xs transition-colors"
                      >
                        <span>Preview</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Generating</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center text-emerald-400 text-[11px] font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5" />
                      Delivered
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onViewDetails(item)}
                      title="View details"
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
