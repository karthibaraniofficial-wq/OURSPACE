// ========================================================================
// OURSPACE: Shared Utilities, Date Calculations, Sound Synthesis & Presets
// ========================================================================

/**
 * Calculates number of days a couple has been together.
 */
export function calculateDaysTogether(startDateStr: string | null | undefined): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const now = new Date();
  if (isNaN(start.getTime())) return 0;
  const diffTime = Math.max(0, now.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates remaining days, hours, and minutes until a future date.
 */
export function getCountdown(targetDateStr: string | null | undefined): {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
} {
  if (!targetDateStr) return { days: 0, hours: 0, minutes: 0, isPast: false };
  const target = new Date(targetDateStr);
  const now = new Date();
  if (isNaN(target.getTime())) return { days: 0, hours: 0, minutes: 0, isPast: false };

  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, isPast: true };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, isPast: false };
}

/**
 * Formats a timestamp into a human-friendly relative or exact time string.
 */
export function formatChatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats file size in bytes to readable string.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ========================================================================
// Zero-Dependency Web Audio API Sound Synthesizer
// Guarantees reliable, zero-latency notification chimes across any browser
// ========================================================================

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export type ChimeProfile =
  | 'soft-bell'
  | 'romantic-harp'
  | 'marimba-chime'
  | 'modern-ping'
  | 'subtle-pop'
  | 'call-ringtone';

export function playChime(profile: ChimeProfile = 'soft-bell'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (profile === 'soft-bell') {
      // Gentle dual sine chime (523Hz C5 and 659Hz E5)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.9);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 1.0);
      });
    } else if (profile === 'romantic-harp') {
      // Warm pentatonic arpeggio (C, D, E, G, A)
      const freqs = [523.25, 587.33, 659.25, 783.99, 880.0];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.06 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.85);
      });
    } else if (profile === 'marimba-chime') {
      // Percussive woody tone
      const freqs = [440, 554.37];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.2, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.5);
      });
    } else if (profile === 'modern-ping') {
      // Clean modern short chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.15); // E6

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } else if (profile === 'subtle-pop') {
      // Soft bubble pop for reactions/send
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } else if (profile === 'call-ringtone') {
      // Repeating dual-tone call pulse
      [440, 480].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);
      });
    }
  } catch (err) {
    console.warn('[Audio] Failed to synthesize chime:', err);
  }
}

// ========================================================================
// Theme Accent Color Palette Presets
// ========================================================================

export interface AccentColorPreset {
  id: string;
  name: string;
  hex: string;
  gradient: string;
  bgLight: string;
}

export const ACCENT_PRESETS: AccentColorPreset[] = [
  {
    id: 'rose',
    name: 'Rose Romance',
    hex: '#f43f5e',
    gradient: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50',
  },
  {
    id: 'lavender',
    name: 'Sweet Lavender',
    hex: '#8b5cf6',
    gradient: 'from-purple-500 to-indigo-500',
    bgLight: 'bg-purple-50',
  },
  {
    id: 'coral',
    name: 'Warm Sunset',
    hex: '#f97316',
    gradient: 'from-amber-500 to-orange-500',
    bgLight: 'bg-orange-50',
  },
  {
    id: 'emerald',
    name: 'Serene Meadow',
    hex: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50',
  },
  {
    id: 'celestial',
    name: 'Celestial Blue',
    hex: '#0ea5e9',
    gradient: 'from-sky-500 to-blue-500',
    bgLight: 'bg-sky-50',
  },
];

/**
 * Determines whether a user or partner is currently online.
 * Considers both explicit connection flags and a 3-minute heartbeat window.
 */
export function isUserOnline(
  lastSeenOrUpdated?: string | null,
  isOnlineExplicit?: boolean
): boolean {
  if (isOnlineExplicit === false) return false;
  if (!lastSeenOrUpdated) return false;
  const lastActiveMs = new Date(lastSeenOrUpdated).getTime();
  if (isNaN(lastActiveMs)) return false;
  // Active if heartbeat pinged within 3 minutes
  return Date.now() - lastActiveMs < 3 * 60 * 1000;
}

/**
 * Formats a friendly presence label ('Active now', 'Just now', '5m ago', '2h ago', 'Offline')
 */
export function formatPresenceStatus(
  lastSeenOrUpdated?: string | null,
  isOnlineExplicit?: boolean
): { isOnline: boolean; label: string } {
  if (!lastSeenOrUpdated && isOnlineExplicit === undefined) {
    return { isOnline: false, label: 'Offline' };
  }
  const online = isUserOnline(lastSeenOrUpdated, isOnlineExplicit);
  if (online) {
    return { isOnline: true, label: 'Active now' };
  }
  if (!lastSeenOrUpdated) {
    return { isOnline: false, label: 'Offline' };
  }
  const lastActiveMs = new Date(lastSeenOrUpdated).getTime();
  if (isNaN(lastActiveMs)) {
    return { isOnline: false, label: 'Offline' };
  }
  const diffMins = Math.floor((Date.now() - lastActiveMs) / (60 * 1000));
  if (diffMins < 1) return { isOnline: false, label: 'Just now' };
  if (diffMins < 60) return { isOnline: false, label: `${diffMins}m ago` };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { isOnline: false, label: `${diffHours}h ago` };
  return { isOnline: false, label: 'Offline' };
}

// ========================================================================
// CENTRAL GOOGLE DRIVE FOLDER STRUCTURE & 250 GB QUOTA HELPERS
// ========================================================================

export const MAX_OURSPACE_STORAGE_BYTES = 250_000_000_000; // 250 GB
export const STORAGE_WARNING_BYTES = 150_000_000_000; // 150 GB Warning
export const STORAGE_CRITICAL_BYTES = 200_000_000_000; // 200 GB Critical

export function getStorageWarningLevel(
  usedBytes: number,
  maxBytes: number = MAX_OURSPACE_STORAGE_BYTES
): 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED' {
  if (usedBytes >= maxBytes) return 'EXCEEDED';
  if (usedBytes >= STORAGE_CRITICAL_BYTES) return 'CRITICAL';
  if (usedBytes >= STORAGE_WARNING_BYTES) return 'WARNING';
  return 'NORMAL';
}

export function formatDecimalBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / 1_000_000_000;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_000_000;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1_000;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * Returns canonical folder path under OURSPACE_STORAGE/ in Google Drive.
 * Guarantees opaque IDs with zero personal names, emails, or captions.
 */
export function getDriveFolderPath(
  category: string,
  spaceId?: string | null,
  userId?: string | null
): string[] {
  const normCat = category.toUpperCase().trim();

  // 1. Private Locker subfolders
  if (
    normCat === 'ENCRYPTED_IMAGES' ||
    normCat === 'ENCRYPTED_VIDEOS' ||
    normCat === 'ENCRYPTED_DOCUMENTS' ||
    normCat === 'ENCRYPTED_AUDIO' ||
    normCat === 'ENCRYPTED_METADATA'
  ) {
    const userFolder = userId ? `user_${userId.replace(/[^a-zA-Z0-9_-]/g, '')}` : 'unknown_user';
    return ['OURSPACE_STORAGE', 'PRIVATE_LOCKER', userFolder, normCat];
  }

  // 2. App backups subfolders
  if (normCat === 'METADATA_EXPORTS' || normCat === 'RECOVERY_RECORDS') {
    return ['OURSPACE_STORAGE', 'APP_BACKUPS', normCat];
  }

  // 3. Shared Media subfolders (mapped to spaceId)
  const opaqueSpace = spaceId ? `space_${spaceId.replace(/[^a-zA-Z0-9_-]/g, '')}` : 'shared';
  let targetFolder = 'CHAT_IMAGES';
  if (normCat.includes('VIDEO')) targetFolder = 'CHAT_VIDEOS';
  else if (normCat.includes('VOICE') || normCat.includes('AUDIO')) targetFolder = 'VOICE_NOTES';
  else if (normCat.includes('DOC')) targetFolder = 'DOCUMENTS';
  else if (normCat.includes('PROFILE') || normCat.includes('AVATAR')) targetFolder = 'PROFILE_PHOTOS';
  else if (normCat.includes('STATUS')) targetFolder = 'STATUS_MEDIA';
  else if (normCat.includes('ALBUM') || normCat.includes('MEMORY')) targetFolder = 'MEMORY_ALBUMS';
  else if (normCat.includes('THUMB')) targetFolder = 'THUMBNAILS';

  return ['OURSPACE_STORAGE', 'SHARED_MEDIA', opaqueSpace, targetFolder];
}


