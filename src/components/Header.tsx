import React, { useState } from 'react';
import {
  Mail,
  Send,
  Zap,
  Slack,
  UserCheck,
  ChevronDown,
  LogOut,
  RefreshCw,
  Plus,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';
import type { User, QueueStats } from '../types/email.ts';

interface HeaderProps {
  user: User | null;
  queueStats: QueueStats | null;
  slackConnected: boolean;
  dbConnected: boolean;
  redisConnected: boolean;
  onOpenCompose: () => void;
  onOpenSlack: () => void;
  onOpenSenders: () => void;
  onRefresh: () => void;
  onLoginWithGoogle: () => void;
  onLogout: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  queueStats,
  slackConnected,
  dbConnected,
  redisConnected,
  onOpenCompose,
  onOpenSlack,
  onOpenSenders,
  onRefresh,
  onLoginWithGoogle,
  onLogout,
  isRefreshing,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  ReachInbox
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Scheduler v1.0
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="flex items-center">
                  <span
                    className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                      redisConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  <span className={redisConnected ? 'text-emerald-400' : 'text-rose-400'}>
                    Redis: {redisConnected ? 'Connected' : 'Offline'}
                  </span>
                </span>
                <span>•</span>
                <span className="flex items-center">
                  <span
                    className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                      dbConnected ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  <span className={dbConnected ? 'text-emerald-400' : 'text-rose-400'}>
                    PostgreSQL: {dbConnected ? 'Connected' : 'Offline'}
                  </span>
                </span>
                <span>•</span>
                <span>Ethereal SMTP</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Bull Board Link */}
          <div className="hidden md:flex items-center space-x-3 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">Concurrency:</span>
              <span className="font-semibold text-slate-200">{queueStats?.concurrency ?? 5} slots</span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">Hourly Limit:</span>
              <span className="font-semibold text-indigo-300">
                {queueStats?.maxEmailsPerHour ?? 200}/hr
              </span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              <span>Bull Board</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center space-x-2.5">
            {/* Refresh */}
            <button
              onClick={onRefresh}
              title="Refresh queue and emails"
              className={`p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors ${
                isRefreshing ? 'animate-spin text-indigo-400' : ''
              }`}
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {/* Senders Manager */}
            <button
              onClick={onOpenSenders}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>Senders</span>
            </button>

            {/* Slack Connection */}
            <button
              onClick={onOpenSlack}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                slackConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Slack className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Slack</span>
              {slackConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ml-0.5" />}
            </button>

            {/* Compose Button */}
            <button
              onClick={onOpenCompose}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm shadow-md shadow-indigo-600/20 transition-all transform active:scale-95"
            >
              <Send className="h-4 w-4" />
              <span>Compose</span>
            </button>

            {/* Real Google OAuth User Profile */}
            <div className="relative">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 p-1 pl-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-indigo-500/40"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden md:inline text-xs font-medium text-slate-200 max-w-[100px] truncate">
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 py-2 text-slate-200 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-4 py-2.5 border-b border-slate-800">
                        <p className="text-xs font-semibold text-white">{user.name}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        <div className="mt-1 flex items-center text-[10px] text-emerald-400 font-medium">
                          <UserCheck className="h-3 w-3 mr-1" /> Google Authenticated
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLoginWithGoogle();
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-800 flex items-center space-x-2 text-slate-300"
                      >
                        <Shield className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Google OAuth Status</span>
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-rose-500/10 text-rose-400 flex items-center space-x-2"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLoginWithGoogle}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition shadow"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Google Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
