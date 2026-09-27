import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Calendar,
  Trash2,
  AlertCircle,
  Eye,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { EmailRecord } from '../types/email.ts';

interface ScheduledTableProps {
  emails: EmailRecord[];
  isLoading: boolean;
  onSendNow: (id: string) => void;
  onReschedule: (email: EmailRecord) => void;
  onCancel: (id: string) => void;
  onViewDetails: (email: EmailRecord) => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading,
  onSendNow,
  onReschedule,
  onCancel,
  onViewDetails,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [now, setNow] = useState(Date.now());

  // Update countdown clock every second
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
      return <span className="text-amber-400 font-medium animate-pulse">Ready for worker</span>;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return (
        <span className="font-mono text-indigo-300">
          in {hours}h {minutes}m {seconds}s
        </span>
      );
    }
    return (
      <span className="font-mono text-indigo-300">
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
      (e.senderName && e.senderName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Table Top Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Scheduled Queue</h3>
            <p className="text-xs text-slate-400">
              {emails.length} email{emails.length === 1 ? '' : 's'} waiting for BullMQ execution
            </p>
          </div>
        </div>

        {/* Filter input */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter scheduled..."
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
              <th className="px-4 py-3">Scheduled For</th>
              <th className="px-4 py-3">Countdown</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-400 mb-2" />
                  Loading scheduled emails...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto text-center space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                      <Clock className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">No scheduled emails found</p>
                    <p className="text-[11px] text-slate-500">
                      Click &quot;Compose&quot; above to schedule single or bulk leads.
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
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                      Key: {item.idempotencyKey.slice(0, 14)}...
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
                    <span className="text-slate-300">{item.senderName || 'Default'}</span>
                    <div className="text-[10px] text-slate-500">{item.senderEmail}</div>
                  </td>

                  {/* Scheduled For */}
                  <td className="px-4 py-3.5 text-slate-300 whitespace-nowrap">
                    <div>{new Date(item.scheduledAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(item.scheduledAt).toLocaleTimeString()}
                    </div>
                  </td>

                  {/* Countdown */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {formatCountdown(item.scheduledAt)}
                    {item.rescheduledCount ? (
                      <div className="text-[10px] text-amber-400">
                        Postponed {item.rescheduledCount}x (hourly cap)
                      </div>
                    ) : null}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {item.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping mr-1" />
                        Processing
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mr-1" />
                        Scheduled
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => onSendNow(item.id)}
                        title="Send immediately (bypass delay)"
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onReschedule(item)}
                        title="Reschedule to another time"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onViewDetails(item)}
                        title="View details"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onCancel(item.id)}
                        title="Cancel & remove schedule"
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
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
