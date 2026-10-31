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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Heart },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircleHeart },
  { href: '/dashboard/gallery', label: 'Gallery', icon: ImageIcon },
  { href: '/dashboard/calls', label: 'Calls', icon: PhoneCall },
  { href: '/dashboard/reminders', label: 'Tasks', icon: CalendarCheck },
  { href: '/dashboard/memories', label: 'Memories', icon: Sparkles },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-rose-200/50 dark:border-purple-900/30 px-1 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around backdrop-blur-xl">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-200 min-w-[44px]',
              isActive
                ? 'text-rose-600 dark:text-rose-400 font-bold scale-105'
                : 'text-stone-400 hover:text-stone-600 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
            <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight font-medium leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
