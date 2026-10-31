'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Signal,
  Heart,
  Volume2,
  VolumeX,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { useCallStore } from '@/store/useCallStore';
import { cn } from '@/lib/utils';

export function ActiveCallModal() {
  const {
    activeCall,
    isMuted,
    isVideoEnabled,
    callDuration,
    networkQuality,
    liveKitToken,
    liveKitUrl,
    toggleMute,
    toggleVideo,
    endCall,
  } = useCallStore();

  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [liveKitConnected, setLiveKitConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const liveKitRoomRef = useRef<any>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);

  const isVideo = activeCall?.call_type === 'video';
  const partner = activeCall?.receiver;

  // 1. Initialize Local Camera and Microphone
  useEffect(() => {
    if (!activeCall) return;

    let isMounted = true;

    async function acquireLocalMedia() {
      try {
        setMediaPermissionDenied(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;

        // Apply initial mute/video state
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = isVideoEnabled;
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: unknown) {
        console.warn('[Camera/Microphone Permission Error]', err);
        const name = (err as Error)?.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setMediaPermissionDenied('Camera or Microphone access was denied. Please check your browser permissions.');
        } else {
          setMediaPermissionDenied('Could not access media hardware on this device.');
        }
      }
    }

    acquireLocalMedia();

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [activeCall?.id, isVideo]);

  // 2. Connect to LiveKit Room for Remote Audio & Video Media
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;
    if (!liveKitToken) return;

    let isMounted = true;
    let roomInstance: any = null;

    async function connectRoom() {
      try {
        const { Room, RoomEvent, Track } = await import('livekit-client');

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomInstance = room;
        liveKitRoomRef.current = room;

        // Track Subscribed Event: Attach Remote Audio and Video Tracks
        room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
          if (!isMounted) return;

          if (track.kind === Track.Kind.Video) {
            if (remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
              setHasRemoteVideo(true);
            }
          } else if (track.kind === Track.Kind.Audio) {
            const audioEl = track.attach();
            audioElementsRef.current.push(audioEl);
            audioEl.play().catch((playErr: unknown) => {
              console.warn('[Audio Autoplay Blocked]', playErr);
              setAutoplayBlocked(true);
            });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
          track.detach();
          if (track.kind === Track.Kind.Video) {
            setHasRemoteVideo(false);
          }
        });

        room.on(RoomEvent.TrackMuted, (publication: any, participant: any) => {
          if (!participant.isLocal) {
            if (publication.kind === Track.Kind.Video) setHasRemoteVideo(false);
            if (publication.kind === Track.Kind.Audio) setIsRemoteMuted(true);
          }
        });

        room.on(RoomEvent.TrackUnmuted, (publication: any, participant: any) => {
          if (!participant.isLocal) {
            if (publication.kind === Track.Kind.Video) setHasRemoteVideo(true);
            if (publication.kind === Track.Kind.Audio) setIsRemoteMuted(false);
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (isMounted) {
            setLiveKitConnected(false);
          }
        });

        const targetUrl =
          liveKitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://ourspace.livekit.cloud';

        await room.connect(targetUrl, liveKitToken);

        if (!isMounted) {
          room.disconnect();
          return;
        }

        setLiveKitConnected(true);

        // Publish local microphone
        await room.localParticipant.setMicrophoneEnabled(!isMuted);

        // Publish local camera if video call
        if (isVideo) {
          await room.localParticipant.setCameraEnabled(isVideoEnabled);
        }
      } catch (err: unknown) {
        console.warn('[LiveKit Connection Warning - Using Local Media Session]', err);
      }
    }

    connectRoom();

    return () => {
      isMounted = false;
      if (roomInstance) {
        roomInstance.disconnect();
        liveKitRoomRef.current = null;
      }
      audioElementsRef.current.forEach((el) => el.remove());
      audioElementsRef.current = [];
      setLiveKitConnected(false);
      setHasRemoteVideo(false);
    };
  }, [activeCall?.status, liveKitToken, liveKitUrl, isVideo]);

  // 3. Sync Mute State with Hardware Media & LiveKit Participant
  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    toggleMute();

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (liveKitRoomRef.current?.localParticipant) {
      try {
        await liveKitRoomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted);
      } catch (err) {
        console.warn('[LiveKit Mute Toggle Error]', err);
      }
    }
  };

  // 4. Sync Video State with Hardware Media & LiveKit Participant
  const handleToggleVideo = async () => {
    const nextVideo = !isVideoEnabled;
    toggleVideo();

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextVideo;
      });
    }

    if (liveKitRoomRef.current?.localParticipant) {
      try {
        await liveKitRoomRef.current.localParticipant.setCameraEnabled(nextVideo);
      } catch (err) {
        console.warn('[LiveKit Video Toggle Error]', err);
      }
    }
  };

  // 5. Handle End Call & Hardware Release
  const handleEndCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (liveKitRoomRef.current) {
      liveKitRoomRef.current.disconnect();
      liveKitRoomRef.current = null;
    }
    audioElementsRef.current.forEach((el) => el.remove());
    audioElementsRef.current = [];
    endCall();
  };

  // 6. Resume Autoplay if blocked by browser policy
  const handleEnableAudio = () => {
    audioElementsRef.current.forEach((el) => {
      el.play().catch(() => {});
    });
    setAutoplayBlocked(false);
  };

  if (!activeCall) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl flex flex-col justify-between bg-zinc-950"
        >
          {/* Top Bar: Call Info & Quality Indicator */}
          <div className="relative z-30 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{partner?.display_name || 'My Partner'}</span>
                  {isRemoteMuted && (
                    <span title="Partner muted" className="text-red-400">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </h4>
                <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {activeCall.status === 'ringing'
                      ? 'Ringing...'
                      : `In Call • ${formatTimer(callDuration)}`}
                  </span>
                  {liveKitConnected && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 hidden sm:inline">
                      LiveKit SFU Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold backdrop-blur-md border border-white/5">
                <Signal className="w-3.5 h-3.5" />
                <span className="capitalize">{networkQuality}</span>
              </div>
            </div>
          </div>

          {/* Autoplay / Permission Warning Banners */}
          {(mediaPermissionDenied || autoplayBlocked) && (
            <div className="relative z-30 px-6 py-2">
              {mediaPermissionDenied && (
                <div className="mb-2 p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{mediaPermissionDenied}</span>
                </div>
              )}
              {autoplayBlocked && (
                <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <VolumeX className="w-4 h-4 text-rose-400" />
                    <span>Browser blocked background audio playback.</span>
                  </div>
                  <button
                    onClick={handleEnableAudio}
                    className="px-3 py-1 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors"
                  >
                    Tap to Enable Audio
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Main Video & Audio Presentation Stage */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            {/* Real Remote Camera Video Feed */}
            {isVideo && hasRemoteVideo ? (
              <div className="absolute inset-0 w-full h-full">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            ) : (
              /* Audio Call or Video Camera Disabled Avatar Display */
              <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
                <div className="relative">
                  {/* Romantic Audio Visualizer Pulsing Rings */}
                  <span className="absolute -inset-6 rounded-full bg-rose-500/20 animate-ping" />
                  <span className="absolute -inset-3 rounded-full bg-rose-500/30 animate-pulse" />
                  {partner?.avatar_url ? (
                    <img
                      src={partner.avatar_url}
                      alt={partner.display_name}
                      className="relative w-32 h-32 rounded-full object-cover ring-4 ring-rose-500 shadow-2xl"
                    />
                  ) : (
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-bold text-4xl flex items-center justify-center shadow-2xl">
                      {partner?.display_name?.charAt(0) || 'P'}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-2xl font-extrabold text-white">
                    {partner?.display_name || 'My Partner'}
                  </h3>
                  <p className="text-sm text-stone-300 mt-1 flex items-center justify-center gap-2">
                    {activeCall.status === 'ringing' ? (
                      'Ringing partner device...'
                    ) : isVideo && !hasRemoteVideo ? (
                      <>
                        <VideoOff className="w-4 h-4 text-stone-400" />
                        <span>Partner camera is off • Audio connected</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                        <span>Private Encrypted Audio Call Connected</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Self View (Picture-in-Picture) */}
            {isVideo && (
              <motion.div
                drag
                dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
                className="absolute top-24 right-4 sm:right-6 w-36 h-48 sm:w-44 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-stone-900 cursor-grab active:cursor-grabbing z-20"
              >
                {isVideoEnabled ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror scale-x-[-1]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-stone-400 text-xs gap-2">
                    <VideoOff className="w-6 h-6 text-rose-500" />
                    <span>Camera off</span>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold text-white/95 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md">
                  You {isMuted && '• Muted'}
                </span>
              </motion.div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className="relative z-30 flex items-center justify-center gap-4 sm:gap-6 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            {/* Microphone Toggle */}
            <button
              onClick={handleToggleMute}
              className={cn(
                'w-14 h-14 p-4 rounded-full backdrop-blur-md text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg',
                isMuted
                  ? 'bg-red-500/80 hover:bg-red-600 ring-2 ring-red-400'
                  : 'bg-white/15 hover:bg-white/25 border border-white/10'
              )}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>

            {/* Video Camera Toggle */}
            {isVideo && (
              <button
                onClick={handleToggleVideo}
                className={cn(
                  'w-14 h-14 p-4 rounded-full backdrop-blur-md text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg',
                  !isVideoEnabled
                    ? 'bg-red-500/80 hover:bg-red-600 ring-2 ring-red-400'
                    : 'bg-white/15 hover:bg-white/25 border border-white/10'
                )}
                title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {!isVideoEnabled ? (
                  <VideoOff className="w-6 h-6 text-white" />
                ) : (
                  <Video className="w-6 h-6 text-white" />
                )}
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              className="w-16 h-16 p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
              title="End Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
