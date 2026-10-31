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
import { useCallStore } from '@/store/useCallStore';
import { isFirebaseConfigured, getFirebaseFirestore } from '@/lib/firebase/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, space, partner, isLoading, initializeSession } = useAuthStore();
  const { fetchMessages } = useChatStore();
  const { receiveCall } = useCallStore();

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

  // Real-time listener for incoming call sessions
  useEffect(() => {
    if (!space?.id || !user?.id) return;
    if (!isFirebaseConfigured()) return;

    const db = getFirebaseFirestore();
    const callsRef = collection(db, `privateSpaces/${space.id}/callSessions`);
    const q = query(callsRef, where('receiverId', '==', user.id), where('status', '==', 'ringing'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          receiveCall({
            id: change.doc.id,
            space_id: space.id,
            caller_id: data.callerId,
            receiver_id: user.id,
            call_type: data.callType || 'audio',
            status: 'ringing',
            room_name: data.roomName || `room-${space.id}`,
            started_at: new Date().toISOString(),
            answered_at: null,
            ended_at: null,
            duration_seconds: 0,
            created_at: new Date().toISOString(),
            caller: partner || {
              id: data.callerId,
              display_name: 'Your Partner',
              avatar_url: null,
              bio: null,
              status_message: 'Online',
              anniversary_date: null,
              accent_color: '#f43f5e',
              theme_mode: 'light',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            receiver: user,
          });
        }
      });
    });

    return () => unsubscribe();
  }, [space?.id, user?.id, partner, receiveCall]);

  return (
    <div className="flex h-full w-full max-h-screen overflow-hidden bg-cream-50 dark:bg-[#0F0E13]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4 p-2 sm:p-3 md:p-4 flex flex-col">
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
