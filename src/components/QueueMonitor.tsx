import React, { useState, useMemo } from 'react';
import {
  Layers,
  Pause,
  Play,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Search,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
} from 'lucide-react';
import type { QueueStats, QueueJob } from '../types/email.ts';

interface QueueMonitorProps {
  stats: QueueStats | null;
  jobs: QueueJob[];
  isLoading: boolean;
  onRefresh: () => void;
  onTogglePause: () => Promise<void>;
  onRetryJob: (jobId: string) => Promise<void>;
}

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  stats,
  jobs,
  isLoading,
  onRefresh,
  onTogglePause,
  onRetryJob,
}) => {
  const [activeJobFilter, setActiveJobFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
  const [showArchInfo, setShowArchInfo] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchesFilter =
        activeJobFilter === 'all' || j.status === activeJobFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        j.id.toLowerCase().includes(q) ||
        (j.emailId && j.emailId.toLowerCase().includes(q)) ||
        (j.recipient && j.recipient.toLowerCase().includes(q)) ||
        (j.subject && j.subject.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [jobs, activeJobFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage]);

  const activeWorkerSlots = stats?.active ?? 0;
  const totalConcurrency = stats?.concurrency ?? 5;
  const activeWorkerPercentage = Math.min(
    100,
    Math.round((activeWorkerSlots / Math.max(1, totalConcurrency)) * 100)
  );

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3.5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
              Queue and Worker Observability
            </h2>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              BullMQ | Redis
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Delayed job queue, worker concurrency, and sliding rate-limit state
          </p>
        </div>

        {/* Action Button Group */}
        <div className="flex items-center space-x-2">
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors"
          >
            <span>Open Bull Board</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          <button
            type="button"
            onClick={onTogglePause}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              stats?.paused
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
            }`}
          >
            {stats?.paused ? (
              <>
                <Play className="h-3 w-3" />
                <span>Resume Queue</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                <span>Pause Queue</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            title="Refresh queue status"
            className="p-1.5 rounded-md text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Redis Persistence Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
        <div className="flex items-center space-x-2 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-medium text-slate-200">Redis persistence active</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[11px]">
            Delayed jobs reside in Redis sorted sets and survive server restarts automatically
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowArchInfo(!showArchInfo)}
          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
        >
          <Info className="h-3 w-3" />
          <span>{showArchInfo ? 'Hide Architecture' : 'View Architecture'}</span>
        </button>
      </div>

      {showArchInfo && (
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1.5">
          <p className="font-semibold text-white text-[11px] uppercase tracking-wider">
            Queue Storage and Idempotency Architecture
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Every recipient is scheduled with an individual BullMQ delayed job scored by execution timestamp.
            When workers pick up jobs, concurrency-safe atomic updates (UPDATE emails SET status = &apos;PROCESSING&apos; WHERE id = $1 AND status = &apos;SCHEDULED&apos;)
            prevent duplicate dispatches even with multiple concurrent workers. Rate limits are evaluated atomically via Redis Lua scripts.
          </p>
        </div>
      )}

      {/* 3. Connected 5-Metric State Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 border border-slate-800 rounded-lg bg-slate-900 overflow-hidden shadow-sm">
        {/* Delayed */}
        <div
          onClick={() => {
            setActiveJobFilter('delayed');
            setCurrentPage(1);
          }}
          className={`p-3 cursor-pointer transition-colors ${
            activeJobFilter === 'delayed'
              ? 'bg-slate-800/80 ring-1 ring-inset ring-slate-700'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            <span>Delayed</span>
            <Clock className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-white tabular-nums">
            {stats?.delayed ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Holding in Redis</p>
        </div>

        {/* Waiting */}
        <div
          onClick={() => {
            setActiveJobFilter('waiting');
            setCurrentPage(1);
          }}
          className={`p-3 cursor-pointer transition-colors ${
            activeJobFilter === 'waiting'
              ? 'bg-slate-800/80 ring-1 ring-inset ring-slate-700'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            <span>Waiting</span>
            <Layers className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-white tabular-nums">
            {stats?.waiting ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Ready for pickup</p>
        </div>

        {/* Active Workers */}
        <div
          onClick={() => {
            setActiveJobFilter('active');
            setCurrentPage(1);
          }}
          className={`p-3 cursor-pointer transition-colors ${
            activeJobFilter === 'active'
              ? 'bg-slate-800/80 ring-1 ring-inset ring-slate-700'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-blue-400 uppercase tracking-wider">
            <span>Active Workers</span>
            <Zap className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="mt-1.5 flex items-baseline space-x-1">
            <span className="text-xl font-bold font-mono text-white tabular-nums">
              {activeWorkerSlots}
            </span>
            <span className="text-xs font-mono text-slate-500">
              / {totalConcurrency} slots
            </span>
          </div>
          <div className="mt-1.5 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-200"
              style={{ width: `${activeWorkerPercentage}%` }}
            />
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => {
            setActiveJobFilter('completed');
            setCurrentPage(1);
          }}
          className={`p-3 cursor-pointer transition-colors ${
            activeJobFilter === 'completed'
              ? 'bg-slate-800/80 ring-1 ring-inset ring-slate-700'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
            <span>Completed</span>
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-white tabular-nums">
            {stats?.completed ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Delivered via SMTP</p>
        </div>

        {/* Failed */}
        <div
          onClick={() => {
            setActiveJobFilter('failed');
            setCurrentPage(1);
          }}
          className={`p-3 cursor-pointer transition-colors ${
            activeJobFilter === 'failed'
              ? 'bg-slate-800/80 ring-1 ring-inset ring-slate-700'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-rose-400 uppercase tracking-wider">
            <span>Failed</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-white tabular-nums">
            {stats?.failed ?? 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Requires retry</p>
        </div>
      </div>

      {/* 4. Job Registry Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="p-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'delayed', label: 'Delayed' },
              { id: 'waiting', label: 'Waiting' },
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Completed' },
              { id: 'failed', label: 'Failed' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveJobFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeJobFilter === tab.id
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Job ID, recipient..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="px-4 py-2.5">Job ID</th>
                <th className="px-4 py-2.5">Email ID</th>
                <th className="px-4 py-2.5">Recipient</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Execution Time</th>
                <th className="px-4 py-2.5">Attempts</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                // Realistic Skeleton Loader Rows (Rule 20)
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3.5 bg-slate-800 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-slate-800 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-slate-800 rounded w-36" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-slate-800 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-slate-800 rounded w-8" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-6 bg-slate-800 rounded w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-2">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                        {searchQuery
                          ? 'No matching jobs found'
                          : `No ${activeJobFilter !== 'all' ? activeJobFilter : ''} jobs in queue`}
                      </h4>
                      <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
                        {searchQuery
                          ? 'Clear your search query to view all available queue jobs.'
                          : 'As emails are scheduled, their respective BullMQ jobs will be registered and tracked in real time here.'}
                      </p>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium pt-1 transition-colors"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-blue-400 text-xs">
                      {j.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                      {j.emailId || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-mono text-white text-xs">
                      {j.recipient || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {j.status === 'completed' && (
                        <span className="inline-flex items-center text-emerald-400 text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5" />
                          Completed
                        </span>
                      )}
                      {j.status === 'active' && (
                        <span className="inline-flex items-center text-blue-400 text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mr-1.5" />
                          Active
                        </span>
                      )}
                      {j.status === 'delayed' && (
                        <span className="inline-flex items-center text-slate-300 text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5" />
                          Delayed
                        </span>
                      )}
                      {j.status === 'waiting' && (
                        <span className="inline-flex items-center text-amber-400 text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5" />
                          Waiting
                        </span>
                      )}
                      {j.status === 'failed' && (
                        <span className="inline-flex items-center text-rose-400 text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mr-1.5" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono tabular-nums text-xs">
                      {new Date(j.scheduledAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono tabular-nums">
                      {j.attempts}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedJob(j)}
                          title="Inspect Job Metadata"
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {j.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => onRetryJob(j.id)}
                            title="Retry failed job"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-rose-950/40 hover:bg-rose-950/60 text-rose-400 border border-rose-800 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredJobs.length > pageSize && (
          <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredJobs.length)} of{' '}
              {filteredJobs.length} jobs
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Job Metadata Inspector Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Job Inspector
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedJob.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-2.5 bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Status</span>
                  <span className="text-white font-medium capitalize">{selectedJob.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Attempts Made</span>
                  <span className="text-white font-medium">{selectedJob.attempts}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Scheduled At</span>
                  <span className="text-slate-300">{new Date(selectedJob.scheduledAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Recipient</span>
                  <span className="text-slate-200 truncate block">{selectedJob.recipient || 'N/A'}</span>
                </div>
              </div>

              {selectedJob.error && (
                <div className="p-3 rounded bg-rose-950/30 border border-rose-800/60 text-rose-300 space-y-1">
                  <div className="font-semibold text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Failure Reason</span>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap">{selectedJob.error}</pre>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-slate-400 text-[11px] block font-medium uppercase tracking-wider">Job Payload</span>
                <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-44">
                  {JSON.stringify(
                    {
                      id: selectedJob.id,
                      emailId: selectedJob.emailId,
                      recipient: selectedJob.recipient,
                      subject: selectedJob.subject,
                      addedAt: new Date(selectedJob.addedAt).toISOString(),
                      processedAt: selectedJob.processedAt ? new Date(selectedJob.processedAt).toISOString() : null,
                      finishedAt: selectedJob.finishedAt ? new Date(selectedJob.finishedAt).toISOString() : null,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
