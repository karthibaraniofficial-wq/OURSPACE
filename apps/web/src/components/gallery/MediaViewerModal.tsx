'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Heart, FileText } from 'lucide-react';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  mediaType: string;
  title?: string;
}

export function MediaViewerModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  title = 'Media Preview',
}: MediaViewerModalProps) {
  if (!isOpen || !mediaUrl) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
        {/* Top Controls */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-white z-20">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{title}</h4>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={mediaUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Download file"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Preview Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative max-w-5xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center"
        >
          {mediaType === 'image' && (
            <img
              src={mediaUrl}
              alt="Full Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl"
            />
          )}

          {mediaType === 'video' && (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-2xl bg-black"
            />
          )}

          {mediaType === 'document' && (
            <div className="p-12 glass-panel rounded-3xl text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Document File</h3>
              <p className="text-xs text-stone-400">Click download to view this document offline</p>
              <a
                href={mediaUrl}
                download
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold text-sm shadow-lg hover:brightness-105"
              >
                Download Document
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
