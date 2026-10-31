'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Bell,
  Volume2,
  Moon,
  Sun,
  Palette,
  Shield,
  Heart,
  VolumeX,
  Play,
  Upload,
  Lock,
  LogOut,
  UserX,
  Check,
  Sparkles,
  Camera,
  Trash2,
  RotateCw,
  ZoomIn,
  Smile,
  Eye,
  EyeOff,
  User,
  HeartPulse,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { playChime, ACCENT_PRESETS, type ChimeProfile } from '@ourspace/shared';
import { cn } from '@/lib/utils';
import { uploadProfilePictureToStorage } from '@/lib/firebase/storage';
import { isFirebaseConfigured } from '@/lib/firebase/firebase';


const SOUND_PROFILES: { id: ChimeProfile; name: string; description: string }[] = [
  { id: 'soft-bell', name: 'Soft Bell Chime', description: 'Gentle dual sine overtone' },
  { id: 'romantic-harp', name: 'Romantic Harp', description: 'Warm pentatonic arpeggio' },
  { id: 'marimba-chime', name: 'Marimba Chime', description: 'Woody percussive strike' },
  { id: 'modern-ping', name: 'Modern Ping', description: 'Crisp electronic notification' },
  { id: 'subtle-pop', name: 'Subtle Bubble Pop', description: 'Lighthearted reaction bubble' },
  { id: 'call-ringtone', name: 'Call Ringtone Pulse', description: 'Harmonic incoming call tune' },
];

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jordan&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Love1&backgroundColor=ffd285',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Darling&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Honey&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Sweetheart&backgroundColor=ffdfbf',
];

const QUICK_STATUSES = [
  'Thinking of you 🌸',
  'At work, text me later! 💻',
  'Missing your hugs 🥺',
  'Can’t wait to see you tonight! ✨',
  'Studying / Reading 📚',
  'On my way to you 🚗',
  'Cozy in bed ☕',
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, space, partner, updateProfile, unpairSpace, logout } = useAuthStore();

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '');
  const [statusEmoji, setStatusEmoji] = useState(user?.status_emoji || '❤️');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [selectedAccent, setSelectedAccent] = useState(user?.accent_color || '#f43f5e');
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  // Avatar Upload State
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Sound & Notifications
  const [selectedSound, setSelectedSound] = useState<ChimeProfile>('soft-bell');
  const [isDndEnabled, setIsDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('07:00');
  const [previewPrivacy, setPreviewPrivacy] = useState(false);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyCalls, setNotifyCalls] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);

  // Unpair dialog & feedback
  const [isUnpairModalOpen, setIsUnpairModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTestSound = (profile: ChimeProfile) => {
    setSelectedSound(profile);
    playChime(profile);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';
    setAvatarError(null);

    // Validate MIME type
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (JPEG, PNG, WebP, etc.).');
      return;
    }

    // Validate size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('Profile picture must be under 10MB.');
      return;
    }

    if (!user?.id) {
      setAvatarError('You must be signed in to upload a profile picture.');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarUploadProgress(0);

    try {
      if (isFirebaseConfigured()) {
        const downloadUrl = await uploadProfilePictureToStorage(
          user.id,
          file,
          (pct) => setAvatarUploadProgress(pct)
        );
        setAvatarUrl(downloadUrl);
        await updateProfile({ avatar_url: downloadUrl });
        setSaveSuccess(true);
        playChime('soft-bell');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        // Fallback for local demo preview
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          setAvatarUrl(dataUrl);
          await updateProfile({ avatar_url: dataUrl });
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        };
        reader.readAsDataURL(file);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload profile picture. Please try again.';
      setAvatarError(msg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSelectAccent = (hex: string) => {
    setSelectedAccent(hex);
    updateProfile({ accent_color: hex });
    document.documentElement.style.setProperty('--accent-color', hex);
  };

  const handleThemeChange = (mode: 'light' | 'dark' | 'system') => {
    updateProfile({ theme_mode: mode });
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  };

  const handleSaveProfile = () => {
    updateProfile({
      display_name: displayName.trim() || user?.display_name || 'My Love',
      bio: bio.trim() || null,
      status_message: statusMessage.trim() || 'Connected with you',
      status_emoji: statusEmoji || null,
      avatar_url: avatarUrl || null,
      accent_color: selectedAccent,
    });

    setSaveSuccess(true);
    playChime('modern-ping');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearStatus = () => {
    setStatusMessage('');
    updateProfile({ status_message: 'Connected with you' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleConfirmUnpair = async () => {
    await unpairSpace();
    setIsUnpairModalOpen(false);
    router.replace('/pair');
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
          <span>Sanctuary Preferences</span>
          <Settings className="w-5 h-5 text-rose-500" />
        </h2>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
          Customize your profile identity, aesthetics, notification chimes, and privacy.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>Profile and preferences updated! Partner will immediately see changes.</span>
        </div>
      )}

      {avatarError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center justify-between gap-2 animate-in fade-in">
          <span>{avatarError}</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. PROFILE & IDENTITY CUSTOMIZATION */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-5">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <User className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
            Personal Identity & Profile
          </h3>
        </div>

        {/* Avatar Editor */}
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group">
            <div className="w-24 h-24 rounded-3xl overflow-hidden bg-rose-100 flex items-center justify-center ring-4 ring-rose-400/40 shadow-lg relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-3xl font-bold text-rose-500">
                  {displayName.charAt(0) || 'U'}
                </div>
              )}

              {/* Uploading Spinner Overlay */}
              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                  <RotateCw className="w-6 h-6 animate-spin text-rose-400" />
                  <span className="text-[10px] font-bold mt-1">{avatarUploadProgress}%</span>
                </div>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-rose-500 text-white shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              title="Upload photo"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
          </div>

          <div className="flex-1 flex flex-col gap-2 text-center sm:text-left">
            <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-100">
              Profile Photo & Illustrated Avatars
            </h4>
            <p className="text-xs text-stone-400">
              Upload your personal photograph or pick from illustrated romantic avatar presets.
            </p>

            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start pt-1">
              {PRESET_AVATARS.map((seedUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAvatarUrl(seedUrl);
                    updateProfile({ avatar_url: seedUrl });
                  }}
                  className="w-8 h-8 rounded-full overflow-hidden hover:scale-110 active:scale-95 transition-transform ring-2 ring-rose-200"
                >
                  <img src={seedUrl} alt="Avatar" className="w-full h-full object-cover" />
                </button>
              ))}

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('');
                    updateProfile({ avatar_url: null });
                  }}
                  className="text-[10px] text-red-500 hover:underline font-semibold ml-2"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Display Name & Bio Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name or nickname..."
          />

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700 dark:text-zinc-200">
                Status Message
              </label>
              {statusMessage && (
                <button
                  type="button"
                  onClick={handleClearStatus}
                  className="text-[10px] text-stone-400 hover:text-rose-500 underline"
                >
                  Clear Status
                </button>
              )}
            </div>
            <Input
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. Thinking of you 🌸"
            />
          </div>
        </div>

        {/* Status Emoji Selector & Quick Status Suggestions */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-stone-500">Status Emoji:</span>
            {['❤️', '☕', '🎧', '✨', '🌸', '✈️', '💤', '🍳'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setStatusEmoji(emoji)}
                className={cn(
                  'w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all',
                  statusEmoji === emoji
                    ? 'bg-rose-100 ring-2 ring-rose-400 scale-110'
                    : 'hover:bg-stone-100 dark:hover:bg-zinc-800'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          <label className="text-[11px] font-semibold text-stone-500">Quick Status Suggestions</label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_STATUSES.map((qs) => (
              <button
                key={qs}
                type="button"
                onClick={() => setStatusMessage(qs)}
                className="px-2.5 py-1 rounded-xl text-xs glass-card border border-rose-200/50 hover:bg-rose-50 text-stone-600 shrink-0"
              >
                {qs}
              </button>
            ))}
          </div>
        </div>


        {/* Short Biography */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-zinc-200 mb-1">
            Short Biography / Love Note
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short note or romantic quote..."
            className="w-full rounded-2xl glass-input p-3 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={handleSaveProfile}>
            Save Profile Identity
          </Button>
        </div>
      </div>

      {/* 2. APPEARANCE & THEME */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-5">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <Palette className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
            Appearance & Visual Theme
          </h3>
        </div>

        {/* Theme Mode Switch */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
            Theme Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Light First', icon: Sun },
              { id: 'dark', label: 'Night Velvet', icon: Moon },
              { id: 'system', label: 'System Default', icon: Sparkles },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = user?.theme_mode === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id as 'light' | 'dark' | 'system')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-bold transition-all',
                    isSelected
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                      : 'glass-card hover:bg-rose-50 text-stone-700 dark:text-zinc-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Accent Presets */}
        <div className="flex flex-col gap-2 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
            Couple Accent Palette
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {ACCENT_PRESETS.map((p) => {
              const isSelected = selectedAccent === p.hex;
              return (
                <button
                  key={p.hex}
                  onClick={() => handleSelectAccent(p.hex)}
                  className={cn(
                    'flex items-center gap-2.5 p-2.5 rounded-2xl glass-card border transition-all text-left',
                    isSelected
                      ? 'border-rose-500 shadow-md ring-2 ring-rose-400/30'
                      : 'border-rose-100/60 hover:bg-rose-50'
                  )}
                >
                  <span
                    className="w-5 h-5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span className="text-xs font-bold truncate text-stone-800 dark:text-zinc-200">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. SOUND CHIMES & NOTIFICATIONS */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-5">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <Volume2 className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
            Synthesized Chimes & Notifications
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOUND_PROFILES.map((sound) => {
            const isSelected = selectedSound === sound.id;
            return (
              <div
                key={sound.id}
                className={cn(
                  'p-4 rounded-2xl glass-card border flex items-center justify-between gap-3 transition-all',
                  isSelected
                    ? 'border-rose-400 shadow-sm bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-rose-100/60'
                )}
              >
                <div>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-zinc-100">
                    {sound.name}
                  </h4>
                  <p className="text-[10px] text-stone-400 mt-0.5">{sound.description}</p>
                </div>
                <button
                  onClick={() => handleTestSound(sound.id)}
                  className="p-2 rounded-xl bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors shrink-0"
                  title="Play tone sample"
                >
                  <Play className="w-3.5 h-3.5 fill-rose-600" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. PRIVACY, FOCUS & DND */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <Shield className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
            Privacy, Quiet Hours & Space Controls
          </h3>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-2xl glass-card border border-rose-100/60">
          <div>
            <h4 className="text-xs font-bold text-stone-800 dark:text-zinc-100">
              Notification Content Preview
            </h4>
            <p className="text-[10px] text-stone-400 mt-0.5">
              Hide message text in push notifications on lock screens.
            </p>
          </div>
          <input
            type="checkbox"
            checked={previewPrivacy}
            onChange={(e) => setPreviewPrivacy(e.target.checked)}
            className="w-4 h-4 accent-rose-500 cursor-pointer"
          />
        </div>

        {/* Space Unpairing */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl glass-card border border-red-200 bg-red-50/40 dark:bg-red-950/20 mt-2">
          <div>
            <h4 className="text-xs font-bold text-red-700 dark:text-red-300">
              Unpair Sanctuary Space
            </h4>
            <p className="text-[10px] text-red-500 mt-0.5">
              Disconnect from your partner. Both users will return to the pairing screen.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsUnpairModalOpen(true)}
          >
            <UserX className="w-3.5 h-3.5 mr-1" />
            Unpair
          </Button>
        </div>
      </div>

      {/* Unpair Confirmation Modal */}
      <Modal
        isOpen={isUnpairModalOpen}
        onClose={() => setIsUnpairModalOpen(false)}
        title="Unpair Private Sanctuary"
      >
        <div className="flex flex-col gap-4 text-xs text-stone-600 dark:text-zinc-300">
          <p>
            Are you sure you want to unpair from{' '}
            <strong>{partner?.display_name || 'your partner'}</strong>?
          </p>
          <p className="text-stone-400">
            This will release the private space association. All photos, memories, and messages
            remain preserved in Cloud Firestore until explicitly deleted.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsUnpairModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmUnpair}>
              Yes, Unpair Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
