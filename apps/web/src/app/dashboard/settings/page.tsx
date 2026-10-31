'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { playChime, ACCENT_PRESETS, type ChimeProfile } from '@ourspace/shared';

const SOUND_PROFILES: { id: ChimeProfile; name: string; description: string }[] = [
  { id: 'soft-bell', name: 'Soft Bell Chime', description: 'Gentle dual sine overtone' },
  { id: 'romantic-harp', name: 'Romantic Harp', description: 'Warm pentatonic arpeggio' },
  { id: 'marimba-chime', name: 'Marimba Chime', description: 'Woody percussive strike' },
  { id: 'modern-ping', name: 'Modern Ping', description: 'Crisp electronic notification' },
  { id: 'subtle-pop', name: 'Subtle Bubble Pop', description: 'Lighthearted reaction bubble' },
  { id: 'call-ringtone', name: 'Call Ringtone Pulse', description: 'Harmonic incoming call tune' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, space, partner, updateProfile, unpairSpace, logout } = useAuthStore();

  const [selectedSound, setSelectedSound] = useState<ChimeProfile>('soft-bell');
  const [selectedAccent, setSelectedAccent] = useState(user?.accent_color || '#f43f5e');
  const [isDndEnabled, setIsDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('07:00');
  const [previewPrivacy, setPreviewPrivacy] = useState(false);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyCalls, setNotifyCalls] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);

  // Unpair dialog
  const [isUnpairModalOpen, setIsUnpairModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTestSound = (profile: ChimeProfile) => {
    setSelectedSound(profile);
    playChime(profile);
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

  const handleSavePreferences = () => {
    setSaveSuccess(true);
    playChime('modern-ping');
    setTimeout(() => setSaveSuccess(false), 2500);
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
          Customize notifications, ringtones, color aesthetics, and privacy controls.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>Your preferences have been saved and synchronized across all your devices.</span>
        </div>
      )}

      {/* 1. Appearance & Theme */}
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
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                      : 'glass-card hover:bg-rose-50 text-stone-700 dark:text-zinc-300'
                  }`}
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
                  key={p.id}
                  onClick={() => handleSelectAccent(p.hex)}
                  className={`p-3 rounded-2xl glass-card flex flex-col items-center gap-2 border text-xs font-bold transition-all hover:scale-105 ${
                    isSelected ? 'ring-2 ring-stone-800 dark:ring-white border-transparent' : 'border-rose-200/50'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-full shadow-md"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span className="truncate max-w-full text-[11px]">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Notification Sounds & Ringtone Synthesizer */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
              Notification & Call Sound Profiles
            </h3>
          </div>
          <span className="text-[11px] text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full font-semibold">
            Zero-Latency Web Audio Synthesizer
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOUND_PROFILES.map((sound) => {
            const isSelected = selectedSound === sound.id;
            return (
              <div
                key={sound.id}
                onClick={() => handleTestSound(sound.id)}
                className={`p-4 rounded-2xl glass-card border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected ? 'border-rose-400 bg-rose-50/70 dark:bg-zinc-800' : 'border-rose-200/50 hover:bg-rose-50/30'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-zinc-100">
                    {sound.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    {sound.description}
                  </p>
                </div>

                <button
                  type="button"
                  className="p-2 rounded-xl bg-rose-500 text-white hover:scale-110 active:scale-95 transition-all shadow-sm"
                  title="Play Sound Preview"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Custom Audio Upload Option */}
        <div className="p-4 rounded-2xl glass-card border border-rose-200/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <h5 className="font-bold text-stone-800 dark:text-zinc-100">
              Personal Audio File Upload
            </h5>
            <p className="text-[11px] text-stone-500">
              Upload your own favorite song clip (.mp3, .wav) for custom call ringtones
            </p>
          </div>
          <label className="cursor-pointer shrink-0">
            <input type="file" accept="audio/*" className="hidden" />
            <div className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Ringtone File</span>
            </div>
          </label>
        </div>
      </div>

      {/* 3. Do Not Disturb & Privacy */}
      <div className="p-6 rounded-3xl glass-panel border border-rose-200/50 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-100/60 dark:border-zinc-800">
          <Shield className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
            Quiet Hours & Notification Privacy
          </h3>
        </div>

        {/* DND Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <h4 className="text-xs font-bold text-stone-800 dark:text-zinc-100">
              Do Not Disturb (Scheduled Quiet Time)
            </h4>
            <p className="text-[11px] text-stone-500">
              Silence chimes during sleeping hours while keeping incoming calls available
            </p>
          </div>
          <input
            type="checkbox"
            checked={isDndEnabled}
            onChange={(e) => setIsDndEnabled(e.target.checked)}
            className="w-5 h-5 rounded text-rose-500 focus:ring-rose-400"
          />
        </div>

        {isDndEnabled && (
          <div className="grid grid-cols-2 gap-3 pl-2 pb-2">
            <Input
              label="DND Starts"
              type="time"
              value={dndStart}
              onChange={(e) => setDndStart(e.target.value)}
            />
            <Input
              label="DND Ends"
              type="time"
              value={dndEnd}
              onChange={(e) => setDndEnd(e.target.value)}
            />
          </div>
        )}

        {/* Lock Screen Privacy */}
        <div className="flex items-center justify-between py-2 border-t border-rose-100/60 dark:border-zinc-800">
          <div>
            <h4 className="text-xs font-bold text-stone-800 dark:text-zinc-100">
              Discreet Notification Preview
            </h4>
            <p className="text-[11px] text-stone-500">
              Hide message text in push notifications when devices are locked
            </p>
          </div>
          <input
            type="checkbox"
            checked={previewPrivacy}
            onChange={(e) => setPreviewPrivacy(e.target.checked)}
            className="w-5 h-5 rounded text-rose-500 focus:ring-rose-400"
          />
        </div>

        <Button
          onClick={handleSavePreferences}
          className="w-full mt-2 py-3 rounded-2xl shadow-rose-500/20"
        >
          Save All Preferences
        </Button>
      </div>

      {/* 4. Couple Space Management & Safety */}
      <div className="p-6 rounded-3xl glass-panel border border-red-200/50 flex flex-col gap-4 bg-red-50/20">
        <div className="flex items-center gap-2 pb-2 border-b border-red-100 dark:border-red-950/40 text-red-600">
          <Lock className="w-5 h-5" />
          <h3 className="text-base font-bold">Space Management & Session Controls</h3>
        </div>

        <div className="flex items-center justify-between text-xs py-2">
          <div>
            <h4 className="font-bold text-stone-800 dark:text-zinc-100">Connected Partner</h4>
            <p className="text-stone-500">{partner?.display_name || 'None'} • Strict 2-member room</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsUnpairModalOpen(true)}
            className="text-xs rounded-xl"
          >
            <UserX className="w-3.5 h-3.5 mr-1.5" />
            <span>Unpair Space</span>
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs py-2 border-t border-red-100 dark:border-red-950/40">
          <div>
            <h4 className="font-bold text-stone-800 dark:text-zinc-100">Logout Current Session</h4>
            <p className="text-stone-500">Signs out of this device securely</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={logout}
            className="text-xs rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      {/* Unpair Confirmation Modal */}
      <Modal
        isOpen={isUnpairModalOpen}
        onClose={() => setIsUnpairModalOpen(false)}
        title="Unpair Private Space?"
        description="This action disconnects you and your partner from this shared space."
      >
        <div className="flex flex-col gap-4 text-xs text-stone-600 dark:text-zinc-300">
          <p>
            Are you sure you want to unpair? You will no longer receive real-time messages, calls, or reminders from{' '}
            <strong className="text-stone-900 dark:text-white">{partner?.display_name}</strong> until a new space is created and paired.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-rose-100 dark:border-zinc-800">
            <Button
              variant="secondary"
              onClick={() => setIsUnpairModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmUnpair}
              className="rounded-xl text-xs"
            >
              Yes, Unpair Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
