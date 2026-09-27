import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  X,
  Upload,
  Calendar,
  Clock,
  Sparkles,
  Users,
  Send,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import type { Sender } from '../types/email.ts';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onScheduleSuccess: (count: number) => void;
}

interface ParsedLead {
  email: string;
  name?: string;
  company?: string;
  [key: string]: any;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onScheduleSuccess,
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [senderId, setSenderId] = useState<string>(senders[0]?.id || '');
  const [recipient, setRecipient] = useState<string>('');
  const [subject, setSubject] = useState<string>('Quick sync regarding outreach scaling');
  const [body, setBody] = useState<string>(
    'Hi {{name}},\n\nI noticed {{company}} is scaling outreach operations. ReachInbox combines BullMQ delayed queues with Redis rate-limiters to ensure 100% deliverability.\n\nWould you be open to a 10-minute walkthrough this week?\n\nBest regards,\nReachInbox Growth'
  );

  // Scheduling options
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('later');
  // Default to 5 minutes in future
  const defaultFutureDate = new Date(Date.now() + 5 * 60 * 1000);
  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [scheduledAtStr, setScheduledAtStr] = useState<string>(toLocalIso(defaultFutureDate));
  const [delayBetweenEmailsSec, setDelayBetweenEmailsSec] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // Bulk CSV state
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvError, setCsvError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, any>[];
        if (rows.length === 0) {
          setCsvError('Uploaded file appears empty.');
          return;
        }

        // Try to identify email, name, company columns
        const leads: ParsedLead[] = [];
        for (const row of rows) {
          let emailVal = '';
          let nameVal = '';
          let companyVal = '';

          for (const key of Object.keys(row)) {
            const lowerKey = key.toLowerCase().trim();
            const val = String(row[key] || '').trim();

            if (!emailVal && (lowerKey.includes('email') || val.includes('@'))) {
              emailVal = val;
            } else if (!nameVal && (lowerKey.includes('name') || lowerKey === 'first_name' || lowerKey === 'lead')) {
              nameVal = val;
            } else if (!companyVal && (lowerKey.includes('company') || lowerKey.includes('org') || lowerKey.includes('domain'))) {
              companyVal = val;
            }
          }

          if (emailVal && emailVal.includes('@')) {
            leads.push({
              email: emailVal,
              name: nameVal || emailVal.split('@')[0],
              company: companyVal || 'Your Company',
            });
          }
        }

        if (leads.length === 0) {
          setCsvError('No valid email addresses found in the CSV. Please ensure a column contains valid emails.');
          return;
        }

        setParsedLeads(leads);
      },
      error: (err) => {
        setCsvError('Failed to parse CSV: ' + err.message);
      },
    });
  };

  const loadSampleLeads = (count = 15) => {
    const sampleCompanies = ['Stripe', 'Figma', 'Linear', 'Vercel', 'Supabase', 'Retool', 'Ramp', 'Notion', 'Brex', 'Datadog'];
    const sampleNames = ['Marcus Vance', 'Sarah Jenkins', 'Li Wei', 'Priya Sharma', 'Alexandre Dubois', 'Elena Rostova', 'David Chen', 'Chloe Martin', 'Kenji Sato', 'Amara Okafor'];

    const mock: ParsedLead[] = [];
    for (let i = 0; i < count; i++) {
      const name = sampleNames[i % sampleNames.length] + ` ${Math.floor(i / sampleNames.length) + 1}`;
      const company = sampleCompanies[i % sampleCompanies.length];
      const email = `${name.toLowerCase().replace(/\s+/g, '.')}@${company.toLowerCase()}.demo`;
      mock.push({ email, name, company });
    }

    setCsvFileName(`sample-leads-${count}.csv`);
    setParsedLeads(mock);
    setCsvError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const targetDate = scheduleType === 'now' ? new Date().toISOString() : new Date(scheduledAtStr).toISOString();

      if (mode === 'single') {
        if (!recipient || !recipient.includes('@')) {
          alert('Please enter a valid recipient email address.');
          setIsSubmitting(false);
          return;
        }

        const res = await fetch('/api/emails/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient,
            subject,
            body,
            senderId: senderId || senders[0]?.id,
            scheduledAt: targetDate,
            delayBetweenEmailsMs: delayBetweenEmailsSec * 1000,
            hourlyLimit,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to schedule email');
        onScheduleSuccess(1);
        onClose();
      } else {
        // Bulk mode
        if (parsedLeads.length === 0) {
          alert('Please upload a CSV or load sample leads first.');
          setIsSubmitting(false);
          return;
        }

        const res = await fetch('/api/emails/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipients: parsedLeads,
            subject,
            body,
            senderId: senderId || senders[0]?.id,
            scheduledAt: targetDate,
            delayBetweenEmailsMs: delayBetweenEmailsSec * 1000,
            hourlyLimit,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to schedule bulk emails');
        onScheduleSuccess(parsedLeads.length);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Error scheduling email: ' + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Compose & Schedule Email</h2>
              <p className="text-xs text-slate-400">BullMQ delayed queue with Redis hourly rate limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Mode Switcher: Single vs Bulk CSV */}
          <div className="flex p-1 bg-slate-800/80 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'single'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Single Recipient</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'bulk'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Bulk Leads CSV (1 Job Per Lead)</span>
            </button>
          </div>

          {/* Sender Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              From Sender Identity
            </label>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email}) {s.isDefault ? '• Default' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Single Mode: Recipient Input */}
          {mode === 'single' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Recipient Email
              </label>
              <input
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="sarah.connor@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
              />
            </div>
          ) : (
            /* Bulk Mode: CSV Upload & Lead Preview */
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Upload Leads CSV or Load Sample
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 text-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition group"
              >
                <Upload className="h-6 w-6 mx-auto text-slate-400 group-hover:text-indigo-400 mb-1 transition" />
                <p className="text-xs font-medium text-slate-200">
                  {csvFileName ? `Selected: ${csvFileName}` : 'Click to upload leads .CSV'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Accepts columns: email, name, company
                </p>
              </div>

              {/* Sample leads button */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">No CSV on hand?</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => loadSampleLeads(5)}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
                  >
                    + Load 5 Leads
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleLeads(25)}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition"
                  >
                    + Load 25 Leads
                  </button>
                </div>
              </div>

              {/* Parsed Leads Summary */}
              {parsedLeads.length > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>
                      <strong className="text-white">{parsedLeads.length} leads</strong> extracted
                      successfully ({parsedLeads.length} independent BullMQ jobs)
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400/80 font-mono">1 record/recipient</span>
                </div>
              )}

              {csvError && (
                <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-2.5 flex items-center space-x-2 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Scaling cold outreach with BullMQ rate limits"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
            />
          </div>

          {/* Body with Token Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Email Body
              </label>
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <span>Variables:</span>
                <button
                  type="button"
                  onClick={() => setBody(body + ' {{name}}')}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono hover:bg-slate-700"
                >
                  {'{{name}}'}
                </button>
                <button
                  type="button"
                  onClick={() => setBody(body + ' {{company}}')}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono hover:bg-slate-700"
                >
                  {'{{company}}'}
                </button>
                <button
                  type="button"
                  onClick={() => setBody(body + ' {{email}}')}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono hover:bg-slate-700"
                >
                  {'{{email}}'}
                </button>
              </div>
            </div>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500 font-sans leading-relaxed"
            />
          </div>

          {/* Scheduling & Timing Controls */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>Delivery & Queue Timing</span>
              </span>
              <div className="flex space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setScheduleType('later')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    scheduleType === 'later'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  Schedule Later
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('now')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    scheduleType === 'now'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  Immediate (Now)
                </button>
              </div>
            </div>

            {scheduleType === 'later' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Start Execution Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAtStr}
                    onChange={(e) => setScheduledAtStr(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex space-x-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 1 * 60 * 1000)))}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded"
                    >
                      +1 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 5 * 60 * 1000)))}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded"
                    >
                      +5 mins (Restart Demo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduledAtStr(toLocalIso(new Date(Date.now() + 30 * 60 * 1000)))}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded"
                    >
                      +30 mins
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Delay Between Leads (Staggering)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={0.5}
                      value={delayBetweenEmailsSec}
                      onChange={(e) => setDelayBetweenEmailsSec(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-400">sec</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Paces recipient sends to satisfy minimum interval requirements.
                  </p>
                </div>
                
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Hourly Email Limit
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      value={hourlyLimit}
                      onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-400">emails/hr</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Maximum emails allowed per hour for this scheduled batch.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
              <Info className="h-3.5 w-3.5 text-indigo-400" />
              <span>Ethereal preview link generated automatically on dispatch</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-md transition"
              >
                {isSubmitting ? (
                  <span>Scheduling Jobs...</span>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {mode === 'single'
                        ? 'Schedule Email'
                        : `Schedule ${parsedLeads.length || 0} Leads`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
