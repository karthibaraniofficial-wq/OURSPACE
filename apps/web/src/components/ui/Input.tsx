import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && <div className="absolute left-3.5 text-stone-400 pointer-events-none">{icon}</div>}
          <input
            type={type}
            ref={ref}
            className={cn(
              'w-full rounded-2xl glass-input py-2.5 px-4 text-sm text-stone-800 dark:text-zinc-100 placeholder:text-stone-400 focus:outline-none transition-all duration-200',
              icon && 'pl-10',
              error && 'border-red-400 focus:ring-red-400',
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-red-500 font-medium pl-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
