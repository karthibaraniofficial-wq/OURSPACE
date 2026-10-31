'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, Heart } from 'lucide-react';
import { useCallStore } from '@/store/useCallStore';

export function IncomingCallDialog() {
  const { incomingCall, acceptCall, declineCall } = useCallStore();

  if (!incomingCall) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-sm rounded-3xl glass-panel p-8 text-center shadow-2xl border border-rose-300/40"
        >
          {/* Animated Pulsing Avatar Rings */}
          <div className="relative inline-block mb-6">
            <span className="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping" />
            <span className="absolute -inset-2 rounded-full bg-rose-500/30 animate-pulse" />
            {incomingCall.caller?.avatar_url ? (
              <img
                src={incomingCall.caller.avatar_url}
                alt={incomingCall.caller.display_name}
                className="relative w-24 h-24 rounded-full object-cover ring-4 ring-rose-500 shadow-xl"
              />
            ) : (
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-bold text-3xl flex items-center justify-center shadow-xl">
                {incomingCall.caller?.display_name?.charAt(0) || 'P'}
              </div>
            )}
          </div>

          <h3 className="text-xl font-extrabold text-stone-900 dark:text-zinc-100">
            {incomingCall.caller?.display_name || 'Your Partner'}
          </h3>
          <p className="text-xs text-rose-500 font-semibold mt-1 flex items-center justify-center gap-1.5">
            {incomingCall.call_type === 'video' ? (
              <>
                <Video className="w-4 h-4" />
                <span>Incoming Video Call...</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                <span>Incoming Audio Call...</span>
              </>
            )}
          </p>

          <p className="text-xs text-stone-400 mt-2">
            Your private sanctuary line is ringing ❤️
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-8 mt-8">
            <button
              onClick={declineCall}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                Decline
              </span>
            </button>

            <button
              onClick={acceptCall}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform animate-bounce">
                <Phone className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Accept
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
