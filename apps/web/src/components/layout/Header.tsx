'use client';

import React from 'react';
import { Phone, Video, Heart, Sparkles, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCallStore } from '@/store/useCallStore';
import { useNetworkStore } from '@/store/useNetworkStore';
import { Button } from '@/components/ui/Button';

export function Header() {
  const { user, space, partner, updateProfile } = useAuthStore();
  const { initiateCall } = useCallStore();
  const { connectionStatus, initializeNetworkListeners } = useNetworkStore();

  React.useEffect(() => {
    const cleanup = initializeNetworkListeners();
    return cleanup;
  }, [initializeNetworkListeners]);

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!space || !user || !partner) return;
    initiateCall({
      spaceId: space.id,
      caller: user,
      receiver: partner,
      type,
    });
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      updateProfile({ theme_mode: 'light' });
    } else {
      document.documentElement.classList.add('dark');
      updateProfile({ theme_mode: 'dark' });
    }
  };

  return (
    <header className="h-16 px-3 sm:px-6 glass-panel border-b border-rose-200/50 dark:border-purple-900/30 flex items-center justify-between z-30 shrink-0">
      {/* Space Status Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center font-bold">
          <Heart className="w-4 h-4 fill-rose-500" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-stone-800 dark:text-zinc-100 flex items-center gap-1.5">
            {space?.name || 'Our Space'}
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-stone-500 dark:text-zinc-400">
              {partner ? `Connected with ${partner.display_name}` : 'Awaiting partner to join'}
            </p>
            {/* Live Connection Status Pill */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500'
                    : connectionStatus === 'reconnecting'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              {connectionStatus === 'connected'
                ? 'Online'
                : connectionStatus === 'reconnecting'
                ? 'Reconnecting...'
                : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Calling & Theme Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title="Toggle Dark / Light Theme"
          className="p-2.5 rounded-full hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300 transition-colors"
        >
          <Sun className="w-4 h-4 hidden dark:block text-amber-400" />
          <Moon className="w-4 h-4 block dark:hidden text-stone-600" />
        </button>

        {partner && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleStartCall('audio')}
              className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Phone className="w-3.5 h-3.5 fill-rose-500/20" />
              <span className="hidden sm:inline">Audio Call</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStartCall('video')}
              className="gap-1.5 text-xs shadow-rose-500/20"
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Video Call</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
