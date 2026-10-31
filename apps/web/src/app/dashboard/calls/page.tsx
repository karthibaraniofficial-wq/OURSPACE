'use client';

import React, { useEffect, useState } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Sparkles,
  Heart,
  Radio,
  PhoneCall,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCallStore } from '@/store/useCallStore';
import { Button } from '@/components/ui/Button';
import { isFirebaseConfigured, getFirebaseFirestore } from '@/lib/firebase/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface CallRecord {
  id: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  partnerName: string;
  timestamp: string;
  duration: string;
}

export default function CallsPage() {
  const { user, space, partner } = useAuthStore();
  const { initiateCall } = useCallStore();
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to real Firestore call history
  useEffect(() => {
    if (!space?.id || !user?.id) {
      setIsLoading(false);
      return;
    }

    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const db = getFirebaseFirestore();
    const callsRef = collection(db, `privateSpaces/${space.id}/callSessions`);
    const q = query(callsRef, orderBy('startedAt', 'desc'), limit(30));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: CallRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          const isCaller = data.callerId === user.id;
          const isMissed = data.status === 'declined' || (!data.answeredAt && data.status === 'ended');

          const direction: 'incoming' | 'outgoing' | 'missed' = isMissed
            ? 'missed'
            : isCaller
            ? 'outgoing'
            : 'incoming';

          const startDate = data.startedAt?.toDate ? data.startedAt.toDate() : new Date();
          const timestamp = startDate.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          const durationSeconds = data.durationSeconds || 0;
          const mins = Math.floor(durationSeconds / 60);
          const secs = durationSeconds % 60;
          const durationStr = isMissed
            ? 'Missed'
            : durationSeconds > 0
            ? `${mins}m ${secs}s`
            : 'Brief call';

          return {
            id: d.id,
            type: (data.callType as 'audio' | 'video') || 'audio',
            direction,
            partnerName: partner?.display_name || 'My Partner',
            timestamp,
            duration: durationStr,
          };
        });

        setCallHistory(records);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [space?.id, user?.id, partner?.display_name]);

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!space || !user) return;
    if (!partner) {
      alert('Your partner has not paired yet. Share your invitation code from Settings to connect first ❤️');
      return;
    }
    initiateCall({
      spaceId: space.id,
      caller: user,
      receiver: partner,
      type,
    });
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Top Banner */}
      <div className="rounded-3xl p-6 sm:p-8 glass-panel border border-rose-200/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-r from-rose-50/60 to-purple-50/60">
        <div>
          <span className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span>Encrypted WebRTC Peer Media</span>
          </span>
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
            Private Audio & Video Calls
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 max-w-md">
            Direct low-latency communication with {partner?.display_name || 'your partner'}. Fully private, end-to-end encrypted media.
          </p>
        </div>

        {/* Quick Launch Call Buttons */}
        {partner && (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => handleStartCall('audio')}
              className="gap-2 text-xs border-rose-200 shadow-sm"
            >
              <Phone className="w-4 h-4 fill-rose-500/20 text-rose-600" />
              <span>Start Audio Call</span>
            </Button>

            <Button
              variant="primary"
              onClick={() => handleStartCall('video')}
              className="gap-2 text-xs shadow-rose-500/20"
            >
              <Video className="w-4 h-4" />
              <span>Start Video Call</span>
            </Button>
          </div>
        )}
      </div>

      {/* Call History Card */}
      <div className="rounded-3xl glass-panel p-6 border border-rose-200/50 flex flex-col gap-4">
        <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
          Recent Call History
        </h3>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-400 text-xs">
            <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            <span>Loading call records...</span>
          </div>
        ) : callHistory.length === 0 ? (
          <div className="py-12 px-4 rounded-2xl text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center">
              <PhoneCall className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                No calls recorded yet
              </h4>
              <p className="text-xs text-stone-400 max-w-sm mt-0.5">
                Every audio and video conversation you share with {partner?.display_name || 'your partner'} will appear here.
              </p>
            </div>
            {partner && (
              <div className="flex items-center gap-3 mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStartCall('audio')}
                  className="gap-1.5 text-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {partner.display_name}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {callHistory.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-4 rounded-2xl glass-card hover:bg-rose-50/40 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                      call.direction === 'missed'
                        ? 'bg-red-100 text-red-600'
                        : call.type === 'video'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {call.direction === 'missed' ? (
                      <PhoneMissed className="w-5 h-5" />
                    ) : call.type === 'video' ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <Phone className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-100">
                      {call.partnerName}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                      <span className="capitalize">{call.direction}</span>
                      <span>•</span>
                      <span>{call.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs font-semibold ${
                      call.direction === 'missed' ? 'text-red-500' : 'text-stone-500'
                    }`}
                  >
                    {call.duration}
                  </span>

                  <button
                    onClick={() => handleStartCall(call.type)}
                    className="p-2.5 rounded-xl hover:bg-rose-100 text-rose-500 transition-colors"
                    title="Call back"
                  >
                    {call.type === 'video' ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
