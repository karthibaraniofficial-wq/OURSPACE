'use client';

import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Film,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { MessageAttachment } from '@ourspace/types';

interface MessageInputProps {
  onOpenGiphy: () => void;
  onOpenEmoji: () => void;
}

export function MessageInput({ onOpenGiphy, onOpenEmoji }: MessageInputProps) {
  const [text, setText] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<Partial<MessageAttachment> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, space } = useAuthStore();
  const { sendMessage, activeReply, setActiveReply, setTyping } = useChatStore();

  let typingTimeout: NodeJS.Timeout | null = null;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (space && user) {
      setTyping(space.id, user.id, true);
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setTyping(space.id, user.id, false);
      }, 2000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let category: 'image' | 'video' | 'document' | 'audio' = 'document';
    if (file.type.startsWith('image/')) category = 'image';
    else if (file.type.startsWith('video/')) category = 'video';
    else if (file.type.startsWith('audio/')) category = 'audio';

    const localUrl = URL.createObjectURL(file);
    setSelectedAttachment({
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      media_category: category,
      signed_url: localUrl,
      file_path: 'local/' + file.name,
    });
  };

  const handleSend = async () => {
    if (!space || !user) return;
    if (!text.trim() && !selectedAttachment) return;

    await sendMessage({
      spaceId: space.id,
      senderId: user.id,
      content: text.trim() || null,
      type: selectedAttachment
        ? selectedAttachment.media_category === 'image'
          ? 'image'
          : selectedAttachment.media_category === 'video'
          ? 'video'
          : 'document'
        : 'text',
      replyToId: activeReply?.id || null,
      attachment: selectedAttachment || undefined,
    });

    setText('');
    setSelectedAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTyping(space.id, user.id, false);
  };

  return (
    <div className="flex flex-col gap-2 p-4 glass-panel border-t border-rose-200/50 dark:border-purple-900/30">
      {/* Active Reply Banner */}
      {activeReply && (
        <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-rose-600">Replying to:</span>
            <span className="text-stone-600 dark:text-zinc-300 truncate">
              {activeReply.content || 'Attachment'}
            </span>
          </div>
          <button
            onClick={() => setActiveReply(null)}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Staging Card */}
      {selectedAttachment && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-zinc-800 border border-rose-300 shadow-md">
          <div className="flex items-center gap-3">
            {selectedAttachment.media_category === 'image' && (
              <img
                src={selectedAttachment.signed_url}
                alt="Preview"
                className="w-10 h-10 rounded-xl object-cover"
              />
            )}
            {selectedAttachment.media_category === 'video' && (
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Film className="w-5 h-5" />
              </div>
            )}
            {selectedAttachment.media_category === 'document' && (
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-stone-800 dark:text-zinc-100 truncate max-w-xs">
                {selectedAttachment.file_name}
              </p>
              <p className="text-[10px] text-stone-400">Ready to send</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedAttachment(null)}
            className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Input Row */}
      <div className="flex items-center gap-2">
        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Attachment Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Share Photo, Video, or Document"
          className="p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-300 transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* GIPHY Search Button */}
        <button
          onClick={onOpenGiphy}
          title="Search GIFs"
          className="p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-300 font-bold text-xs transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="hidden sm:inline">GIF</span>
        </button>

        {/* Text Input */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={text}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Type a loving message..."
            className="w-full rounded-2xl glass-input py-3 pl-4 pr-10 text-sm text-stone-800 dark:text-zinc-100 placeholder:text-stone-400 focus:outline-none"
          />

          {/* Quick Emoji Picker Button */}
          <button
            onClick={onOpenEmoji}
            title="Emoji"
            className="absolute right-3 text-stone-400 hover:text-rose-500 transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() && !selectedAttachment}
          className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 hover:brightness-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white shadow-md shadow-rose-500/25 flex items-center justify-center transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
