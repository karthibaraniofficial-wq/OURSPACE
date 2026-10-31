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
import { calculateDaysTogether } from '@ourspace/shared';

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
    <aside className="hidden md:flex flex-col w-72 h-screen glass-panel border-r border-rose-200/50 dark:border-purple-900/30 p-5 select-none justify-between shrink-0">
      {/* Brand & Partner Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-500/25 group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                OURSPACE
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-rose-500/80">
                Private Sanctuary
              </span>
            </div>
          </Link>

          {/* Quick Demo Switcher */}
          <button
            onClick={() => switchDemoUser(user?.id.endsWith('1') ? 2 : 1)}
            title="Switch between User 1 (Alex) and User 2 (Jordan)"
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200/60 transition-all hover:scale-105"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Switch</span>
          </button>
        </div>

        {/* Partner Connection Widget */}
        {partner && (
          <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 border border-rose-200/50 dark:border-purple-800/20">
            <div className="relative">
              {partner.avatar_url ? (
                <img
                  src={partner.avatar_url}
                  alt={partner.display_name}
                  className="w-11 h-11 rounded-2xl object-cover ring-2 ring-rose-400/40"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-rose-200 text-rose-700 font-bold flex items-center justify-center">
                  {partner.display_name.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-stone-900 shadow-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-stone-800 dark:text-zinc-100 truncate">
                  {partner.display_name}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">
                {partner.status_message || 'Connected with you'}
              </p>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-sm transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/20 font-semibold'
                    : 'text-stone-600 dark:text-zinc-300 hover:bg-rose-50/80 dark:hover:bg-zinc-800/50 hover:text-rose-600 dark:hover:text-rose-400'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-stone-400')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Days Together */}
      <div className="flex flex-col gap-3 pt-4 border-t border-rose-100/60 dark:border-zinc-800/60">
        {space && (
          <div className="text-center py-2 px-3 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-purple-950/20 border border-rose-200/50">
            <span className="text-[11px] uppercase tracking-wider font-bold text-rose-500">
              Days Together
            </span>
            <p className="text-xl font-extrabold text-stone-800 dark:text-zinc-100">
              {daysTogether}{' '}
              <span className="text-xs font-normal text-stone-500">days of love</span>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-2.5">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-rose-400/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center">
                {user?.display_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate max-w-[110px]">
                {user?.display_name || 'My Profile'}
              </p>
              <p className="text-[10px] text-stone-400 truncate">Online</p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Log out"
            className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
