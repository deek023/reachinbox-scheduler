import React, { useState, useEffect } from 'react';
import { X, UserCheck, Shield, ExternalLink, AlertTriangle } from 'lucide-react';
import { getGoogleAuthUrl } from '../services/api.ts';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Google OAuth Authentication</h3>
              <p className="text-[11px] text-slate-400">Authenticates dashboard session via Google Cloud Console</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          {isLoading ? (
            <div className="py-6 text-center text-slate-400">Checking Google OAuth configuration...</div>
          ) : authData?.configured && authData.url ? (
            <div className="space-y-3">
              <div className="p-3 rounded bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 space-y-1">
                <div className="font-semibold text-xs flex items-center space-x-1.5 uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Google OAuth 2.0 Ready</span>
                </div>
                <p className="text-[11px] text-emerald-400 leading-relaxed">
                  Proceeding redirects to Google OAuth consent. Upon approval, Google redirects
                  to /api/auth/google/callback to create your authenticated user in PostgreSQL.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartGoogleAuth}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-xs shadow-sm transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>Continue to Google Sign In</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60 text-amber-300 space-y-1">
                <div className="font-semibold text-xs flex items-center space-x-1.5 uppercase tracking-wider">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span>Google OAuth Setup Required</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Provide your Google Cloud OAuth credentials in your .env file:
                </p>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-slate-300 space-y-0.5">
                <p className="text-slate-500"># Google OAuth Credentials in .env</p>
                <p>GOOGLE_CLIENT_ID=&quot;client-id.apps.googleusercontent.com&quot;</p>
                <p>GOOGLE_CLIENT_SECRET=&quot;client-secret&quot;</p>
                <p>GOOGLE_CALLBACK_URL=&quot;http://localhost:3000/api/auth/google/callback&quot;</p>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5">
                <p className="font-medium text-slate-300">Authorized redirect URI:</p>
                <code className="block bg-slate-950 p-1.5 rounded text-blue-400 font-mono text-[10px] border border-slate-800 select-all">
                  http://localhost:3000/api/auth/google/callback
                </code>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
