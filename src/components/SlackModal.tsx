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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center">
              <Slack className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Slack Rate-Limit Notifications
              </h3>
              <p className="text-[11px] text-slate-400">Slack alert dispatch when hourly limit is reached</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-md p-3 text-slate-300 space-y-1.5">
            <div className="flex items-center space-x-2 text-slate-200 font-medium">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>Automated Rate-Limit Trigger</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              When a sender reaches their hourly limit in Redis, the BullMQ worker preserves the email,
              reschedules it to the next hourly window, and dispatches a message to your Slack channel.
            </p>
          </div>

          {slackConfigured ? (
            <div className="p-3.5 rounded-md bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider">Connect via Slack OAuth App</h4>
              <p className="text-slate-400 text-[11px]">
                One-click OAuth authorization requesting incoming-webhook scope.
              </p>
              <button
                type="button"
                onClick={handleOAuthConnect}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded border border-slate-700 transition-colors flex items-center justify-center space-x-1.5"
              >
                <Slack className="h-3.5 w-3.5" />
                <span>Authorize with Slack</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {/* Incoming Webhook */}
          <form onSubmit={handleWebhookSubmit} className="space-y-3 pt-1">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Incoming Webhook URL</h4>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Workspace or Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Operations Workspace"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Target Channel
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#reachinbox-alerts"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {testResult && (
              <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/60 text-xs text-emerald-300 flex items-center space-x-2">
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
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-950/60 text-rose-400 border border-rose-800 text-xs transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Disconnect</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTest}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition-colors"
                  >
                    <Send className="h-3 w-3 text-blue-400" />
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
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded shadow-sm transition-colors"
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
