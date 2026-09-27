import React, { useState, useEffect } from 'react';
import { X, Slack, CheckCircle, AlertTriangle, Send, Trash2, ExternalLink } from 'lucide-react';
import type { SlackConnection } from '../types/email.ts';
import { connectSlackWebhook, disconnectSlack, testSlackNotification, fetchSlackStatus } from '../services/api.ts';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: SlackConnection | null;
  onConnectionChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  connection,
  onConnectionChange,
}) => {
  const [slackConfigured, setSlackConfigured] = useState(false);
  const [teamName, setTeamName] = useState(connection?.teamName || '');
  const [channel, setChannel] = useState(connection?.channel || '#email-scheduler-alerts');
  const [webhookUrl, setWebhookUrl] = useState(connection?.webhookUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSlackStatus().then((res) => {
        setSlackConfigured(res.configured);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOAuthConnect = () => {
    window.location.href = '/api/slack/connect';
  };

  const handleWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    setIsSubmitting(true);
    setTestResult(null);
    try {
      await connectSlackWebhook({ teamName, channel, webhookUrl });
      onConnectionChange();
      setTestResult('Incoming webhook saved and connected.');
    } catch (err: unknown) {
      alert('Error saving webhook: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Slack alerts?')) return;
    try {
      await disconnectSlack();
      setWebhookUrl('');
      onConnectionChange();
    } catch (err: unknown) {
      alert('Error disconnecting: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleTest = async () => {
    try {
      const res = await testSlackNotification();
      setTestResult(res.message);
    } catch (err: unknown) {
      alert('Test failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Slack className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Slack Rate-Limit Notifications</h3>
              <p className="text-xs text-slate-400">Real Slack alert dispatch when hourly limit is reached</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-300 font-medium">
              <AlertTriangle className="h-4 w-4" />
              <span>Real Automated Rate-Limit Trigger</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When a sender reaches their hourly limit in Redis, the BullMQ worker preserves the email,
              reschedules it to the next hourly window, and dispatches a message to your Slack channel.
            </p>
          </div>

          {/* Option A: Slack OAuth */}
          {slackConfigured ? (
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2 text-xs">
              <h4 className="font-semibold text-white">Connect via Slack OAuth App</h4>
              <p className="text-slate-400 text-[11px]">
                One-click OAuth authorization requesting <code className="text-indigo-300">incoming-webhook</code> scope.
              </p>
              <button
                onClick={handleOAuthConnect}
                className="w-full py-2 bg-[#4A154B] hover:bg-[#611f69] text-white font-medium text-xs rounded-lg transition flex items-center justify-center space-x-1.5"
              >
                <Slack className="h-4 w-4" />
                <span>Authorize with Slack</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {/* Option B: Incoming Webhook */}
          <form onSubmit={handleWebhookSubmit} className="space-y-3.5 pt-1">
            <h4 className="text-xs font-semibold text-white">Slack Incoming Webhook URL</h4>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Workspace / Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="My Organization Ops"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Target Channel
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#reachinbox-alerts"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            {testResult && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              {connection ? (
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs transition"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Disconnect</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTest}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
                  >
                    <Send className="h-3 w-3 text-indigo-400" />
                    <span>Send Test</span>
                  </button>
                </div>
              ) : (
                <div />
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow transition"
                >
                  {isSubmitting ? 'Saving...' : connection ? 'Update Webhook' : 'Save Webhook'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
