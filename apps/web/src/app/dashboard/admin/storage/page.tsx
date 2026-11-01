'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  FolderLock,
  Film,
  Mic,
  FileText,
  Image as ImageIcon,
  Archive,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Settings,
  Unplug,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { DriveConnectionStatus, StorageLedger } from '@ourspace/types';
import { formatDecimalBytes } from '@ourspace/shared';
import { Button } from '@/components/ui/Button';

interface Diagnostics {
  has_client_id: boolean;
  client_id_preview: string | null;
  has_client_secret: boolean;
  has_refresh_token: boolean;
  has_active_token: boolean;
  has_firestore_doc: boolean;
  redirect_uri: string;
}

function AdminStorageContent() {
  const searchParams = useSearchParams();
  const urlConnected = searchParams.get('connected') === 'true';
  const urlError = searchParams.get('error');
  const urlEmail = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [ledger, setLedger] = useState<StorageLedger | null>(null);
  const [googleStorage, setGoogleStorage] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(urlError || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    urlConnected ? `Central Google Drive connected successfully! ${urlEmail ? `Account: ${urlEmail}` : ''}` : null
  );

  // Manual direct setup form
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [manualRefreshToken, setManualRefreshToken] = useState('');
  const [manualClientId, setManualClientId] = useState('');
  const [manualClientSecret, setManualClientSecret] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  const fetchStatus = async (reconcile = false) => {
    try {
      if (reconcile) setReconciling(true);
      else setLoading(true);

      const res = await fetch(`/api/drive/status${reconcile ? '?reconcile=true' : ''}`);
      const data = await res.json();

      if (data.success) {
        setStatus(data.status);
        setLedger(data.ledger);
        setGoogleStorage(data.googleAccountStorage);
        setDiagnostics(data.diagnostics || null);
        if (data.status?.is_connected) {
          try {
            localStorage.setItem('ourspace_drive_connected', 'true');
            window.dispatchEvent(new Event('storage'));
          } catch {}
        }
        if (!urlError && data.error && !data.status?.is_connected) {
          setError(data.error);
        }
      } else {
        setError(data.error || 'Failed to fetch storage status');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching storage status');
    } finally {
      setLoading(false);
      setReconciling(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyRedirectUri = () => {
    const uri = diagnostics?.redirect_uri || 'https://ourspace-app-two.vercel.app/api/drive/callback';
    navigator.clipboard.writeText(uri);
    setCopiedRedirectUri(true);
    setTimeout(() => setCopiedRedirectUri(false), 2500);
  };

  const handleSaveManualCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRefreshToken.trim()) {
      setError('Please provide a Google Drive Refresh Token.');
      return;
    }
    setSavingManual(true);
    setError(null);

    try {
      const res = await fetch('/api/drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          refreshToken: manualRefreshToken.trim(),
          clientId: manualClientId.trim() || undefined,
          clientSecret: manualClientSecret.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Google Drive connected! Account: ${data.email || 'Central Account'}`);
        setManualRefreshToken('');
        setManualClientId('');
        setManualClientSecret('');
        setShowManualSetup(false);
        fetchStatus(true);
      } else {
        setError(data.error || 'Failed to verify credentials with Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving credentials.');
    } finally {
      setSavingManual(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect central Google Drive? Media uploads will be paused until reconnected.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(null);
        setError('Google Drive disconnected.');
        try {
          localStorage.removeItem('ourspace_drive_connected');
          window.dispatchEvent(new Event('storage'));
        } catch {}
        fetchStatus();
      }
    } catch (err: any) {
      setError(err.message || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const usedBytes = (ledger?.verified_used_bytes || 0) + (ledger?.reserved_upload_bytes || 0);
  const maxBytes = ledger?.max_storage_bytes || 250_000_000_000;
  const percentage = Math.min(100, Math.round((usedBytes / maxBytes) * 100));

  const warningLevel = ledger?.warning_level || 'NORMAL';
  const progressColor =
    warningLevel === 'EXCEEDED'
      ? 'bg-red-600'
      : warningLevel === 'CRITICAL'
      ? 'bg-rose-500'
      : warningLevel === 'WARNING'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-rose-500 shrink-0" />
            Central Google Drive & 250 GB Quota Manager
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
            Server-side Google storage management, client-side E2EE encryption, and quota ledger
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => fetchStatus(true)}
            disabled={reconciling || loading}
            className="flex items-center gap-2 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-100 border border-stone-200 dark:border-zinc-700 text-xs sm:text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Reconciling...' : 'Reconcile'}
          </Button>

          {!status?.is_connected ? (
            <a href="/api/drive/auth" className="inline-block">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20 text-xs sm:text-sm">
                <Cloud className="w-4 h-4" />
                Connect Google Drive
              </Button>
            </a>
          ) : (
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-stone-600 dark:text-zinc-400 border border-stone-200 dark:border-zinc-700 text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Unplug className="w-4 h-4" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Connection Established</h4>
              <p className="text-xs mt-0.5">{successMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start justify-between gap-3 text-rose-700 dark:text-rose-400 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Storage Notice</h4>
              <p className="text-xs mt-0.5">{error}</p>
              {!status?.is_connected && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href="/api/drive/auth" className="inline-block">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      Try Connecting Again
                    </button>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowManualSetup(true)}
                    className="px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 text-stone-800 dark:text-zinc-200 text-xs font-bold transition-colors"
                  >
                    View Setup Instructions
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quota Threshold Warnings */}
      {warningLevel === 'EXCEEDED' && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertOctagon className="w-6 h-6 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">OURSPACE 250 GB Quota Hard Limit Reached</h4>
            <p className="text-xs mt-0.5">
              New uploads are blocked to preserve remaining personal Google Drive storage. Existing files remain readable.
            </p>
          </div>
        </div>
      )}

      {/* Google Drive Connection Card */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-stone-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              status?.is_connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}>
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-stone-900 dark:text-zinc-100">
                  Central Google AI Pro Storage Account
                </h3>
                {status?.is_connected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Configuration Required
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                {status?.is_connected ? (
                  <>
                    Connected Account: <strong className="text-stone-700 dark:text-zinc-200">{status.account_email || 'Authenticated Central User'}</strong> • Root: <code className="bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-stone-700 dark:text-zinc-300">OURSPACE_STORAGE/</code>
                  </>
                ) : (
                  <>Root folder: <code className="bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-stone-700 dark:text-zinc-300">OURSPACE_STORAGE/</code> • Only ciphertext stored. Zero Google login required for couple partners.</>
                )}
              </p>
            </div>
          </div>

          {status?.is_connected && (
            <div className="text-left sm:text-right text-xs text-stone-500 dark:text-zinc-400 shrink-0">
              {googleStorage?.limitBytes && (
                <p>Google Account: {formatDecimalBytes(googleStorage.usageBytes || 0)} used of {formatDecimalBytes(googleStorage.limitBytes)}</p>
              )}
              <p className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 justify-start sm:justify-end">
                <ShieldCheck className="w-3.5 h-3.5" /> drive.file least-privilege active
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main 250 GB Quota Progress Gauge */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white/80 to-stone-50/50 dark:from-zinc-900/80 dark:to-zinc-950/50 backdrop-blur-xl border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500 dark:text-zinc-400">
              OURSPACE Dedicated Application Quota
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
              {formatDecimalBytes(usedBytes)}{' '}
              <span className="text-lg sm:text-xl font-normal text-stone-500 dark:text-zinc-400">
                / {formatDecimalBytes(maxBytes)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-zinc-100">{percentage}%</span>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              {formatDecimalBytes(Math.max(0, maxBytes - usedBytes))} remaining
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-4 bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Threshold Markers */}
        <div className="flex justify-between text-[11px] sm:text-xs text-stone-400 dark:text-zinc-500 px-1">
          <span>0 GB</span>
          <span>150 GB (Warning)</span>
          <span>200 GB (Critical)</span>
          <span>250 GB (Hard Stop)</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-stone-200/80 dark:border-zinc-800/80">
          <span className="text-xs text-stone-500 dark:text-zinc-400">Verified Used Storage</span>
          <div className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mt-1">
            {formatDecimalBytes(ledger?.verified_used_bytes || 0)}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 block">Confirmed in Drive</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-stone-200/80 dark:border-zinc-800/80">
          <span className="text-xs text-stone-500 dark:text-zinc-400">Reserved Upload Lease</span>
          <div className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mt-1">
            {formatDecimalBytes(ledger?.reserved_upload_bytes || 0)}
          </div>
          <span className="text-xs text-stone-400 dark:text-zinc-500 mt-1 block">Active chunk sessions</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-stone-200/80 dark:border-zinc-800/80">
          <span className="text-xs text-stone-500 dark:text-zinc-400">Available Quota</span>
          <div className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mt-1">
            {formatDecimalBytes(ledger?.available_bytes || maxBytes)}
          </div>
          <span className="text-xs text-stone-400 dark:text-zinc-500 mt-1 block">Capacity for new media</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-stone-200/80 dark:border-zinc-800/80">
          <span className="text-xs text-stone-500 dark:text-zinc-400">Total Tracked Files</span>
          <div className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mt-1">
            {ledger?.total_files_count || 0}
          </div>
          <span className="text-xs text-stone-400 dark:text-zinc-500 mt-1 block">Across all couple spaces</span>
        </div>
      </div>

      {/* Diagnostics and Direct Configuration Card */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-stone-900 dark:text-zinc-100">
              OAuth & Setup Diagnostics
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowManualSetup(!showManualSetup)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            {showManualSetup ? 'Hide Setup Details' : 'Configure Direct Credentials'}
            {showManualSetup ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Diagnostic Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-stone-500 dark:text-zinc-400">Google Client ID</span>
            {diagnostics?.has_client_id ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Configured
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Missing
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-stone-500 dark:text-zinc-400">Google Client Secret</span>
            {diagnostics?.has_client_secret ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Configured
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Missing (or in DB)
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-stone-500 dark:text-zinc-400">Refresh Token</span>
            {diagnostics?.has_refresh_token ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Active in Store
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-500/10 text-stone-500 dark:text-zinc-400">
                Not Connected
              </span>
            )}
          </div>
        </div>

        {/* Authorized Redirect URI copy bar */}
        <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-stone-600 dark:text-zinc-300">
            <span className="font-semibold block sm:inline">Google Cloud Console Authorized Redirect URI:</span>{' '}
            <code className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] break-all">
              {diagnostics?.redirect_uri || 'https://ourspace-app-two.vercel.app/api/drive/callback'}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyRedirectUri}
            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-700 hover:bg-stone-50 text-stone-800 dark:text-zinc-100 text-xs font-semibold flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm border border-stone-200 dark:border-zinc-600"
          >
            {copiedRedirectUri ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedRedirectUri ? 'Copied URI!' : 'Copy URI'}
          </button>
        </div>

        {/* Expandable Direct Form */}
        {showManualSetup && (
          <form onSubmit={handleSaveManualCredentials} className="mt-4 p-4 rounded-2xl bg-stone-50/80 dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-700 space-y-3">
            <div className="flex items-center gap-2 text-stone-800 dark:text-zinc-200 font-semibold text-xs uppercase tracking-wider">
              <KeyRound className="w-4 h-4 text-purple-500" />
              Direct Token or Client Secret Input
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              If automatic OAuth is blocked by Google consent or environment limits, you can paste your credentials directly here. They are saved securely in Firestore.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                  Google Client ID (Optional if set in Env)
                </label>
                <input
                  type="text"
                  placeholder="891280...apps.googleusercontent.com"
                  value={manualClientId}
                  onChange={(e) => setManualClientId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                  Google Client Secret (Optional if set in Env)
                </label>
                <input
                  type="password"
                  placeholder="GOCSPX-..."
                  value={manualClientSecret}
                  onChange={(e) => setManualClientSecret(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-300 block mb-1">
                Google Refresh Token (from OAuth Playground or Token Exchange)
              </label>
              <input
                type="password"
                placeholder="1//04..."
                value={manualRefreshToken}
                onChange={(e) => setManualRefreshToken(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="submit"
                disabled={savingManual}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
              >
                {savingManual ? 'Verifying with Google...' : 'Save & Connect Credentials'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Storage Breakdown by Category */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-4">
        <h3 className="font-semibold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
          <Archive className="w-5 h-5 text-rose-500" /> Storage Usage by Category
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50">
            <ImageIcon className="w-5 h-5 text-pink-500" />
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Shared Photos & Albums</p>
              <p className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                {formatDecimalBytes(ledger?.breakdown.shared_media_bytes || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50">
            <FolderLock className="w-5 h-5 text-indigo-500" />
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Encrypted Private Locker</p>
              <p className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                {formatDecimalBytes(ledger?.breakdown.locker_ciphertext_bytes || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50">
            <Film className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Shared Videos</p>
              <p className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                {formatDecimalBytes(ledger?.breakdown.video_bytes || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50">
            <Mic className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Voice Notes & Audio</p>
              <p className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                {formatDecimalBytes(ledger?.breakdown.voice_note_bytes || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Documents & Letters</p>
              <p className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                {formatDecimalBytes(ledger?.breakdown.document_bytes || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50">
            <Archive className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Encrypted Backups & Exports</p>
              <p className="font-semibold text-sm text-stone-900 dark:text-zinc-100">
                {formatDecimalBytes(ledger?.breakdown.backup_bytes || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminStorageDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-stone-500">Loading Storage Manager...</div>}>
      <AdminStorageContent />
    </Suspense>
  );
}
