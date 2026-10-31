import { create } from 'zustand';
import type { CallSession, CallType, UUID, Profile } from '@ourspace/types';
import { playChime } from '@ourspace/shared';
import { getFirebaseFirestore, isFirebaseConfigured, getFirebaseFunctions } from '@/lib/firebase/firebase';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

export type CallStatus =
  | 'IDLE'
  | 'OUTGOING_RINGING'
  | 'INCOMING_RINGING'
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'MEDIA_CONNECTED'
  | 'RECONNECTING'
  | 'ENDED'
  | 'FAILED'
  | 'REJECTED';

export type SignalingStatus = 'idle' | 'ringing' | 'active' | 'declined' | 'ended';
export type MediaConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface CallState {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  callStatus: CallStatus;
  signalingStatus: SignalingStatus;
  mediaStatus: MediaConnectionStatus;
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
  fetchCallToken: (roomName: string, callId?: string) => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
  setMediaStatus: (status: MediaConnectionStatus) => void;
  setCallStatus: (status: CallStatus) => void;
  setNetworkQuality: (quality: 'excellent' | 'good' | 'poor') => void;
}

let ringInterval: NodeJS.Timeout | null = null;
let ringingTimeout: NodeJS.Timeout | null = null;
let durationInterval: NodeJS.Timeout | null = null;
let callSessionUnsubscribe: (() => void) | null = null;
let isFetchingToken = false;
let isAcceptingCall = false;

function parseJwtSubject(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    return (payload.sub || payload.identity || null) as string | null;
  } catch {
    return null;
  }
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  incomingCall: null,
  callStatus: 'IDLE',
  signalingStatus: 'idle',
  mediaStatus: 'disconnected',
  isMuted: false,
  isVideoEnabled: true,
  callDuration: 0,
  networkQuality: 'excellent',
  isConnecting: false,
  liveKitToken: null,
  liveKitUrl: null,
  errorMessage: null,

  setErrorMessage: (msg) => set({ errorMessage: msg }),
  setMediaStatus: (status) =>
    set({
      mediaStatus: status,
      callStatus:
        status === 'connected'
          ? 'MEDIA_CONNECTED'
          : status === 'reconnecting'
          ? 'RECONNECTING'
          : status === 'connecting'
          ? 'CONNECTING'
          : get().callStatus,
    }),
  setCallStatus: (status) => set({ callStatus: status }),
  setNetworkQuality: (quality) => set({ networkQuality: quality }),

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
      incomingCall: null,
      callStatus: 'OUTGOING_RINGING',
      signalingStatus: 'ringing',
      mediaStatus: 'disconnected',
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
      try {
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
              if (ringingTimeout) {
                clearTimeout(ringingTimeout);
                ringingTimeout = null;
              }
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
                callStatus: 'ACCEPTED',
                signalingStatus: 'active',
                mediaStatus: 'connecting',
                isConnecting: false,
              }));

              playChime('modern-ping');
              if (durationInterval) clearInterval(durationInterval);
              durationInterval = setInterval(() => {
                set((state) => ({ callDuration: state.callDuration + 1 }));
              }, 1000);

              // Caller connects to LiveKit room
              await get().fetchCallToken(roomName, callId);
            } else if (data.status === 'declined' || data.status === 'ended') {
              get().endCall();
            }
          }
        });
      } catch (err) {
        console.error('[Failed to initiate call session in Firestore]', err);
        set({ errorMessage: 'Could not connect to signaling service.' });
      }
    }
  },

  receiveCall: (session) => {
    // Prevent duplicate incoming calls if already active or already ringing
    if (get().activeCall || get().incomingCall?.id === session.id) {
      return;
    }

    set({
      incomingCall: session,
      callStatus: 'INCOMING_RINGING',
      signalingStatus: 'ringing',
      mediaStatus: 'disconnected',
      errorMessage: null,
    });

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
    if (isAcceptingCall) return;
    isAcceptingCall = true;

    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (ringingTimeout) {
      clearTimeout(ringingTimeout);
      ringingTimeout = null;
    }

    const currentCall = get().incomingCall || get().activeCall;
    if (!currentCall) {
      isAcceptingCall = false;
      return;
    }

    const acceptedCall: CallSession = {
      ...currentCall,
      status: 'active',
      answered_at: new Date().toISOString(),
    };

    set({
      activeCall: acceptedCall,
      incomingCall: null,
      callStatus: 'ACCEPTED',
      signalingStatus: 'active',
      mediaStatus: 'connecting',
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
      try {
        const db = getFirebaseFirestore();
        const callRef = doc(db, `privateSpaces/${currentCall.space_id}/callSessions`, currentCall.id);
        await updateDoc(callRef, {
          status: 'active',
          answeredAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[Failed to update callSession answered status]', err);
      }
    }

    // Connect receiver to the exact same LiveKit room
    await get().fetchCallToken(acceptedCall.room_name, acceptedCall.id);
    isAcceptingCall = false;
  },

  fetchCallToken: async (roomName: string, callId?: string) => {
    if (isFetchingToken) return;
    isFetchingToken = true;

    try {
      const currentCall = get().activeCall || get().incomingCall;
      if (!currentCall) {
        isFetchingToken = false;
        return;
      }

      set({ callStatus: 'CONNECTING', mediaStatus: 'connecting' });

      // Determine the authoritative Firebase UID of the LOCAL user.
      // CALLER gets caller UID. RECEIVER gets receiver UID.
      // Never use receiver UID for caller!
      let localUid: string | null = null;
      let localDisplayName = 'Partner';

      if (isFirebaseConfigured()) {
        try {
          const { getFirebaseAuth } = await import('@/lib/firebase/firebase');
          const auth = getFirebaseAuth();
          if (auth.currentUser?.uid) {
            localUid = auth.currentUser.uid;
            localDisplayName = auth.currentUser.displayName || 'Partner';
          }
        } catch {}
      }

      if (!localUid) {
        try {
          const { useAuthStore } = await import('@/store/useAuthStore');
          const authUser = useAuthStore.getState().user;
          if (authUser?.id) {
            localUid = authUser.id;
            localDisplayName = authUser.display_name || 'Partner';
          }
        } catch {}
      }

      // If auth not yet loaded, infer role accurately from call session
      if (!localUid) {
        // If incomingCall exists or caller_id is partner, local participant is receiver
        if (currentCall.receiver_id && currentCall.caller_id) {
          localUid = currentCall.receiver_id;
          localDisplayName = currentCall.receiver?.display_name || 'Receiver';
        } else {
          localUid = currentCall.caller_id;
          localDisplayName = currentCall.caller?.display_name || 'Caller';
        }
      }

      let mintedToken: string | null = null;
      let serverUrl: string | null = null;

      // 1. Primary path: Use the existing secure Firebase callable function
      if (isFirebaseConfigured()) {
        try {
          const { httpsCallable } = await import('firebase/functions');
          const getLiveKitTokenFn = httpsCallable(getFirebaseFunctions(), 'getLiveKitToken');
          const result = await getLiveKitTokenFn({
            spaceId: currentCall.space_id,
            roomName,
            callId: callId || currentCall.id,
          });
          const resData = result.data as any;
          if (resData?.token) {
            mintedToken = resData.token;
            serverUrl = resData.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || null;
          }
        } catch (fnErr) {
          console.warn('[Firebase Callable getLiveKitToken fallback]', fnErr);
        }
      }

      // 2. Authoritative Fallback: Secure /api/livekit/token endpoint
      if (!mintedToken) {
        let authHeader = '';
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
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            roomName,
            participantId: localUid,
            participantName: localDisplayName,
            spaceId: currentCall.space_id,
            callId: callId || currentCall.id,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          mintedToken = data.token;
          serverUrl = data.server_url || data.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || null;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[API livekit/token Error]', errData);
          set({
            errorMessage: errData.error || 'Failed to acquire LiveKit call token.',
            callStatus: 'FAILED',
          });
          isFetchingToken = false;
          return;
        }
      }

      if (mintedToken) {
        // Cryptographic validation: Verify token subject matches authenticated user UID
        const tokenSub = parseJwtSubject(mintedToken);
        if (tokenSub && localUid && tokenSub !== localUid) {
          console.error(
            `[SECURITY VIOLATION] LiveKit Token identity collision prevented! Token UID: ${tokenSub}, Auth UID: ${localUid}`
          );
          set({
            errorMessage: 'Security check failed: LiveKit participant identity mismatch.',
            callStatus: 'FAILED',
          });
          isFetchingToken = false;
          return;
        }

        set({
          liveKitToken: mintedToken,
          liveKitUrl: serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || null,
        });
      }
    } catch (err) {
      console.error('[Failed to fetch LiveKit token]', err);
      set({
        errorMessage: 'Network error acquiring call security credentials.',
        callStatus: 'FAILED',
      });
    } finally {
      isFetchingToken = false;
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
    isFetchingToken = false;
    isAcceptingCall = false;

    const current = get().incomingCall || get().activeCall;
    set({
      incomingCall: null,
      activeCall: null,
      callStatus: 'REJECTED',
      signalingStatus: 'declined',
      mediaStatus: 'disconnected',
      isConnecting: false,
      liveKitToken: null,
      liveKitUrl: null,
      errorMessage: null,
    });

    if (isFirebaseConfigured() && current?.space_id && current?.id) {
      try {
        const db = getFirebaseFirestore();
        const callRef = doc(db, `privateSpaces/${current.space_id}/callSessions`, current.id);
        await updateDoc(callRef, {
          status: 'declined',
          endedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[Failed to update callSession declined status]', err);
      }
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
    isFetchingToken = false;
    isAcceptingCall = false;

    const current = get().activeCall || get().incomingCall;
    const duration = get().callDuration;

    set({
      activeCall: null,
      incomingCall: null,
      callStatus: 'ENDED',
      signalingStatus: 'ended',
      mediaStatus: 'disconnected',
      callDuration: 0,
      isConnecting: false,
      liveKitToken: null,
      liveKitUrl: null,
      errorMessage: null,
    });
    playChime('soft-bell');

    if (isFirebaseConfigured() && current?.space_id && current?.id) {
      try {
        const db = getFirebaseFirestore();
        const callRef = doc(db, `privateSpaces/${current.space_id}/callSessions`, current.id);
        await updateDoc(callRef, {
          status: 'ended',
          endedAt: serverTimestamp(),
          durationSeconds: duration,
        });
      } catch (err) {
        console.warn('[Failed to update callSession ended status]', err);
      }
    }
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
  setCallDuration: (duration) => set({ callDuration: duration }),
}));
