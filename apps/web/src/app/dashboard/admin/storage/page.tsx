'use client';

import React, { useState, useEffect } from 'react';
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
  Lock,
} from 'lucide-react';
import type { DriveConnectionStatus, StorageLedger } from '@ourspace/types';
import { formatDecimalBytes, formatBytes } from '@ourspace/shared';
import { Button } from '@/components/ui/Button';

export default function AdminStorageDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [ledger, setLedger] = useState<StorageLedger | null>(null);
  const [googleStorage, setGoogleStorage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(data.error || null);
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
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-rose-500" />
            Central Google Drive & 250 GB Quota Manager
          </h1>
          <p className="text-sm text-stone-500 dark:text-zinc-400 mt-1">
            Server-side Google AI Pro storage management, client-side E2EE encryption, and quota ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => fetchStatus(true)}
            disabled={reconciling}
            className="flex items-center gap-2 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-100 border border-stone-200 dark:border-zinc-700"
          >
            <RefreshCw className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Reconciling...' : 'Reconcile Ledger'}
          </Button>

          {!status?.is_connected && (
            <a href="/api/drive/auth" target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                <Cloud className="w-4 h-4" />
                Connect Google Drive
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Warning Banners */}
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

      {warningLevel === 'CRITICAL' && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Storage Alert: Exceeded 200 GB Critical Threshold</h4>
            <p className="text-xs mt-0.5">
              Approaching 250 GB application limit. Consider archiving older videos or media items.
            </p>
          </div>
        </div>
      )}

      {warningLevel === 'WARNING' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Storage Notice: Exceeded 150 GB Warning Threshold</h4>
            <p className="text-xs mt-0.5">
              Usage has crossed 60% of the allocated 250 GB OURSPACE storage boundary.
            </p>
          </div>
        </div>
      )}

      {/* Google Drive Connection Card */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-stone-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              status?.is_connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}>
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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
                Root folder: <code className="bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-stone-700 dark:text-zinc-300">OURSPACE_STORAGE/</code> • Only ciphertext is stored. Zero Google login required for couple partners.
              </p>
            </div>
          </div>

          {status?.is_connected && (
            <div className="text-right text-xs text-stone-500 dark:text-zinc-400">
              {googleStorage?.limitBytes && (
                <p>Google Account: {formatDecimalBytes(googleStorage.usageBytes || 0)} used of {formatDecimalBytes(googleStorage.limitBytes)}</p>
              )}
              <p className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 justify-end">
                <ShieldCheck className="w-3.5 h-3.5" /> drive.file least-privilege active
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main 250 GB Quota Progress Gauge */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-white/80 to-stone-50/50 dark:from-zinc-900/80 dark:to-zinc-950/50 backdrop-blur-xl border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500 dark:text-zinc-400">
              OURSPACE Dedicated Application Quota
            </span>
            <div className="text-4xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
              {formatDecimalBytes(usedBytes)}{' '}
              <span className="text-xl font-normal text-stone-500 dark:text-zinc-400">
                / {formatDecimalBytes(maxBytes)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xl font-bold text-stone-900 dark:text-zinc-100">{percentage}%</span>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              {formatDecimalBytes(Math.max(0, maxBytes - usedBytes))} remaining
            </p>
          </div>
        </div>

        {/* Progress Bar with 150 GB and 200 GB threshold markers */}
        <div className="relative w-full h-4 bg-stone-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Threshold Markers */}
        <div className="flex justify-between text-xs text-stone-400 dark:text-zinc-500 px-1">
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

      {/* Category Usage Breakdown */}
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
