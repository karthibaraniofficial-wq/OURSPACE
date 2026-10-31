import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'rose' | 'emerald' | 'lavender' | 'amber' | 'neutral';
}

export function Badge({ className, variant = 'rose', children, ...props }: BadgeProps) {
  const variants = {
    rose: 'bg-rose-50 text-rose-600 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    lavender: 'bg-purple-50 text-purple-600 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
    amber: 'bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    neutral: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
