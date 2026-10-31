'use client';

import React, { useState } from 'react';
import {
  Heart,
  Smile,
  Reply,
  Pin,
  Trash2,
  Edit2,
  Check,
  CheckCheck,
  FileText,
  Download,
  MoreHorizontal,
} from 'lucide-react';
import type { Message, UUID } from '@ourspace/types';
import { formatChatTimestamp, formatBytes } from '@ourspace/shared';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  currentUserId: UUID;
  onOpenMedia?: (url: string, type: string) => void;
}

const QUICK_REACTIONS = ['❤️', '😍', '😂', '🥺', '🎉', '💋'];

function ImageAttachment({
  att,
  onOpenMedia,
}: {
  att: any;
  onOpenMedia?: (url: string, type: string) => void;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/10 dark:bg-white/10 text-xs">
        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
        <span className="truncate font-semibold">{att.file_name}</span>
      </div>
    );
  }

  return (
    <img
      src={att.signed_url || att.file_path}
      alt={att.file_name}
      onError={() => setHasError(true)}
      onClick={() => onOpenMedia?.(att.signed_url || att.file_path, 'image')}
      className="max-h-72 w-full object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
    />
  );
}

function AudioMessagePlayer({ att, isMine }: { att: any; isMine: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(att.duration_seconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = Number(e.target.value);
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-black/10 dark:bg-white/10 min-w-[220px] max-w-sm">
      <audio
        ref={audioRef}
        src={att.signed_url || att.file_path}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (audioRef.current?.duration) setDuration(audioRef.current.duration);
        }}
      />

      <div className="flex items-center gap-2.5">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>

        {/* Progress Bar & Waveform Preview */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-rose-500 h-1.5 bg-black/20 rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between text-[10px] opacity-75 font-mono">
            <span>{formatSecs(currentTime)}</span>
            <span>{formatSecs(duration)}</span>
          </div>
        </div>

        {/* Playback Speed Pill */}
        <button
          onClick={cycleSpeed}
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 hover:bg-white/30 text-inherit transition-colors shrink-0"
          title="Toggle speed: 1x, 1.5x, 2x"
        >
          {playbackSpeed}x
        </button>
      </div>

      {att.transcript_text && (
        <div className="mt-1 pt-1 border-t border-white/10 text-[11px] leading-tight opacity-90">
          <span className="font-bold opacity-75">Transcription: </span>
          <span>{att.transcript_text}</span>
        </div>
      )}
    </div>
  );
}

  const {
    activeReply,
    setActiveReply,
    togglePinMessage,
    addReaction,
    deleteMessage,
    editMessage,
  } = useChatStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.content || '');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const isMine = message.sender_id === currentUserId;

  const handleSaveEdit = () => {
    if (editedText.trim() && editedText !== message.content) {
      editMessage(message.id, editedText.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col mb-4 max-w-[85%] sm:max-w-[70%]',
        isMine ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {/* Pinned Tag Indicator */}
      {message.pinned && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mb-1 px-1">
          <Pin className="w-3 h-3 fill-amber-500" />
          <span>Pinned Message</span>
        </div>
      )}

      {/* Reply Quote Header */}
      {message.reply_to && (
        <div
          className={cn(
            'text-xs px-3 py-1.5 rounded-2xl mb-1 border-l-2 max-w-full truncate opacity-85',
            isMine
              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-400'
              : 'bg-stone-200/60 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border-rose-400'
          )}
        >
          <span className="font-bold mr-1">Replying to:</span>
          <span>{message.reply_to.content || 'Attachment'}</span>
        </div>
      )}

      {/* Main Message Bubble */}
      <div
        className={cn(
          'relative rounded-3xl p-4 transition-all duration-200 break-words shadow-sm',
          isMine
            ? 'glass-bubble-mine rounded-br-sm'
            : 'glass-bubble-theirs rounded-bl-sm'
        )}
      >
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {message.attachments.map((att) => (
              <div key={att.id} className="rounded-2xl overflow-hidden">
                {att.media_category === 'image' && (
                  <ImageAttachment att={att} onOpenMedia={onOpenMedia} />
                )}

                {att.media_category === 'video' && (
                  <video
                    src={att.signed_url || att.file_path}
                    controls
                    className="max-h-72 w-full rounded-2xl bg-black"
                  />
                )}

                {att.media_category === 'audio' && (
                  <AudioMessagePlayer att={att} isMine={isMine} />
                )}

                {att.media_category === 'document' && (
                  <a
                    href={att.signed_url || att.file_path}
                    download={att.file_name}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-black/10 dark:bg-white/10 hover:bg-black/20 transition-colors text-inherit"
                  >
                    <div className="p-2 rounded-xl bg-white/20 text-inherit">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{att.file_name}</p>
                      <p className="text-[10px] opacity-75">{formatBytes(att.file_size)}</p>
                    </div>
                    <Download className="w-4 h-4 opacity-75" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Text Content / Editing */}
        {isEditing ? (
          <div className="flex flex-col gap-2 min-w-[240px]">
            <input
              type="text"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="text-sm rounded-xl px-2.5 py-1 text-stone-900 bg-white/95 focus:outline-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5 text-xs">
              <button
                onClick={() => setIsEditing(false)}
                className="px-2 py-0.5 rounded text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-2.5 py-0.5 rounded bg-white text-rose-600 font-bold"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          message.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )
        )}

        {/* Footer Meta: Timestamp, Edited tag, Receipt checks */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1.5 text-[10px] select-none',
            isMine ? 'text-white/80 justify-end' : 'text-stone-400 justify-start'
          )}
        >
          {message.is_edited && <span>(edited)</span>}
          <span>{formatChatTimestamp(message.created_at)}</span>
          {isMine && (
            <span title="Read by partner">
              <CheckCheck className="w-3.5 h-3.5 text-white/90" />
            </span>
          )}
        </div>
      </div>

      {/* Reactions Row */}
      {message.reactions && message.reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-1">
          {message.reactions.map((rx) => (
            <button
              key={rx.id}
              onClick={() => addReaction(message.id, message.space_id, currentUserId, rx.emoji)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium glass-card border border-rose-200/50 hover:scale-105 transition-all',
                rx.user_id === currentUserId && 'bg-rose-100/90 border-rose-400'
              )}
            >
              <span>{rx.emoji}</span>
            </button>
          ))}
        </div>
      )}

      {/* Floating Action Menu on Hover */}
      <div
        className={cn(
          'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1 p-1 rounded-full glass-card border border-rose-200/60 shadow-lg',
          isMine ? '-left-28 -top-3' : '-right-28 -top-3'
        )}
      >
        {/* Quick Love Heart */}
        <button
          onClick={() => addReaction(message.id, message.space_id, currentUserId, '❤️')}
          className="p-1 rounded-full hover:bg-rose-100 text-rose-500 transition-colors"
          title="React with ❤️"
        >
          <Heart className="w-3.5 h-3.5 fill-rose-500" />
        </button>

        {/* Quick Reactions Toggle */}
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className="p-1 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
          title="React"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        {/* Reply */}
        <button
          onClick={() => setActiveReply(message)}
          className="p-1 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
          title="Reply"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* Pin */}
        <button
          onClick={() => togglePinMessage(message.id)}
          className={cn(
            'p-1 rounded-full hover:bg-stone-100 text-stone-500 transition-colors',
            message.pinned && 'text-amber-500'
          )}
          title={message.pinned ? 'Unpin' : 'Pin message'}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>

        {/* Edit (if mine) */}
        {isMine && (
          <button
            onClick={() => {
              setEditedText(message.content || '');
              setIsEditing(true);
            }}
            className="p-1 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => deleteMessage(message.id, isMine, currentUserId)}
          className="p-1 rounded-full hover:bg-red-50 text-red-500 transition-colors"
          title="Delete message"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Quick Emoji Picker */}
      {showReactionPicker && (
        <div
          className={cn(
            'absolute top-8 z-30 flex items-center gap-1.5 p-2 rounded-2xl glass-card border border-rose-300 shadow-xl animate-in fade-in zoom-in-95',
            isMine ? 'right-0' : 'left-0'
          )}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                addReaction(message.id, message.space_id, currentUserId, emoji);
                setShowReactionPicker(false);
              }}
              className="text-lg hover:scale-125 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
