'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Heart,
  MessageCircleHeart,
  Image as ImageIcon,
  PhoneCall,
  CalendarCheck,
  Sparkles,
  Settings,
  Users,
  BookOpen,
  Lock,
  Compass,
  Smile,
  LogOut,
  Radio,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCallStore } from '@/store/useCallStore';
import { cn } from '@/lib/utils';
import { calculateDaysTogether, isUserOnline, formatPresenceStatus } from '@ourspace/shared';


const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Heart },
  { href: '/dashboard/chat', label: 'Chats', icon: MessageCircleHeart },
  { href: '/dashboard/gallery', label: 'Gallery', icon: ImageIcon },
  { href: '/dashboard/albums', label: 'Albums', icon: BookOpen },
  { href: '/dashboard/calls', label: 'Calls', icon: PhoneCall },
  { href: '/dashboard/reminders', label: 'Reminders', icon: CalendarCheck },
  { href: '/dashboard/memories', label: 'Memories', icon: Sparkles },
  { href: '/dashboard/connect', label: 'Connection', icon: Smile },
  { href: '/dashboard/plans', label: 'Plans & Goals', icon: Compass },
  { href: '/dashboard/locker', label: 'OUR LOCKER', icon: Lock, isLocker: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, space, partner, logout, switchDemoUser } = useAuthStore();
  const { initiateCall } = useCallStore();

  const daysTogether = calculateDaysTogether(space?.couple_started_at);

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 h-full max-h-screen glass-panel border-r border-rose-200/50 dark:border-purple-900/30 p-3.5 select-none shrink-0 overflow-hidden justify-between">
      {/* Brand & Partner Header */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-500/25 group-hover:scale-105 transition-transform">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                OURSPACE
              </h1>
              <span className="text-[9px] uppercase font-bold tracking-widest text-rose-500/80">
                Private Sanctuary
              </span>
            </div>
          </Link>

          {/* Quick Demo Switcher */}
          <button
            onClick={() => switchDemoUser(user?.id.endsWith('1') ? 2 : 1)}
            title="Switch between User 1 (Alex) and User 2 (Jordan)"
            className="flex items-center gap-1 text-[10px] font-semibold text-rose-500 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200/60 transition-all hover:scale-105"
          >
            <Users className="w-3 h-3" />
            <span>Switch</span>
          </button>
        </div>

        {/* Partner Connection Widget */}
        {partner && (
          <div className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 border border-rose-200/50 dark:border-purple-800/20">
            <div className="relative shrink-0">
              {partner.avatar_url ? (
                <img
                  key={partner.avatar_url}
                  src={partner.avatar_url}
                  alt={partner.display_name}
                  className="w-9 h-9 rounded-xl object-cover ring-2 ring-rose-400/40"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center">
                  {partner.display_name.charAt(0)}
                </div>
              )}
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-stone-900 shadow-sm transition-colors',
                  isUserOnline(partner.last_seen_at || partner.updated_at, partner.is_online)
                    ? 'bg-emerald-500'
                    : 'bg-stone-400 dark:bg-zinc-600'
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-stone-800 dark:text-zinc-100 truncate">
                  {partner.display_name}
                </p>
                {isUserOnline(partner.last_seen_at || partner.updated_at, partner.is_online) ? (
                  <span className="text-[9px] text-emerald-600 font-medium flex items-center gap-0.5">
                    <Radio className="w-2 h-2 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="text-[9px] text-stone-400 font-medium">
                    {formatPresenceStatus(partner.last_seen_at || partner.updated_at, partner.is_online).label}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1">
                {partner.status_emoji && <span>{partner.status_emoji}</span>}
                <span className="truncate">{partner.status_message || 'Connected with you'}</span>
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Navigation Menu (Scrolls smoothly if screen height is constrained) */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto pr-1 flex-1 min-h-0 my-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all duration-150',
                isActive
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm shadow-rose-500/20 font-semibold'
                  : 'text-stone-600 dark:text-zinc-300 hover:bg-rose-50/80 dark:hover:bg-zinc-800/50 hover:text-rose-600 dark:hover:text-rose-400'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-stone-400')} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Days Together */}
      <div className="flex flex-col gap-2 pt-2 border-t border-rose-100/60 dark:border-zinc-800/60 shrink-0">
        {space && (
          <div className="text-center py-1 px-2.5 rounded-lg bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-purple-950/20 border border-rose-200/50">
            <span className="text-[9px] uppercase tracking-wider font-bold text-rose-500">
              Days Together
            </span>
            <p className="text-base font-extrabold text-stone-800 dark:text-zinc-100 leading-tight">
              {daysTogether}{' '}
              <span className="text-[11px] font-normal text-stone-500">days of love</span>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-rose-400/40 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 font-bold text-[11px] flex items-center justify-center shrink-0">
                {user?.display_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="text-left min-w-0">
              <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate">
                {user?.display_name || 'My Profile'}
              </p>
              <p className="text-[9px] text-stone-400 truncate">Online</p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Log out"
            className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
