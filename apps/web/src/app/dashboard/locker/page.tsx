'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  FileText,
  CreditCard,
  FolderLock,
  Calendar,
  Bookmark,
  Mail,
  Plane,
  HeartPulse,
  Camera,
  Star,
  Archive,
  Download,
  AlertTriangle,
  Search,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  HardDrive,
  Cloud,
  CheckCircle2,
  Copy,
  Check,
  Paperclip,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLockerStore } from '@/store/useLockerStore';
import type { LockerSection } from '@ourspace/types';
import { formatBytes } from '@ourspace/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const SECTIONS: { id: LockerSection | 'all'; label: string; icon: any; countKey?: string }[] = [
  { id: 'all', label: 'All Stored Items', icon: Star },
  { id: 'notes', label: 'Private Notes', icon: FileText },
  { id: 'personal_details', label: 'Personal Details', icon: CreditCard },
  { id: 'documents', label: 'Private Documents', icon: FolderLock },
  { id: 'important_dates', label: 'Important Dates', icon: Calendar },
  { id: 'saved_info', label: 'Saved Information', icon: Bookmark },
  { id: 'letters', label: 'Personal Letters', icon: Mail },
  { id: 'travel', label: 'Travel Information', icon: Plane },
  { id: 'emergency', label: 'Emergency Info', icon: HeartPulse },
  { id: 'photos', label: 'Private Photographs', icon: Camera },
  { id: 'custom', label: 'Custom Folders', icon: Lock },
];

export default function LockerPage() {
  const { user } = useAuthStore();
  const {
    isConfigured,
    isUnlocked,
    items,
    selectedSection,
    searchQuery,
    deletionState,
    deletionProgressMessage,
    isProcessing,
    vaultMetadata,
    backupStatus,
    lastBackupAt,
    lastGeneratedRecoveryKey,
    loadVaultMetadata,
    setupLocker,
    unlockLocker,
    unlockWithRecoveryKey,
    changeMasterPassword,
    lockLocker,
    setSelectedSection,
    setSearchQuery,
    createLockerItem,
    deleteLockerItem,
    toggleFavourite,
    toggleArchive,
    exportDecryptedVault,
    triggerEncryptedBackup,
    restoreFromBackup,
    verifyCurrentBackup,
    resetAndEraseLocker,
  } = useLockerStore();

  const [activeCategory, setActiveCategory] = useState<LockerSection | 'all'>('all');
  const [password, setPassword] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [isRecoveryUnlock, setIsRecoveryUnlock] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);

  // New Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemSection, setItemSection] = useState<LockerSection>('notes');
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [extraSecret, setExtraSecret] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [createItemError, setCreateItemError] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);

  // Backup Management Modal
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupActionMessage, setBackupActionMessage] = useState<string | null>(null);

  // Password Change Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentSecret, setCurrentSecret] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // Recovery Key Display Modal (Shown right after initial setup)
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);

  // Reset Wipe Modal
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  const handleLockerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('Locker attachment ceiling is 20MB.');
      return;
    }

    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl: reader.result as string,
      });
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      alert('Failed to read file.');
      setIsReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (user?.id) {
      loadVaultMetadata(user.id);
    }
  }, [user?.id, loadVaultMetadata]);

  const handleUnlockOrSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setErrorMessage('');

    if (isRecoveryUnlock) {
      if (!recoveryKeyInput.trim()) return;
      const res = await unlockWithRecoveryKey(user.id, recoveryKeyInput.trim());
      if (res.success) {
        setRecoveryKeyInput('');
        setIsRecoveryUnlock(false);
      } else {
        setErrorMessage(res.error || 'Invalid recovery key.');
      }
      return;
    }

    if (!password.trim()) return;

    if (!isConfigured || isSetupMode) {
      if (password.length < 8) {
        setErrorMessage('Vault master password must be at least 8 characters.');
        return;
      }
      const res = await setupLocker(user.id, password);
      if (res.success) {
        setPassword('');
        setIsSetupMode(false);
        if (res.recoveryKey) {
          setIsRecoveryModalOpen(true);
        }
      } else {
        setErrorMessage(res.error || 'Could not initialize locker key hierarchy.');
      }
    } else {
      const res = await unlockLocker(user.id, password);
      if (res.success) {
        setPassword('');
      } else {
        setErrorMessage(res.error || 'Access denied.');
      }
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !user?.id) return;
    setCreateItemError('');
    setIsSavingItem(true);

    const sectionToUse: LockerSection = itemSection || (activeCategory === 'all' ? 'notes' : activeCategory);

    const res = await createLockerItem(user.id, {
      section: sectionToUse,
      title: itemTitle.trim(),
      payload: {
        body: itemContent.trim(),
        secret: extraSecret.trim() || undefined,
        file: attachedFile || undefined,
        createdAt: new Date().toISOString(),
      },
    });

    setIsSavingItem(false);
    if (!res.success) {
      setCreateItemError(res.error || 'Failed to encrypt and store item in vault.');
      return;
    }

    setItemTitle('');
    setItemContent('');
    setExtraSecret('');
    setAttachedFile(null);
    setIsItemModalOpen(false);
  };

  const handleExport = () => {
    const json = exportDecryptedVault();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OURSPACE_VAULT_DECRYPTED_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerBackup = async () => {
    if (!user?.id) return;
    setBackupActionMessage('Creating client-side encrypted backup bundle...');
    const res = await triggerEncryptedBackup(user.id);
    if (res.success) {
      setBackupActionMessage(`Encrypted backup created & verified with SHA-256 hash.`);
    } else {
      setBackupActionMessage(`Backup failed: ${res.error}`);
    }
  };

  const handleVerifyBackup = async () => {
    if (!user?.id) return;
    setBackupActionMessage('Verifying ciphertext authenticity and SHA-256 hashes...');
    const res = await verifyCurrentBackup(user.id);
    if (res.success && res.isVerified) {
      setBackupActionMessage('All ciphertext items matched their SHA-256 manifest hash.');
    } else {
      setBackupActionMessage(`Verification failed: ${res.error || 'Mismatch detected'}`);
    }
  };

  const handleRestoreBackup = async () => {
    if (!user?.id) return;
    setBackupActionMessage('Restoring and decrypting backup items locally...');
    const res = await restoreFromBackup(user.id);
    if (res.success) {
      setBackupActionMessage(`Restored ${res.itemCount} items from encrypted cloud backup.`);
    } else {
      setBackupActionMessage(`Restore failed: ${res.error}`);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setPasswordChangeError('');

    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    const res = await changeMasterPassword(user.id, currentSecret, newPassword);
    if (res.success) {
      setPasswordChangeSuccess(true);
      setCurrentSecret('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordChangeSuccess(false);
      }, 1800);
    } else {
      setPasswordChangeError(res.error || 'Password change failed.');
    }
  };

  const handleExecuteWipe = async () => {
    if (!user?.id) return;
    const res = await resetAndEraseLocker(user.id, wipeConfirmText);
    if (res.success) {
      setIsWipeModalOpen(false);
      setWipeConfirmText('');
      setIsSetupMode(true);
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeCategory !== 'all' && item.section !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inBody = JSON.stringify(item.payload).toLowerCase().includes(q);
      return inTitle || inBody;
    }
    return true;
  });

  // ========================================================================
  // RENDER: LOCKED / SETUP SCREEN
  // ========================================================================
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-auto min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-full glass-card rounded-3xl p-8 border border-rose-200/60 dark:border-purple-900/40 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-400/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />

          {/* Vault Icon with Pulse */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-600 flex items-center justify-center text-white mx-auto mb-5 shadow-lg shadow-rose-500/30">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100">
            {isConfigured && !isSetupMode ? 'OUR LOCKER' : 'Create Private Vault'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 mb-6">
            {isConfigured && !isSetupMode
              ? 'Zero-Knowledge Encrypted Sanctuary. AES-GCM 256-bit with Google Drive Backup.'
              : 'Set a master password to initialize your client-side cryptographic key.'}
          </p>

          <form onSubmit={handleUnlockOrSetup} className="flex flex-col gap-4 text-left">
            {isRecoveryUnlock ? (
              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-zinc-300">
                  Enter 256-Bit Recovery Key
                </label>
                <Input
                  type="text"
                  placeholder="RCV-XXXX-XXXX-XXXX-..."
                  value={recoveryKeyInput}
                  onChange={(e) => setRecoveryKeyInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-zinc-300">
                  {isConfigured && !isSetupMode ? 'Master Vault Password' : 'New Master Password (min 8 chars)'}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-stone-400 hover:text-rose-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isProcessing}
            >
              {isRecoveryUnlock
                ? 'Unlock with Recovery Key'
                : isConfigured && !isSetupMode
                ? 'Unlock Vault'
                : 'Initialize Encrypted Locker'}
            </Button>

            {isConfigured && !isSetupMode && (
              <div className="flex items-center justify-between pt-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveryUnlock(!isRecoveryUnlock);
                    setErrorMessage('');
                  }}
                  className="text-rose-500 hover:underline font-semibold"
                >
                  {isRecoveryUnlock ? '← Use Master Password' : 'Lost Password? Use Recovery Key'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(true)}
                  className="text-stone-400 hover:text-red-500 transition-colors"
                >
                  Reset Vault
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Wipe Modal */}
        <Modal
          isOpen={isWipeModalOpen}
          onClose={() => setIsWipeModalOpen(false)}
          title="RESET LOCKER & ERASE ALL DATA"
        >
          <div className="flex flex-col gap-4 text-xs text-stone-600 dark:text-zinc-300">
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
              <div>
                <p className="font-bold">Irreversible Destructive Operation</p>
                <p className="mt-1">
                  This action will permanently delete all information stored in your locker and all Google Drive
                  encrypted backup snapshots.
                </p>
              </div>
            </div>

            <p>
              To confirm, type <strong className="text-red-600">DELETE MY LOCKER</strong> below:
            </p>

            <Input
              placeholder="DELETE MY LOCKER"
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
            />

            {deletionProgressMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 font-medium">
                {deletionProgressMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsWipeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={wipeConfirmText !== 'DELETE MY LOCKER' || isProcessing}
                isLoading={isProcessing}
                onClick={handleExecuteWipe}
              >
                Erase All & Reset Key
              </Button>
            </div>
          </div>
        </Modal>

        {/* Recovery Key Display Modal */}
        <Modal
          isOpen={isRecoveryModalOpen}
          onClose={() => {
            if (recoveryConfirmed) setIsRecoveryModalOpen(false);
          }}
          title="YOUR LOCKER RECOVERY KEY"
        >
          <div className="flex flex-col gap-4 text-xs text-stone-700 dark:text-zinc-200">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Save This Key Offline</p>
                <p className="mt-0.5">
                  OURSPACE uses zero-knowledge encryption. If you lose your master password, this 256-bit recovery
                  key is the <strong>only way</strong> to restore your encrypted locker.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-900 text-rose-400 font-mono text-sm tracking-wider text-center select-all break-all border border-rose-500/30">
              {lastGeneratedRecoveryKey}
            </div>

            <button
              type="button"
              onClick={() => {
                if (lastGeneratedRecoveryKey) {
                  navigator.clipboard.writeText(lastGeneratedRecoveryKey);
                  setCopiedRecoveryKey(true);
                  setTimeout(() => setCopiedRecoveryKey(false), 2500);
                }
              }}
              className="py-2.5 px-4 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {copiedRecoveryKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedRecoveryKey ? 'Copied to Clipboard!' : 'Copy Recovery Key'}</span>
            </button>

            <label className="flex items-center gap-2 text-xs cursor-pointer select-none mt-2">
              <input
                type="checkbox"
                checked={recoveryConfirmed}
                onChange={(e) => setRecoveryConfirmed(e.target.checked)}
                className="rounded border-rose-300 text-rose-500 focus:ring-rose-400"
              />
              <span>I have securely saved my recovery key in a safe place.</span>
            </label>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                disabled={!recoveryConfirmed}
                onClick={() => setIsRecoveryModalOpen(false)}
              >
                Proceed to Locker
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ========================================================================
  // RENDER: UNLOCKED VAULT EXPERIENCE
  // ========================================================================
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Vault Status Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl glass-card border border-rose-200/60 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Unlock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-stone-900 dark:text-zinc-100">
                OUR LOCKER
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                AES-GCM 256 Active
              </span>
              {backupStatus === 'VERIFIED' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-purple-600" />
                  Drive Verified
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Session key held in memory. Auto-locks after 5 minutes of inactivity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsBackupModalOpen(true)}
            title="Google Drive Cloud Encrypted Backup"
          >
            <Cloud className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
            Cloud Backup
          </Button>

          <Button variant="secondary" size="sm" onClick={handleExport} title="Download Decrypted JSON">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Data
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsItemModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Secret Item
          </Button>

          <Button variant="ghost" size="sm" onClick={lockLocker} title="Lock Vault">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-stone-600" />
            Lock Now
          </Button>
        </div>
      </div>

      {/* Main Vault Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sections Sidebar */}
        <div className="flex flex-col gap-1.5 glass-panel p-3 rounded-3xl border border-rose-200/50">
          <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider px-3 py-1">
            Vault Categories
          </span>
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isSelected = activeCategory === sec.id;
            const count = sec.id === 'all' ? items.length : items.filter((i) => i.section === sec.id).length;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveCategory(sec.id)}
                className={cn(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all',
                  isSelected
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md'
                    : 'text-stone-600 dark:text-zinc-300 hover:bg-rose-50/80 dark:hover:bg-zinc-800'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{sec.label}</span>
                </div>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px]',
                    isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div className="mt-4 pt-3 border-t border-rose-100/60 dark:border-zinc-800 px-1 flex flex-col gap-1">
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="w-full text-left text-[11px] font-semibold text-stone-600 dark:text-zinc-300 hover:text-rose-600 py-1.5 px-2 rounded-xl hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Master Password</span>
            </button>

            <button
              onClick={() => setIsWipeModalOpen(true)}
              className="w-full text-left text-[11px] font-bold text-red-500 hover:text-red-700 py-1.5 px-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset & Wipe Locker</span>
            </button>
          </div>
        </div>

        {/* Section Items Grid */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${SECTIONS.find((s) => s.id === activeCategory)?.label || 'All Items'}...`}
                className="w-full rounded-2xl glass-input pl-10 pr-4 py-2 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center rounded-3xl glass-card border border-rose-200/50 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                <FolderLock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                No items in {SECTIONS.find((s) => s.id === activeCategory)?.label || 'All Items'}
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Keep sensitive notes, private credentials, photos, videos, or love letters securely encrypted.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setIsItemModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Encrypted Item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl p-5 glass-card border border-rose-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                        {SECTIONS.find((s) => s.id === item.section)?.label || item.section}
                      </span>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100 truncate mt-0.5">
                        {item.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => user?.id && toggleFavourite(user.id, item.id)}
                        className="text-stone-400 hover:text-amber-500 p-1"
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5',
                            item.is_favourite && 'fill-amber-400 text-amber-500'
                          )}
                        />
                      </button>
                      <button
                        onClick={() => user?.id && deleteLockerItem(user.id, item.id)}
                        className="text-stone-400 hover:text-red-500 p-1"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-zinc-300 whitespace-pre-wrap line-clamp-4 leading-relaxed mb-3">
                    {item.payload.body}
                  </p>

                  {item.payload.file && (
                    <div className="mb-3">
                      {item.payload.file.type?.startsWith('image/') || item.section === 'photos' ? (
                        <div className="relative rounded-2xl overflow-hidden border border-rose-200/80 mb-2">
                          <img
                            src={item.payload.file.dataUrl}
                            alt={item.title}
                            className="w-full max-h-56 object-cover"
                          />
                        </div>
                      ) : item.payload.file.type?.startsWith('video/') ? (
                        <div className="relative rounded-2xl overflow-hidden border border-purple-200/80 mb-2">
                          <video
                            src={item.payload.file.dataUrl}
                            controls
                            className="w-full max-h-56 rounded-2xl"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/80 dark:bg-zinc-800 border border-rose-200/60 mb-2">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                            <span className="truncate text-xs font-semibold">{item.payload.file.name}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 shrink-0">
                            {formatBytes(item.payload.file.size)}
                          </span>
                        </div>
                      )}

                      <a
                        href={item.payload.file.dataUrl}
                        download={item.payload.file.name || 'locker_file'}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-zinc-800 text-rose-700 dark:text-zinc-200 text-[11px] font-bold transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Decrypted {item.payload.file.type?.startsWith('image/') ? 'Photo' : item.payload.file.type?.startsWith('video/') ? 'Video' : 'File'}</span>
                      </a>
                    </div>
                  )}

                  {item.payload.secret && (
                    <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/50 text-[11px] font-mono text-rose-700 dark:text-rose-300 break-all mb-2">
                      🔒 Secret: {item.payload.secret}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-stone-400 pt-2 border-t border-rose-100/40">
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    <span className="font-semibold text-emerald-600">Encrypted</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cloud Backup Management Modal */}
      <Modal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        title="GOOGLE DRIVE ENCRYPTED BACKUP"
      >
        <div className="flex flex-col gap-4 text-xs text-stone-700 dark:text-zinc-200">
          <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 flex items-start gap-3">
            <Cloud className="w-5 h-5 shrink-0 text-purple-600 mt-0.5" />
            <div>
              <p className="font-bold">Zero-Knowledge Cloud Backup</p>
              <p className="mt-0.5 leading-relaxed">
                Your locker is encrypted locally with AES-256-GCM before leaving this device. Google Drive and
                Firebase receive <strong>only ciphertext and opaque identifiers</strong>.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-stone-500">Target Folder:</span>
              <span className="text-stone-800 dark:text-zinc-200 font-bold truncate max-w-xs">
                OURSPACE_ARCHIVE/SECURE_LOCKER_BACKUPS/
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Backup Status:</span>
              <span className={cn('font-bold', backupStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600')}>
                {backupStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Last Verified Backup:</span>
              <span className="text-stone-800 dark:text-zinc-200">
                {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'No backup yet'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Encrypted Items in Vault:</span>
              <span className="text-stone-800 dark:text-zinc-200 font-bold">{items.length} items</span>
            </div>
          </div>

          {backupActionMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 font-medium">
              {backupActionMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerBackup}
              isLoading={isProcessing}
            >
              Back Up Now
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleVerifyBackup}
              isLoading={isProcessing}
            >
              Verify Integrity
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestoreBackup}
              isLoading={isProcessing}
            >
              Restore from Backup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        title="CHANGE MASTER VAULT PASSWORD"
      >
        <form onSubmit={handleChangePasswordSubmit} className="flex flex-col gap-4 text-xs">
          <p className="text-stone-500 dark:text-zinc-400">
            Re-wraps your 256-bit locker master key. Existing encrypted notes and backups remain valid without data loss.
          </p>

          <Input
            label="Current Master Password"
            type="password"
            placeholder="••••••••••••"
            value={currentSecret}
            onChange={(e) => setCurrentSecret(e.target.value)}
            required
          />

          <Input
            label="New Master Password (min 8 chars)"
            type="password"
            placeholder="••••••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Confirm New Master Password"
            type="password"
            placeholder="••••••••••••"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
          />

          {passwordChangeError && (
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
              {passwordChangeError}
            </div>
          )}

          {passwordChangeSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Password updated and master key re-wrapped successfully!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsChangePasswordOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isProcessing}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="New Encrypted Vault Item"
      >
        <form onSubmit={handleCreateItem} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-stone-700 dark:text-zinc-200">
              Vault Category
            </label>
            <select
              value={itemSection}
              onChange={(e) => setItemSection(e.target.value as LockerSection)}
              className="w-full rounded-2xl glass-input p-2.5 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none bg-white/80 dark:bg-zinc-900/80 border border-rose-200"
            >
              {SECTIONS.filter((s) => s.id !== 'all').map((s) => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-stone-800 dark:text-zinc-100">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Title / Identifier"
            placeholder="e.g. WiFi Password, Apartment Key Code, Private Letter"
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block font-semibold mb-1 text-stone-700 dark:text-zinc-200">
              Encrypted Content / Notes
            </label>
            <textarea
              rows={4}
              value={itemContent}
              onChange={(e) => setItemContent(e.target.value)}
              placeholder="Write your secret notes, letter, or sensitive details..."
              className="w-full rounded-2xl glass-input p-3 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
              required
            />
          </div>

          <Input
            label="Confidential Secret (Optional Code, PIN, Key)"
            placeholder="e.g. PIN 4821 or Passcode"
            value={extraSecret}
            onChange={(e) => setExtraSecret(e.target.value)}
          />

          {/* Optional Attachment Picker for Photos, Videos, and Files */}
          <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-zinc-800/50 border border-rose-200/60 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-stone-700 dark:text-zinc-200 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-rose-500" />
                <span>Attach Photo, Video, or File (Optional)</span>
              </label>
              {attachedFile && (
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {attachedFile ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-rose-200 text-xs">
                <div className="flex items-center gap-2 truncate">
                  {attachedFile.type.startsWith('image/') ? (
                    <ImageIcon className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : attachedFile.type.startsWith('video/') ? (
                    <Film className="w-4 h-4 text-purple-500 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className="truncate font-semibold">{attachedFile.name}</span>
                </div>
                <span className="text-[10px] text-stone-400 shrink-0">
                  {formatBytes(attachedFile.size)}
                </span>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*,video/*,application/pdf,application/msword,text/plain,application/zip"
                onChange={handleLockerFileSelect}
                disabled={isReadingFile}
                className="text-xs text-stone-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-rose-100 file:text-rose-700 hover:file:bg-rose-200 cursor-pointer"
              />
            )}
          </div>

          {createItemError && (
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs">
              {createItemError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isReadingFile || isSavingItem}
              isLoading={isSavingItem}
            >
              Encrypt & Save to Locker
            </Button>
          </div>
        </form>
      </Modal>

      {/* Wipe Modal */}
      <Modal
        isOpen={isWipeModalOpen}
        onClose={() => setIsWipeModalOpen(false)}
        title="RESET LOCKER & ERASE ALL DATA"
      >
        <div className="flex flex-col gap-4 text-xs text-stone-600 dark:text-zinc-300">
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Irreversible Destructive Operation</p>
              <p className="mt-1">
                Permanently deletes all locker items and Google Drive encrypted backups.
              </p>
            </div>
          </div>

          <p>
            Type <strong className="text-red-600">DELETE MY LOCKER</strong> below:
          </p>

          <Input
            placeholder="DELETE MY LOCKER"
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
          />

          {deletionProgressMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 font-medium">
              {deletionProgressMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsWipeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={wipeConfirmText !== 'DELETE MY LOCKER' || isProcessing}
              isLoading={isProcessing}
              onClick={handleExecuteWipe}
            >
              Erase All & Reset Key
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
