import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Pause,
  Play,
  RotateCcw,
  CheckCircle,
  Clock,
  Zap,
  Terminal,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server,
  AlertTriangle,
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

  const filteredJobs = jobs.filter((j) => {
    if (activeJobFilter === 'all') return true;
    return j.status === activeJobFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Bull Board Live Monitoring Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">BullMQ Queue & Worker Monitor</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-md font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Real BullMQ + ioredis Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Delayed queue persistence in Redis with atomic rate-limiting and worker concurrency
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bull Board External Link */}
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
            >
              <span>Open Bull Board Dashboard</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={onTogglePause}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                stats?.paused
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {stats?.paused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Resume Queue</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause Queue</span>
                </>
              )}
            </button>

            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Refresh queue status"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Persistence & Restart Architecture Notice */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300 flex items-start space-x-3">
          <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-white">
              Redis-Backed Restart Resilience (Requirement 1 & 8)
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              BullMQ maintains all delayed jobs and state in Redis sorted sets. When the backend server or worker is stopped and restarted, jobs are not lost or re-created from scratch; the worker connects back to Redis and automatically resumes delayed jobs at their scheduled execution time.
            </p>
          </div>
        </div>
      </div>

      {/* 5 Queue State Metric Cards from BullMQ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Delayed */}
        <div
          onClick={() => setActiveJobFilter('delayed')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            activeJobFilter === 'delayed'
              ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-indigo-400">
            <span className="font-semibold">Delayed</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats?.delayed ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Holding for scheduledAt in Redis</p>
        </div>

        {/* Waiting */}
        <div
          onClick={() => setActiveJobFilter('waiting')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            activeJobFilter === 'waiting'
              ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400">
            <span className="font-semibold">Waiting</span>
            <Layers className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats?.waiting ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Ready for BullMQ worker</p>
        </div>

        {/* Active */}
        <div
          onClick={() => setActiveJobFilter('active')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            activeJobFilter === 'active'
              ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-blue-400">
            <span className="font-semibold">Active Workers</span>
            <Zap className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {stats?.active ?? 0}
            <span className="text-xs text-slate-500 font-normal"> / {stats?.concurrency ?? 5} slots</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Concurrent worker fibers</p>
        </div>

        {/* Completed */}
        <div
          onClick={() => setActiveJobFilter('completed')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            activeJobFilter === 'completed'
              ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold">Completed</span>
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats?.completed ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Sent via SMTP</p>
        </div>

        {/* Failed */}
        <div
          onClick={() => setActiveJobFilter('failed')}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            activeJobFilter === 'failed'
              ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span className="font-semibold">Failed</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{stats?.failed ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Requires retry</p>
        </div>
      </div>

      {/* Live BullMQ Jobs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">BullMQ Job Registry</h3>
            <span className="text-xs text-slate-400 font-mono">({filteredJobs.length} jobs)</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 text-xs">
            {['all', 'delayed', 'waiting', 'active', 'completed', 'failed'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveJobFilter(filter)}
                className={`px-2.5 py-1 rounded-md capitalize transition ${
                  activeJobFilter === filter
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-semibold">
              <tr>
                <th className="px-5 py-3">Job ID</th>
                <th className="px-4 py-3">Email ID</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Execution Time</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    No jobs currently match &quot;{activeJobFilter}&quot; filter in BullMQ.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3 font-mono text-indigo-300">{j.id}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{j.emailId || '—'}</td>
                    <td className="px-4 py-3 font-mono text-white">{j.recipient || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          j.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : j.status === 'delayed'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                            : j.status === 'active'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : j.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(j.scheduledAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{j.attempts}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {j.status === 'failed' ? (
                        <button
                          onClick={() => onRetryJob(j.id)}
                          className="px-2 py-1 text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded"
                        >
                          Retry Job
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
