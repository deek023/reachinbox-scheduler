import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  Send,
  Slack,
  UserCheck,
  ChevronDown,
  LogOut,
  RefreshCw,
  Plus,
  ExternalLink,
  Shield,
  Database,
  Server,
  Layers,
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
  const [healthMenuOpen, setHealthMenuOpen] = useState(false);
  const healthRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (healthRef.current && !healthRef.current.contains(event.target as Node)) {
        setHealthMenuOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allOperational = dbConnected && redisConnected;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand & System Health */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2.5">
              <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                <Mail className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-white">
                ReachInbox
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400 border-l border-slate-800 pl-2.5">
                Scheduler
              </span>
            </div>

            {/* Health Popover Button */}
            <div className="relative" ref={healthRef}>
              <button
                type="button"
                onClick={() => setHealthMenuOpen(!healthMenuOpen)}
                className="flex items-center space-x-2 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    allOperational ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="hidden md:inline">
                  {allOperational ? 'All Systems Operational' : 'System Degraded'}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {healthMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-72 bg-slate-900 rounded-md border border-slate-800 p-3 text-xs text-slate-200 shadow-lg z-50 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    <span>Infrastructure Status</span>
                    <button
                      type="button"
                      onClick={onRefresh}
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-normal capitalize"
                    >
                      <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800/60">
                      <span className="flex items-center space-x-2 text-slate-300">
                        <Database className="h-3.5 w-3.5 text-slate-400" />
                        <span>PostgreSQL</span>
                      </span>
                      <span className={dbConnected ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                        {dbConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800/60">
                      <span className="flex items-center space-x-2 text-slate-300">
                        <Server className="h-3.5 w-3.5 text-slate-400" />
                        <span>Redis</span>
                      </span>
                      <span className={redisConnected ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                        {redisConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800/60">
                      <span className="flex items-center space-x-2 text-slate-300">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span>BullMQ Workers</span>
                      </span>
                      <span className="text-slate-300 font-mono tabular-nums">
                        {queueStats?.concurrency ?? 5} slots
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950 border border-slate-800/60">
                      <span className="flex items-center space-x-2 text-slate-300">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span>Ethereal SMTP</span>
                      </span>
                      <span className="text-emerald-400 font-medium">Ready</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                    <span>Queue Monitor</span>
                    <a
                      href="/admin/queues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>Bull Board</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>Bull Board</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <button
              type="button"
              onClick={onOpenSenders}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <Plus className="h-3 w-3 text-slate-400" />
              <span>Senders</span>
            </button>

            <button
              type="button"
              onClick={onOpenSlack}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                slackConnected
                  ? 'text-emerald-300 bg-emerald-950/30 border-emerald-800/60 hover:bg-emerald-950/50'
                  : 'text-slate-300 bg-slate-950 hover:bg-slate-800 border-slate-800'
              }`}
            >
              <Slack className="h-3 w-3 text-slate-400" />
              <span className="hidden sm:inline">Slack</span>
              {slackConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              title="Refresh queue and data"
              className={`p-1.5 rounded-md text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors ${
                isRefreshing ? 'animate-spin text-blue-400' : ''
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenCompose}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Compose</span>
            </button>

            {/* User Profile */}
            <div className="relative" ref={userRef}>
              {user ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 p-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-6 w-6 rounded object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden md:inline text-xs font-medium text-slate-300 max-w-[100px] truncate">
                      {user.name.split(' ')[0]}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 rounded-md border border-slate-800 py-1 text-slate-200 shadow-lg z-50">
                      <div className="px-3 py-2 border-b border-slate-800">
                        <p className="text-xs font-medium text-white">{user.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLoginWithGoogle();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center space-x-2 text-slate-300"
                      >
                        <Shield className="h-3.5 w-3.5 text-blue-400" />
                        <span>Google OAuth Status</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 text-rose-400 flex items-center space-x-2"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoginWithGoogle}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                >
                  <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
