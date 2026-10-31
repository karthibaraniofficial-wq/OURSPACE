import { create } from 'zustand';
import type { CallSession, CallType, UUID, Profile } from '@ourspace/types';
import { playChime } from '@ourspace/shared';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

interface CallState {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  callDuration: number;
  networkQuality: 'excellent' | 'good' | 'poor';
  isConnecting: boolean;

  // Actions
  initiateCall: (params: {
    spaceId: UUID;
    caller: Profile;
    receiver: Profile;
    type: CallType;
  }) => Promise<void>;
  receiveCall: (session: CallSession) => void;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  setCallDuration: (duration: number) => void;
}

let ringInterval: NodeJS.Timeout | null = null;
let durationInterval: NodeJS.Timeout | null = null;
let callSessionUnsubscribe: (() => void) | null = null;

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  incomingCall: null,
  isMuted: false,
  isVideoEnabled: true,
  callDuration: 0,
  networkQuality: 'excellent',
  isConnecting: false,

  initiateCall: async ({ spaceId, caller, receiver, type }) => {
    const callId = 'call-' + Math.random().toString(36).substring(2, 9);
    const newSession: CallSession = {
      id: callId,
      space_id: spaceId,
      caller_id: caller.id,
      receiver_id: receiver.id,
      call_type: type,
      status: 'ringing',
      room_name: `ourspace-${spaceId.substring(0, 8)}`,
      started_at: new Date().toISOString(),
      answered_at: null,
      ended_at: null,
      duration_seconds: 0,
      created_at: new Date().toISOString(),
      caller,
      receiver,
    };

    set({
      activeCall: newSession,
      isMuted: false,
      isVideoEnabled: type === 'video',
      callDuration: 0,
      isConnecting: true,
    });

    playChime('call-ringtone');
    if (ringInterval) clearInterval(ringInterval);
    ringInterval = setInterval(() => {
      if (get().activeCall?.status === 'ringing') {
        playChime('call-ringtone');
      } else {
        if (ringInterval) clearInterval(ringInterval);
      }
    }, 2800);

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      const callRef = doc(db, `privateSpaces/${spaceId}/callSessions`, callId);
      await setDoc(callRef, {
        id: callId,
        callerId: caller.id,
        receiverId: receiver.id,
        callType: type,
        status: 'ringing',
        roomName: newSession.room_name,
        startedAt: serverTimestamp(),
      });

      // Listen for partner answering/declining
      if (callSessionUnsubscribe) callSessionUnsubscribe();
      callSessionUnsubscribe = onSnapshot(callRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'active' && get().activeCall?.status === 'ringing') {
            get().acceptCall();
          } else if (data.status === 'declined' || data.status === 'ended') {
            get().endCall();
          }
        }
      });
    }

    // Auto-answer simulation for instant demoing after 3.5 seconds
    setTimeout(() => {
      if (get().activeCall?.status === 'ringing') {
        get().acceptCall();
      }
    }, 3800);
  },

  receiveCall: (session) => {
    set({ incomingCall: session });
    playChime('call-ringtone');
    if (ringInterval) clearInterval(ringInterval);
    ringInterval = setInterval(() => {
      if (get().incomingCall) {
        playChime('call-ringtone');
      } else {
        if (ringInterval) clearInterval(ringInterval);
      }
    }, 2800);
  },

  acceptCall: async () => {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }

    const currentCall = get().activeCall || get().incomingCall;
    if (!currentCall) return;

    const acceptedCall: CallSession = {
      ...currentCall,
      status: 'active',
      answered_at: new Date().toISOString(),
    };

    set({
      activeCall: acceptedCall,
      incomingCall: null,
      isConnecting: false,
      callDuration: 0,
    });

    playChime('modern-ping');

    if (durationInterval) clearInterval(durationInterval);
    durationInterval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);

    if (isFirebaseConfigured() && currentCall.space_id) {
      const db = getFirebaseFirestore();
      const callRef = doc(db, `privateSpaces/${currentCall.space_id}/callSessions`, currentCall.id);
      await updateDoc(callRef, {
        status: 'active',
        answeredAt: serverTimestamp(),
      });
    }
  },

  declineCall: async () => {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (callSessionUnsubscribe) {
      callSessionUnsubscribe();
      callSessionUnsubscribe = null;
    }

    const current = get().incomingCall || get().activeCall;
    set({ incomingCall: null, activeCall: null, isConnecting: false });

    if (isFirebaseConfigured() && current) {
      const db = getFirebaseFirestore();
      const callRef = doc(db, `privateSpaces/${current.space_id}/callSessions`, current.id);
      await updateDoc(callRef, {
        status: 'declined',
        endedAt: serverTimestamp(),
      });
    }
  },

  endCall: async () => {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
    if (callSessionUnsubscribe) {
      callSessionUnsubscribe();
      callSessionUnsubscribe = null;
    }

    const current = get().activeCall;
    const duration = get().callDuration;

    set({ activeCall: null, incomingCall: null, callDuration: 0, isConnecting: false });
    playChime('soft-bell');

    if (isFirebaseConfigured() && current) {
      const db = getFirebaseFirestore();
      const callRef = doc(db, `privateSpaces/${current.space_id}/callSessions`, current.id);
      await updateDoc(callRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
        durationSeconds: duration,
      });
    }
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
  setCallDuration: (duration) => set({ callDuration: duration }),
}));
