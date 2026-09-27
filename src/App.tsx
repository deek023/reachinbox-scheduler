/**
 * ReachInbox Scheduler - Production Full-Stack Application
 * Real BullMQ + ioredis Delayed Queue, Redis Atomic Rate-Limiting, PostgreSQL Database, Ethereal SMTP
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Send,
  Activity,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Bell,
  Sparkles,
  Sliders,
  ShieldCheck,
  Server,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { ScheduledTable } from './components/ScheduledTable.tsx';
import { SentTable } from './components/SentTable.tsx';
import { QueueMonitor } from './components/QueueMonitor.tsx';
import { SearchTab } from './components/SearchTab.tsx';
import { ComposeModal } from './components/ComposeModal.tsx';
import { SlackModal } from './components/SlackModal.tsx';
import { SenderModal } from './components/SenderModal.tsx';
import { EmailDetailModal } from './components/EmailDetailModal.tsx';
import { RescheduleModal } from './components/RescheduleModal.tsx';
import { GoogleAuthModal } from './components/GoogleAuthModal.tsx';
import * as api from './services/api.ts';
import type {
  User,
  Sender,
  EmailRecord,
  QueueStats,
  QueueJob,
  SlackConnection,
} from './types/email.ts';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queue' | 'search'>('scheduled');

  // Core Data State
  const [user, setUser] = useState<User | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [slackConnection, setSlackConnection] = useState<SlackConnection | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [redisConnected, setRedisConnected] = useState<boolean>(false);

  // Loading States
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isSendersOpen, setIsSendersOpen] = useState(false);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState(false);
  const [selectedDetailEmail, setSelectedDetailEmail] = useState<EmailRecord | null>(null);
  const [selectedRescheduleEmail, setSelectedRescheduleEmail] = useState<EmailRecord | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check URL parameters for OAuth callbacks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      showToast('Successfully authenticated via Google OAuth!');
      window.history.replaceState({}, '', '/');
    } else if (params.get('auth') === 'error') {
      showToast(`Google OAuth error: ${params.get('message') || 'Authentication failed'}`);
      window.history.replaceState({}, '', '/');
    } else if (params.get('slack') === 'connected') {
      showToast('Slack connected successfully!');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Initial Load
  const loadInitialData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [healthRes, userRes, sendersRes, scheduledRes, sentRes, statsRes, jobsRes, slackRes] =
        await Promise.allSettled([
          api.fetchHealth(),
          api.fetchCurrentUser(),
          api.fetchSenders(),
          api.fetchScheduledEmails(),
          api.fetchSentEmails(),
          api.fetchQueueStats(),
          api.fetchQueueJobs(),
          api.fetchSlackStatus(),
        ]);

      if (healthRes.status === 'fulfilled') {
        setDbConnected(healthRes.value.services?.database?.connected ?? false);
        setRedisConnected(healthRes.value.services?.redis?.connected ?? false);
      }
      if (userRes.status === 'fulfilled' && userRes.value.user) {
        setUser(userRes.value.user);
      }
      if (sendersRes.status === 'fulfilled') {
        setSenders(sendersRes.value.senders || []);
      }
      if (scheduledRes.status === 'fulfilled') {
        setScheduledEmails(scheduledRes.value.emails || []);
      }
      if (sentRes.status === 'fulfilled') {
        setSentEmails(sentRes.value.emails || []);
      }
      if (statsRes.status === 'fulfilled') {
        setQueueStats(statsRes.value.queue || null);
      }
      if (jobsRes.status === 'fulfilled') {
        setQueueJobs(jobsRes.value.jobs || []);
      }
      if (slackRes.status === 'fulfilled') {
        setSlackConnection(slackRes.value.connection || null);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Auto poll queue status every 4 seconds to reflect live BullMQ worker dispatches
    const interval = setInterval(() => {
      api.fetchQueueStats().then((res) => {
        if (res.queue) setQueueStats(res.queue);
      }).catch(() => {});

      api.fetchScheduledEmails().then((res) => {
        if (res.emails) setScheduledEmails(res.emails);
      }).catch(() => {});

      api.fetchSentEmails().then((res) => {
        if (res.emails) setSentEmails(res.emails);
      }).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [loadInitialData]);

  // Actions
  const handleScheduleSuccess = (count: number) => {
    showToast(`Successfully scheduled ${count} email job${count === 1 ? '' : 's'} into BullMQ!`);
    loadInitialData();
  };

  const handleSendNow = async (id: string) => {
    try {
      await api.sendEmailNow(id);
      showToast('Scheduled delay bypassed. Promoted job for immediate dispatch!');
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to send: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCancelEmail = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and remove this scheduled email?')) return;
    try {
      await api.cancelScheduledEmail(id);
      showToast('Email schedule and BullMQ delayed job removed.');
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to cancel: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRescheduleConfirm = async (id: string, newScheduledAt: string) => {
    try {
      await api.rescheduleEmail(id, newScheduledAt);
      showToast('Email rescheduled in PostgreSQL and re-armed in BullMQ.');
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to reschedule: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleToggleQueuePause = async () => {
    try {
      const res = await api.toggleQueuePause();
      showToast(res.paused ? 'BullMQ Queue Paused' : 'BullMQ Queue Resumed');
      loadInitialData();
    } catch (err: unknown) {
      alert('Error toggling queue: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.retryQueueJob(jobId);
      showToast(`Job ${jobId} re-enqueued in BullMQ.`);
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to retry: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleAddSender = async (data: { name: string; email: string; isDefault?: boolean }) => {
    const res = await api.createSender(data);
    setSenders((prev) => [...prev, res.sender]);
    showToast(`New sender "${res.sender.name}" registered in PostgreSQL.`);
  };

  const handleLogout = async () => {
    await api.logoutUser();
    setUser(null);
    showToast('Logged out.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Header */}
      <Header
        user={user}
        queueStats={queueStats}
        slackConnected={!!slackConnection}
        dbConnected={dbConnected}
        redisConnected={redisConnected}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenSlack={() => setIsSlackOpen(true)}
        onOpenSenders={() => setIsSendersOpen(true)}
        onRefresh={loadInitialData}
        onLoginWithGoogle={() => setIsGoogleAuthOpen(true)}
        onLogout={handleLogout}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Scheduled Emails</span>
              <span
                className={`ml-1.5 px-2 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'scheduled'
                    ? 'bg-indigo-800 text-indigo-100'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Sent History</span>
              <span
                className={`ml-1.5 px-2 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'sent'
                    ? 'bg-indigo-800 text-indigo-100'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {sentEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'queue'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>BullMQ Monitor</span>
              <span className={`h-2 w-2 rounded-full ml-1 ${redisConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === 'search'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Search className="h-4 w-4" />
              <span>Elasticsearch</span>
            </button>
          </nav>

          {/* Quick Info & Bull Board Shortcut */}
          <div className="hidden lg:flex items-center space-x-4 text-xs text-slate-400">
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 transition"
            >
              <span>Live Bull Board</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'scheduled' && (
          <ScheduledTable
            emails={scheduledEmails}
            isLoading={isLoadingEmails}
            onSendNow={handleSendNow}
            onReschedule={(email) => setSelectedRescheduleEmail(email)}
            onCancel={handleCancelEmail}
            onViewDetails={(email) => setSelectedDetailEmail(email)}
          />
        )}

        {activeTab === 'sent' && (
          <SentTable
            emails={sentEmails}
            isLoading={isLoadingEmails}
            onViewDetails={(email) => setSelectedDetailEmail(email)}
          />
        )}

        {activeTab === 'queue' && (
          <QueueMonitor
            stats={queueStats}
            jobs={queueJobs}
            isLoading={isRefreshing}
            onRefresh={loadInitialData}
            onTogglePause={handleToggleQueuePause}
            onRetryJob={handleRetryJob}
          />
        )}

        {activeTab === 'search' && (
          <SearchTab onViewDetails={(email) => setSelectedDetailEmail(email)} />
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-indigo-500/40 text-white text-xs shadow-2xl shadow-indigo-500/20 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onScheduleSuccess={handleScheduleSuccess}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        connection={slackConnection}
        onConnectionChange={loadInitialData}
      />

      <SenderModal
        isOpen={isSendersOpen}
        onClose={() => setIsSendersOpen(false)}
        senders={senders}
        onAddSender={handleAddSender}
      />

      <EmailDetailModal
        email={selectedDetailEmail}
        onClose={() => setSelectedDetailEmail(null)}
      />

      <RescheduleModal
        email={selectedRescheduleEmail}
        onClose={() => setSelectedRescheduleEmail(null)}
        onConfirm={handleRescheduleConfirm}
      />

      <GoogleAuthModal
        isOpen={isGoogleAuthOpen}
        onClose={() => setIsGoogleAuthOpen(false)}
        currentUserEmail={user?.email}
      />
    </div>
  );
}
