import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Calendar,
  Trash2,
  Eye,
  Search,
  Send,
  CalendarClock,
} from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface ScheduledTableProps {
  emails: EmailRecord[];
  isLoading: boolean;
  onSendNow: (id: string) => void;
  onReschedule: (email: EmailRecord) => void;
  onCancel: (id: string) => void;
  onViewDetails: (email: EmailRecord) => void;
  onOpenCompose?: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading,
  onSendNow,
  onReschedule,
  onCancel,
  onViewDetails,
  onOpenCompose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (scheduledAtIso: string) => {
    const target = new Date(scheduledAtIso).getTime();
    const diff = target - now;

    if (diff <= 0) {
      return (
        <span className="text-amber-400 font-medium inline-flex items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5" />
          Ready for worker
        </span>
      );
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return (
        <span className="font-mono tabular-nums text-slate-300">
          in {hours}h {minutes}m {seconds}s
        </span>
      );
    }
    return (
      <span className="font-mono tabular-nums text-slate-300">
        in {minutes}m {seconds}s
      </span>
    );
  };

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
      {/* Table Header / Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950">
        <div>
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
            Scheduled Queue
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {emails.length} email{emails.length === 1 ? '' : 's'} queued for BullMQ delayed execution
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by recipient or subject..."
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
              <th className="px-4 py-2.5">Scheduled For</th>
              <th className="px-4 py-2.5">Countdown</th>
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
                    <div className="h-3.5 bg-slate-800 rounded w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-slate-800 rounded w-16" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="h-6 bg-slate-800 rounded w-16 ml-auto" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              /* Clean Empty State */
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-2.5">
                    <div className="h-10 w-10 rounded-md bg-slate-800 flex items-center justify-center text-slate-400">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        {filterQuery ? 'No matching scheduled emails' : 'No scheduled emails found'}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                        {filterQuery
                          ? 'Clear your filter search query to view all queued jobs.'
                          : 'Queue single emails or upload a lead CSV to schedule future automated deliveries.'}
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
                        <span>Schedule Email</span>
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
                      {item.idempotencyKey.slice(0, 16)}...
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

                  {/* Sender Identity */}
                  <td className="px-4 py-3 text-slate-400">
                    <span className="text-slate-200 block">{item.senderName || 'Default'}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.senderEmail}</span>
                  </td>

                  {/* Scheduled For */}
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    <div>{new Date(item.scheduledAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.scheduledAt).toLocaleTimeString()}
                    </div>
                  </td>

                  {/* Countdown */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatCountdown(item.scheduledAt)}
                    {item.rescheduledCount ? (
                      <div className="text-[10px] text-amber-400">
                        Postponed {item.rescheduledCount}x
                      </div>
                    ) : null}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center text-amber-400 font-medium text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5" />
                        Processing
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-slate-300 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mr-1.5" />
                        Scheduled
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        type="button"
                        onClick={() => onSendNow(item.id)}
                        title="Send immediately (bypass delay)"
                        className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReschedule(item)}
                        title="Reschedule"
                        className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewDetails(item)}
                        title="View details"
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancel(item.id)}
                        title="Cancel schedule"
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
