'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Lock, Mail, User, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AuthPage() {
  const router = useRouter();
  const { login, register, switchDemoUser, isLoading } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'login') {
      const res = await login(email, password);
      if (res.success) {
        router.replace('/dashboard');
      } else {
        setErrorMsg(res.error || 'Failed to login. Please check credentials.');
      }
    } else {
      if (!displayName.trim()) {
        setErrorMsg('Please enter your display name.');
        return;
      }
      const res = await register(email, password, displayName.trim());
      if (res.success) {
        router.replace('/pair');
      } else {
        setErrorMsg(res.error || 'Registration failed.');
      }
    }
  };

  const handleQuickDemo = (userNum: 1 | 2) => {
    setErrorMsg('');
    switchDemoUser(userNum);
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-rose-50 via-cream-50 to-purple-50 dark:from-[#0F0E13] dark:via-zinc-950 dark:to-purple-950/20">
      <div className="w-full max-w-md rounded-3xl glass-panel p-8 shadow-2xl border border-rose-200/60 dark:border-purple-900/30">
        {/* Header Icon & Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 mb-3">
            <Heart className="w-7 h-7 fill-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
            OURSPACE
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            Two souls, one private digital sanctuary.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-rose-50/80 dark:bg-zinc-800/80 p-1 mb-6 border border-rose-200/40">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <Input
              label="Your Display Name"
              placeholder="e.g. Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              icon={<User className="w-4 h-4" />}
              required
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            required
          />

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
              {errorMsg}
            </div>
          )}

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full mt-2 py-3 rounded-2xl shadow-rose-500/25"
          >
            {mode === 'login' ? 'Enter Our Space' : 'Start Private Journey'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>

        {/* Instant Quick Demo Switcher */}
        <div className="mt-8 pt-6 border-t border-rose-100 dark:border-zinc-800 text-center">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
            Quick 1-Click Demo Profiles
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickDemo(1)}
              className="flex-1 py-2 px-3 rounded-xl glass-card hover:bg-rose-50 dark:hover:bg-zinc-800 border border-rose-200/60 text-xs font-semibold text-stone-700 dark:text-zinc-200 transition-all flex items-center justify-center gap-1.5"
            >
              <span>Alex</span>
              <span className="text-[10px] text-rose-500 font-bold">(User 1)</span>
            </button>
            <button
              onClick={() => handleQuickDemo(2)}
              className="flex-1 py-2 px-3 rounded-xl glass-card hover:bg-purple-50 dark:hover:bg-zinc-800 border border-purple-200/60 text-xs font-semibold text-stone-700 dark:text-zinc-200 transition-all flex items-center justify-center gap-1.5"
            >
              <span>Jordan</span>
              <span className="text-[10px] text-purple-500 font-bold">(User 2)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
