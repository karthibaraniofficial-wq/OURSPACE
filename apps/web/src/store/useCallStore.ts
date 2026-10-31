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
  liveKitToken: string | null;
  liveKitUrl: string | null;
  errorMessage: string | null;

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
  fetchCallToken: (roomName: string) => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
}

let ringInterval: NodeJS.Timeout | null = null;
let ringingTimeout: NodeJS.Timeout | null = null;
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
  liveKitToken: null,
  liveKitUrl: null,
  errorMessage: null,

  setErrorMessage: (msg) => set({ errorMessage: msg }),

  initiateCall: async ({ spaceId, caller, receiver, type }) => {
    const callId = 'call-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const roomName = `ourspace-${spaceId.substring(0, 8)}-${callId}`;

    const newSession: CallSession = {
      id: callId,
      space_id: spaceId,
      caller_id: caller.id,
      receiver_id: receiver.id,
      call_type: type,
      status: 'ringing',
      room_name: roomName,
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
      liveKitToken: null,
      liveKitUrl: null,
      errorMessage: null,
    });

    playChime('call-ringtone');
    if (ringInterval) clearInterval(ringInterval);
    ringInterval = setInterval(() => {
      if (get().activeCall?.status === 'ringing') {
        playChime('call-ringtone');
      } else {
        if (ringInterval) {
          clearInterval(ringInterval);
          ringInterval = null;
        }
      }
    }, 2800);

    // 45-second ringing timeout
    if (ringingTimeout) clearTimeout(ringingTimeout);
    ringingTimeout = setTimeout(() => {
      if (get().activeCall?.status === 'ringing') {
        get().endCall();
      }
    }, 45000);

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      const callRef = doc(db, `privateSpaces/${spaceId}/callSessions`, callId);
      await setDoc(callRef, {
        id: callId,
        callerId: caller.id,
        receiverId: receiver.id,
        callType: type,
        status: 'ringing',
        roomName,
        startedAt: serverTimestamp(),
      });

      // Listen for partner answering/declining
      if (callSessionUnsubscribe) callSessionUnsubscribe();
      callSessionUnsubscribe = onSnapshot(callRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'active' && get().activeCall?.status === 'ringing') {
            if (ringingTimeout) clearTimeout(ringingTimeout);
            if (ringInterval) {
              clearInterval(ringInterval);
              ringInterval = null;
            }

            set((state) => ({
              activeCall: state.activeCall
                ? {
                    ...state.activeCall,
                    status: 'active',
                    answered_at: new Date().toISOString(),
                  }
                : null,
              isConnecting: false,
            }));

            playChime('modern-ping');
            if (durationInterval) clearInterval(durationInterval);
            durationInterval = setInterval(() => {
              set((state) => ({ callDuration: state.callDuration + 1 }));
            }, 1000);

            // Fetch LiveKit room token
            await get().fetchCallToken(roomName);
          } else if (data.status === 'declined' || data.status === 'ended') {
            get().endCall();
          }
        }
      });
    }
  },

  receiveCall: (session) => {
    set({ incomingCall: session, errorMessage: null });
    playChime('call-ringtone');
    if (ringInterval) clearInterval(ringInterval);
    ringInterval = setInterval(() => {
      if (get().incomingCall) {
        playChime('call-ringtone');
      } else {
        if (ringInterval) {
          clearInterval(ringInterval);
          ringInterval = null;
        }
      }
    }, 2800);
  },

  acceptCall: async () => {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (ringingTimeout) {
      clearTimeout(ringingTimeout);
      ringingTimeout = null;
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
      isVideoEnabled: acceptedCall.call_type === 'video',
      isMuted: false,
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

    // Connect receiver to the same LiveKit room
    await get().fetchCallToken(acceptedCall.room_name);
  },

  fetchCallToken: async (roomName: string) => {
    try {
      const currentCall = get().activeCall;
      if (!currentCall) return;

      const participantId = currentCall.receiver?.id || 'partner';
      const participantName = currentCall.receiver?.display_name || 'My Partner';

      let authHeader = 'Bearer authorized-space-member';
      if (isFirebaseConfigured()) {
        try {
          const { getFirebaseAuth } = await import('@/lib/firebase/firebase');
          const idToken = await getFirebaseAuth().currentUser?.getIdToken();
          if (idToken) authHeader = `Bearer ${idToken}`;
        } catch {}
      }

      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          roomName,
          participantId,
          participantName,
          spaceId: currentCall.space_id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[LiveKit Token Error]', err);
        return;
      }

      const data = await res.json();
      if (data.token) {
        set({
          liveKitToken: data.token,
          liveKitUrl: data.server_url || process.env.NEXT_PUBLIC_LIVEKIT_URL || null,
        });
      }
    } catch (err) {
      console.error('[Failed to fetch LiveKit token]', err);
    }
  },

  declineCall: async () => {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (ringingTimeout) {
      clearTimeout(ringingTimeout);
      ringingTimeout = null;
    }
    if (callSessionUnsubscribe) {
      callSessionUnsubscribe();
      callSessionUnsubscribe = null;
    }

    const current = get().incomingCall || get().activeCall;
    set({
      incomingCall: null,
      activeCall: null,
      isConnecting: false,
      liveKitToken: null,
      liveKitUrl: null,
      errorMessage: null,
    });

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
    if (ringingTimeout) {
      clearTimeout(ringingTimeout);
      ringingTimeout = null;
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

    set({
      activeCall: null,
      incomingCall: null,
      callDuration: 0,
      isConnecting: false,
      liveKitToken: null,
      liveKitUrl: null,
      errorMessage: null,
    });
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
