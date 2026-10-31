'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Heart,
  MessageCircleHeart,
  Image as ImageIcon,
  BookOpen,
  Lock,
  MoreHorizontal,
  PhoneCall,
  CalendarCheck,
  Sparkles,
  Smile,
  Compass,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIMARY_MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Heart },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircleHeart },
  { href: '/dashboard/albums', label: 'Albums', icon: BookOpen },
  { href: '/dashboard/locker', label: 'Locker', icon: Lock },
];

const MORE_NAV_ITEMS = [
  { href: '/dashboard/gallery', label: 'Shared Gallery', icon: ImageIcon },
  { href: '/dashboard/calls', label: 'Audio & Video Calls', icon: PhoneCall },
  { href: '/dashboard/reminders', label: 'Reminders & Tasks', icon: CalendarCheck },
  { href: '/dashboard/memories', label: 'Milestones & Memories', icon: Sparkles },
  { href: '/dashboard/connect', label: 'Couple Connection & Moods', icon: Smile },
  { href: '/dashboard/plans', label: 'Bucket List & Plans', icon: Compass },
  { href: '/dashboard/settings', label: 'Sanctuary Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isMoreActive = MORE_NAV_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href));

  return (
    <>
      {/* Expanded 'More' Drawer for Clean Mobile Navigation */}
      {isMoreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="glass-card rounded-t-3xl border-t border-rose-200/60 p-5 flex flex-col gap-3 pb-24 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-rose-100/60 dark:border-zinc-800">
              <span className="text-xs font-bold text-stone-900 dark:text-zinc-100 uppercase tracking-wider">
                Sanctuary Modules
              </span>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {MORE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition-all',
                      isActive
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'glass-panel text-stone-700 dark:text-zinc-200 hover:bg-rose-50'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-rose-200/50 dark:border-purple-900/30 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around backdrop-blur-xl">
        {PRIMARY_MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 min-w-[50px]',
                isActive
                  ? 'text-rose-600 dark:text-rose-400 font-bold scale-105'
                  : 'text-stone-400 hover:text-stone-600 dark:text-zinc-400 dark:hover:text-zinc-200'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
              <span className="text-[10px] mt-0.5 tracking-tight font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          aria-label="More"
          className={cn(
            'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 min-w-[50px]',
            isMoreActive || isMoreOpen
              ? 'text-rose-600 dark:text-rose-400 font-bold scale-105'
              : 'text-stone-400 hover:text-stone-600 dark:text-zinc-400'
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium leading-none">
            More
          </span>
        </button>
      </nav>
    </>
  );
}
