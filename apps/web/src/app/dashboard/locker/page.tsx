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
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLockerStore } from '@/store/useLockerStore';
import type { LockerSection } from '@ourspace/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const SECTIONS: { id: LockerSection; label: string; icon: any; countKey?: string }[] = [
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
    loadVaultMetadata,
    setupLocker,
    unlockLocker,
    lockLocker,
    setSelectedSection,
    setSearchQuery,
    createLockerItem,
    deleteLockerItem,
    toggleFavourite,
    toggleArchive,
    exportDecryptedVault,
    resetAndEraseLocker,
  } = useLockerStore();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);

  // New Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [extraSecret, setExtraSecret] = useState('');

  // Reset Wipe Modal
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadVaultMetadata(user.id);
    }
  }, [user?.id, loadVaultMetadata]);

  const handleUnlockOrSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !user?.id) return;
    setErrorMessage('');

    if (!isConfigured || isSetupMode) {
      if (password.length < 8) {
        setErrorMessage('Vault master password must be at least 8 characters.');
        return;
      }
      const ok = await setupLocker(user.id, password);
      if (ok) {
        setPassword('');
        setIsSetupMode(false);
      } else {
        setErrorMessage('Could not initialize locker key hierarchy.');
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

    await createLockerItem(user.id, {
      section: selectedSection,
      title: itemTitle.trim(),
      payload: {
        body: itemContent.trim(),
        secret: extraSecret.trim() || undefined,
        createdAt: new Date().toISOString(),
      },
    });

    setItemTitle('');
    setItemContent('');
    setExtraSecret('');
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
    if (item.section !== selectedSection) return false;
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
          {/* Subtle Ambient Glow */}
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
              ? 'Zero-Knowledge Encrypted Sanctuary. AES-GCM 256-bit.'
              : 'Set a master password to initialize your client-side cryptographic key.'}
          </p>

          <form onSubmit={handleUnlockOrSetup} className="flex flex-col gap-4 text-left">
            <div className="relative">
              <Input
                label={isConfigured && !isSetupMode ? 'Master Vault Password' : 'New Master Password'}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter private key password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isProcessing}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {isConfigured && !isSetupMode ? 'Unlock Secure Vault' : 'Initialize Vault Key'}
            </Button>
          </form>

          {/* Destructive Reset Route */}
          {isConfigured && (
            <div className="mt-8 pt-4 border-t border-rose-100/60 dark:border-zinc-800 text-center">
              <button
                onClick={() => setIsWipeModalOpen(true)}
                className="text-[11px] font-semibold text-rose-500 hover:text-red-600 hover:underline transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Forgot password? Reset Locker & Erase All Data</span>
              </button>
            </div>
          )}
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
                  This action will permanently delete all information stored in your locker. Existing encrypted
                  files, private documents, photographs, and records will become unrecoverable. You cannot undo this
                  operation.
                </p>
              </div>
            </div>

            <p>
              To confirm that you want to permanently erase your encrypted locker, please type{' '}
              <strong className="text-red-600">DELETE MY LOCKER</strong> below:
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
                AES-GCM 256 Decrypted
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Session key held in memory. Auto-locks after 5 minutes of inactivity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            const isSelected = selectedSection === sec.id;
            const count = items.filter((i) => i.section === sec.id).length;
            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSection(sec.id)}
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

          <div className="mt-4 pt-3 border-t border-rose-100/60 dark:border-zinc-800 px-1">
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
          {/* Search bar inside section */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${SECTIONS.find((s) => s.id === selectedSection)?.label}...`}
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
                No items in {SECTIONS.find((s) => s.id === selectedSection)?.label}
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Keep sensitive notes, private credentials, or love letters securely encrypted.
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
                    <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100 truncate">
                      {item.title}
                    </h4>
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

      {/* New Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={`New Secret ${SECTIONS.find((s) => s.id === selectedSection)?.label}`}
      >
        <form onSubmit={handleCreateItem} className="flex flex-col gap-4 text-xs">
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

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
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
                This action will permanently delete all information stored in your locker. Existing encrypted
                files, private documents, photographs, and records will become unrecoverable. You cannot undo this
                operation.
              </p>
            </div>
          </div>

          <p>
            To confirm that you want to permanently erase your encrypted locker, please type{' '}
            <strong className="text-red-600">DELETE MY LOCKER</strong> below:
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
