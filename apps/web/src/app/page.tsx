'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { Heart, Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { user, space, isLoading, initializeSession } = useAuthStore();

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/auth');
      } else if (!space) {
        router.replace('/pair');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, space, isLoading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-rose-50 via-cream-50 to-purple-50 dark:from-[#0F0E13] dark:to-purple-950/20">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-xl shadow-rose-500/25 animate-pulse-slow">
          <Heart className="w-8 h-8 fill-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            OURSPACE
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            Loading your private sanctuary...
          </p>
        </div>
        <Loader2 className="w-5 h-5 text-rose-500 animate-spin mt-2" />
      </div>
    </div>
  );
}
