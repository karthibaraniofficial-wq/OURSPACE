'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { IncomingCallDialog } from '@/components/calls/IncomingCallDialog';
import { ActiveCallModal } from '@/components/calls/ActiveCallModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, space, isLoading, initializeSession } = useAuthStore();
  const { fetchMessages } = useChatStore();

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (space) {
      fetchMessages(space.id);
    }
  }, [space, fetchMessages]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cream-50 dark:bg-[#0F0E13]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6 p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Real-time Call Overlays */}
      <IncomingCallDialog />
      <ActiveCallModal />
    </div>
  );
}
