'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Signal,
  Heart,
  Volume2,
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
    toggleMute,
    toggleVideo,
    endCall,
  } = useCallStore();

  if (!activeCall) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideo = activeCall.call_type === 'video';
  const partner = activeCall.receiver;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl flex flex-col justify-between bg-zinc-950"
        >
          {/* Top Bar: Call Info & Quality Indicator */}
          <div className="relative z-20 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Heart className="w-5 h-5 fill-rose-500" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {partner?.display_name || 'My Partner'}
                </h4>
                <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {activeCall.status === 'ringing'
                      ? 'Ringing...'
                      : `In Call • ${formatTimer(callDuration)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold backdrop-blur-md">
                <Signal className="w-3.5 h-3.5" />
                <span className="capitalize">{networkQuality}</span>
              </div>
            </div>
          </div>

          {/* Main Video / Audio Visualizer Area */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            {isVideo && isVideoEnabled ? (
              <div className="absolute inset-0 w-full h-full">
                {/* Simulated high quality video feed */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&auto=format&fit=crop&q=80"
                  alt="Partner Video Feed"
                  className="w-full h-full object-cover brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <span className="absolute -inset-4 rounded-full bg-rose-500/20 animate-pulse" />
                  {partner?.avatar_url ? (
                    <img
                      src={partner.avatar_url}
                      alt={partner.display_name}
                      className="w-32 h-32 rounded-full object-cover ring-4 ring-rose-500 shadow-2xl"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-bold text-4xl flex items-center justify-center shadow-2xl">
                      {partner?.display_name?.charAt(0) || 'P'}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{partner?.display_name}</h3>
                  <p className="text-sm text-stone-400 mt-1">
                    {activeCall.status === 'ringing' ? 'Connecting to private call...' : 'Private Audio Call Connected'}
                  </p>
                </div>
              </div>
            )}

            {/* Self Picture-in-Picture Video */}
            {isVideo && (
              <motion.div
                drag
                dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
                className="absolute top-20 right-6 w-36 h-48 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-stone-900 cursor-grab active:cursor-grabbing z-20"
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80"
                  alt="Self view"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold text-white/90 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md">
                  You
                </span>
              </motion.div>
            )}
          </div>

          {/* Bottom Call Control Bar */}
          <div className="relative z-20 flex items-center justify-center gap-4 sm:gap-6 p-6 bg-gradient-to-t from-black/80 to-transparent">
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={cn(
                'w-13 h-13 p-3.5 rounded-full backdrop-blur-md text-white transition-all hover:scale-105',
                isMuted
                  ? 'bg-red-500/80 hover:bg-red-600'
                  : 'bg-white/15 hover:bg-white/25 border border-white/10'
              )}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Video Camera Toggle */}
            {isVideo && (
              <button
                onClick={toggleVideo}
                className={cn(
                  'w-13 h-13 p-3.5 rounded-full backdrop-blur-md text-white transition-all hover:scale-105',
                  !isVideoEnabled
                    ? 'bg-red-500/80 hover:bg-red-600'
                    : 'bg-white/15 hover:bg-white/25 border border-white/10'
                )}
              >
                {!isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="w-16 h-16 p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
