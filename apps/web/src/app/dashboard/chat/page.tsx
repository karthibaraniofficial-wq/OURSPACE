'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Pin,
  Heart,
  Phone,
  Video,
  Radio,
  X,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore } from '@/store/useCallStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { GiphyPickerModal } from '@/components/chat/GiphyPickerModal';
import { EmojiPickerModal } from '@/components/chat/EmojiPickerModal';
import { MediaViewerModal } from '@/components/gallery/MediaViewerModal';
import { Button } from '@/components/ui/Button';

export default function ChatPage() {
  const { user, space, partner } = useAuthStore();
  const {
    messages,
    isPartnerTyping,
    pinnedMessages,
    searchQuery,
    setSearchQuery,
  } = useChatStore();
  const { initiateCall } = useCallStore();

  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string } | null>(null);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!space || !user || !partner) return;
    initiateCall({
      spaceId: space.id,
      caller: user,
      receiver: partner,
      type,
    });
  };

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery) return true;
    return m.content?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col rounded-3xl glass-panel border border-rose-200/50 dark:border-purple-900/30 overflow-hidden shadow-xl">
      {/* Chat Top Header */}
      <div className="h-16 px-6 glass-card border-b border-rose-100/60 dark:border-zinc-800 flex items-center justify-between z-10 shrink-0">
        {/* Partner Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            {partner?.avatar_url ? (
              <img
                src={partner.avatar_url}
                alt={partner.display_name}
                className="w-10 h-10 rounded-2xl object-cover ring-2 ring-rose-400"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-bold flex items-center justify-center">
                {partner?.display_name?.charAt(0) || 'P'}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-stone-900" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-100 flex items-center gap-1.5">
              {partner?.display_name || 'My Partner'}
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            </h3>
            <p className="text-[11px] text-stone-400 flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
              <span>Online • Encrypted 2-Person Sanctuary</span>
            </p>
          </div>
        </div>

        {/* Top Actions: Search, Pinned, Calling */}
        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          {isSearchActive ? (
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="glass-input rounded-xl py-1.5 pl-3 pr-8 text-xs focus:outline-none w-36 sm:w-56"
              />
              <button
                onClick={() => {
                  setIsSearchActive(false);
                  setSearchQuery('');
                }}
                className="absolute right-2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSearchActive(true)}
              className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 transition-colors"
              title="Search conversation"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Pinned Messages Indicator */}
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinnedModal(!showPinnedModal)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200/60 hover:bg-amber-100 transition-colors"
              title="View pinned messages"
            >
              <Pin className="w-3.5 h-3.5 fill-amber-500" />
              <span className="hidden sm:inline">{pinnedMessages.length} Pinned</span>
            </button>
          )}

          {/* Audio Call */}
          <button
            onClick={() => handleStartCall('audio')}
            className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-rose-500 transition-colors"
            title="Audio call"
          >
            <Phone className="w-4 h-4 fill-rose-500/20" />
          </button>

          {/* Video Call */}
          <button
            onClick={() => handleStartCall('video')}
            className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-rose-500 transition-colors"
            title="Video call"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pinned Messages Drawer if open */}
      {showPinnedModal && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/60 p-3 flex flex-col gap-2 z-10">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
            <span>Pinned Messages ({pinnedMessages.length})</span>
            <button onClick={() => setShowPinnedModal(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {pinnedMessages.map((pm) => (
              <div
                key={pm.id}
                className="text-xs p-2 rounded-xl bg-white/80 dark:bg-zinc-800 text-stone-700 dark:text-zinc-200 border border-amber-200/40 truncate"
              >
                <span className="font-semibold text-rose-600 mr-2">
                  {pm.sender_id === user?.id ? 'You' : partner?.display_name}:
                </span>
                <span>{pm.content || 'Media attachment'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
        {/* Sanctuary Intro Banner */}
        <div className="text-center my-6 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-bold">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <h4 className="text-sm font-bold text-stone-700 dark:text-zinc-200">
            Your Private Conversation
          </h4>
          <p className="text-xs text-stone-400 max-w-sm">
            Messages, photographs, audio notes, and videos sent here are strictly accessible to you and{' '}
            {partner?.display_name || 'your partner'}.
          </p>
        </div>

        {/* Messages List */}
        {user &&
          filteredMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={user.id}
              onOpenMedia={(url, type) => setSelectedMedia({ url, type })}
            />
          ))}

        {/* Partner Typing Indicator */}
        {isPartnerTyping && partner && (
          <div className="flex items-center gap-2 text-xs text-stone-400 font-medium mb-3 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-bounce" />
            <span>{partner.display_name} is typing sweet words...</span>
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      {/* Message Input Bar */}
      <MessageInput
        onOpenGiphy={() => setIsGiphyOpen(true)}
        onOpenEmoji={() => setIsEmojiOpen(true)}
      />

      {/* GIPHY Search Modal */}
      <GiphyPickerModal
        isOpen={isGiphyOpen}
        onClose={() => setIsGiphyOpen(false)}
      />

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={isEmojiOpen}
        onClose={() => setIsEmojiOpen(false)}
      />

      {/* Media Lightbox Viewer */}
      <MediaViewerModal
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        mediaUrl={selectedMedia?.url || null}
        mediaType={selectedMedia?.type || 'image'}
      />
    </div>
  );
}
