import React, { useState, useEffect } from 'react';
import { X, UserCheck, Shield, ExternalLink, AlertTriangle, Key } from 'lucide-react';
import { getGoogleAuthUrl } from '../services/api.ts';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
}) => {
  const [authData, setAuthData] = useState<{ configured: boolean; url?: string; error?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getGoogleAuthUrl()
        .then((res) => setAuthData(res))
        .catch((err) => setAuthData({ configured: false, error: err.message }))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartGoogleAuth = () => {
    if (authData?.url) {
      window.location.href = authData.url;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Google OAuth Authentication</h3>
              <p className="text-xs text-slate-400">Authenticates dashboard session via Google Cloud Console</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-8 text-center text-slate-400">Checking Google OAuth configuration...</div>
          ) : authData?.configured && authData.url ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 space-y-1.5">
                <div className="font-semibold flex items-center space-x-1.5">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span>Google OAuth 2.0 Ready</span>
                </div>
                <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                  Clicking below redirects to Google&apos;s OAuth consent flow. Upon approval, Google redirects
                  to <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-200">/api/auth/google/callback</code> to
                  verify your token and create your authenticated user in PostgreSQL.
                </p>
              </div>

              <button
                onClick={handleStartGoogleAuth}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-md transition flex items-center justify-center space-x-2"
              >
                <span>Continue to Google Sign-In</span>
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 space-y-2">
                <div className="font-semibold flex items-center space-x-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>Google OAuth Setup Required</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  To enable real Google Sign-In, provide your Google Cloud OAuth credentials in your <code className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">.env</code>:
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                <p className="text-slate-500"># Google OAuth Credentials in .env</p>
                <p>GOOGLE_CLIENT_ID=&quot;your-client-id.apps.googleusercontent.com&quot;</p>
                <p>GOOGLE_CLIENT_SECRET=&quot;your-client-secret&quot;</p>
                <p>GOOGLE_CALLBACK_URL=&quot;http://localhost:3000/api/auth/google/callback&quot;</p>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <p className="font-medium text-slate-300">Authorized redirect URI in Google Cloud Console:</p>
                <code className="block bg-slate-800 p-2 rounded text-indigo-300 font-mono break-all select-all">
                  http://localhost:3000/api/auth/google/callback
                </code>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
