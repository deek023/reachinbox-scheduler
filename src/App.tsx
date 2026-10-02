import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  Activity,
  Search,
  Check,
  Layers,
  Zap,
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
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queue' | 'search'>('scheduled');

  const [user, setUser] = useState<User | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [slackConnection, setSlackConnection] = useState<SlackConnection | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [redisConnected, setRedisConnected] = useState<boolean>(false);

  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isSendersOpen, setIsSendersOpen] = useState(false);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState(false);
  const [selectedDetailEmail, setSelectedDetailEmail] = useState<EmailRecord | null>(null);
  const [selectedRescheduleEmail, setSelectedRescheduleEmail] = useState<EmailRecord | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      showToast('Successfully authenticated via Google OAuth');
      window.history.replaceState({}, '', '/');
    } else if (params.get('auth') === 'error') {
      showToast(`Google OAuth error: ${params.get('message') || 'Authentication failed'}`);
      window.history.replaceState({}, '', '/');
    } else if (params.get('slack') === 'connected') {
      showToast('Slack alerts connected successfully');
      window.history.replaceState({}, '', '/');
    }
  }, []);

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
    setIsLoadingEmails(true);
    loadInitialData().finally(() => setIsLoadingEmails(false));

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

  const handleScheduleSuccess = (count: number) => {
    showToast(`Successfully scheduled ${count} email job${count === 1 ? '' : 's'} into BullMQ`);
    loadInitialData();
  };

  const handleSendNow = async (id: string) => {
    try {
      await api.sendEmailNow(id);
      showToast('Scheduled delay bypassed. Promoted job for immediate dispatch.');
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to send: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCancelEmail = async (id: string) => {
    if (!confirm('Cancel and remove this scheduled email?')) return;
    try {
      await api.cancelScheduledEmail(id);
      showToast('Email schedule and BullMQ delayed job removed');
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to cancel: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRescheduleConfirm = async (id: string, newScheduledAt: string) => {
    try {
      await api.rescheduleEmail(id, newScheduledAt);
      showToast('Email rescheduled in PostgreSQL and re-armed in BullMQ');
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
      showToast(`Job ${jobId} re-enqueued in BullMQ`);
      loadInitialData();
    } catch (err: unknown) {
      alert('Failed to retry: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleAddSender = async (data: { name: string; email: string; isDefault?: boolean }) => {
    const res = await api.createSender(data);
    setSenders((prev) => [...prev, res.sender]);
    showToast(`New sender "${res.sender.name}" registered in PostgreSQL`);
  };

  const handleLogout = async () => {
    await api.logoutUser();
    setUser(null);
    showToast('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
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

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Compact Horizontal Operational Stat Bar */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 py-2 px-3 bg-slate-900 border border-slate-800 rounded-md text-xs">
          <div className="flex items-center space-x-2">
            <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-slate-400">Scheduled:</span>
            <span className="font-semibold text-white font-mono tabular-nums">{scheduledEmails.length}</span>
          </div>

          <div className="hidden sm:block h-3 w-px bg-slate-800" />

          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400">Delivered:</span>
            <span className="font-semibold text-white font-mono tabular-nums">{sentEmails.length}</span>
          </div>

          <div className="hidden sm:block h-3 w-px bg-slate-800" />

          <div className="flex items-center space-x-2">
            <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">Worker Concurrency:</span>
            <span className="font-semibold text-slate-200 font-mono tabular-nums">{queueStats?.concurrency ?? 5} slots</span>
          </div>

          <div className="hidden sm:block h-3 w-px bg-slate-800" />

          <div className="flex items-center space-x-2">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400">Hourly Rate Cap:</span>
            <span className="font-semibold text-slate-200 font-mono tabular-nums">{queueStats?.maxEmailsPerHour ?? 200}/hr</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-800">
          <nav className="flex space-x-6">
            <button
              type="button"
              onClick={() => setActiveTab('scheduled')}
              className={`pb-2.5 text-xs transition-colors flex items-center space-x-1.5 border-b-2 font-medium ${
                activeTab === 'scheduled'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Scheduled Emails</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                ({scheduledEmails.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={`pb-2.5 text-xs transition-colors flex items-center space-x-1.5 border-b-2 font-medium ${
                activeTab === 'sent'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Sent History</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                ({sentEmails.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`pb-2.5 text-xs transition-colors flex items-center space-x-1.5 border-b-2 font-medium ${
                activeTab === 'queue'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>BullMQ Monitor</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  redisConnected ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`pb-2.5 text-xs transition-colors flex items-center space-x-1.5 border-b-2 font-medium ${
                activeTab === 'search'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Elasticsearch</span>
            </button>
          </nav>
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
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

        {activeTab === 'sent' && (
          <SentTable
            emails={sentEmails}
            isLoading={isLoadingEmails}
            onViewDetails={(email) => setSelectedDetailEmail(email)}
            onOpenCompose={() => setIsComposeOpen(true)}
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

      {/* Enterprise Legal and Links Footer (Rule 25) */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-900 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-4">
            <span className="text-slate-300 font-medium">ReachInbox Scheduler</span>
            <span className="text-slate-600">|</span>
            <span>BullMQ Delayed Queue Engine</span>
            <span className="text-slate-600">|</span>
            <span>PostgreSQL Persistence</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              Bull Board Monitor
            </a>
            <span className="text-slate-700">|</span>
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              Health Check API
            </a>
            <span className="text-slate-700">|</span>
            <span className="hover:text-slate-200 cursor-pointer">Terms of Service</span>
            <span className="text-slate-700">|</span>
            <span className="hover:text-slate-200 cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </footer>

      {/* Clean Notification Toast (No Sparkles or Emojis) */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-md bg-slate-900 border border-slate-700 text-white text-xs shadow-md">
          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
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
