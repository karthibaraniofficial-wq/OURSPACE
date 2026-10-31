'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Play,
  Pause,
  Image as ImageIcon,
  RotateCw,
  Maximize2,
} from 'lucide-react';
import type { Message, UUID } from '@ourspace/types';
import { formatChatTimestamp, formatBytes } from '@ourspace/shared';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/lib/utils';
import { resolveMediaDownloadUrl, clearMediaUrlCache } from '@/lib/firebase/storage';
import { fetchAndDecryptMediaUrl } from '@/lib/media/mediaStorageService';
import { logMediaDiagnostic } from '@/lib/diagnostics/mediaDiagnostics';

interface MessageBubbleProps {
  message: Message;
  currentUserId: UUID;
  onOpenMedia?: (url: string, type: string) => void;
}

const QUICK_REACTIONS = ['❤️', '😍', '😂', '🥺', '🎉', '💋'];

function ImageAttachment({
  att,
  onOpenMedia,
  messageId,
  spaceId,
}: {
  att: any;
  onOpenMedia?: (url: string, type: string) => void;
  messageId?: string;
  spaceId?: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    const direct = att.download_url || att.signed_url;
    if (direct && (direct.startsWith('blob:') || direct.startsWith('data:'))) {
      return direct;
    }
    return null;
  });
  const [isResolving, setIsResolving] = useState<boolean>(!resolvedUrl);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  const rawPath = att.storage_path || att.file_path;
  const initialUrl = att.download_url || att.signed_url;

  useEffect(() => {
    let isMounted = true;

    async function resolve() {
      // 1. Transparent E2EE client-side decryption for Google Drive attachments
      if (att.is_e2ee || (initialUrl && initialUrl.startsWith('/api/media/')) || att.iv) {
        try {
          const candidate = initialUrl || rawPath;
          const decryptedUrl = await fetchAndDecryptMediaUrl(candidate, att, spaceId);
          if (isMounted) {
            setResolvedUrl(decryptedUrl);
            setIsResolving(false);
          }
          return;
        } catch (decryptErr) {
          console.warn('[ImageAttachment] E2EE decryption attempt fallback:', decryptErr);
        }
      }

      // 2. Direct HTTP URL fallback (e.g. legacy Firebase Storage or blob)
      if (initialUrl && (initialUrl.startsWith('http://') || initialUrl.startsWith('https://') || initialUrl.startsWith('data:') || initialUrl.startsWith('blob:'))) {
        if (isMounted) {
          setResolvedUrl(initialUrl);
          setIsResolving(false);
        }
        return;
      }

      if (rawPath && (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('blob:'))) {
        if (isMounted) {
          setResolvedUrl(rawPath);
          setIsResolving(false);
        }
        return;
      }

      if (!rawPath) {
        if (isMounted) {
          setHasError(true);
          setIsResolving(false);
        }
        return;
      }

      setIsResolving(true);
      setHasError(false);

      try {
        const url = await resolveMediaDownloadUrl(rawPath, initialUrl);
        if (!isMounted) return;
        if (url) {
          setResolvedUrl(url);
          setIsResolving(false);
        } else {
          setHasError(true);
          setIsResolving(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setHasError(true);
        setIsResolving(false);
      }
    }

    resolve();

    return () => {
      isMounted = false;
    };
  }, [rawPath, initialUrl, retryCount, messageId, att.file_name, spaceId]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rawPath) {
      clearMediaUrlCache(rawPath);
    }
    setHasError(false);
    setIsLoading(true);
    setResolvedUrl(null);
    setRetryCount((prev) => prev + 1);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    logMediaDiagnostic('IMAGE_RENDERED', {
      messageId,
      fileName: att.file_name,
      url: resolvedUrl?.substring(0, 50),
    });
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
    logMediaDiagnostic('IMAGE_LOAD_FAILED', {
      messageId,
      fileName: att.file_name,
      reason: 'HTMLImageElement onError triggered',
    });
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-dashed border-rose-300 dark:border-rose-800 text-center gap-2 max-w-sm my-1">
        <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-500">
          <ImageIcon className="w-6 h-6" />
        </div>
        <div className="min-w-0 max-w-full">
          <p className="text-xs font-semibold text-stone-700 dark:text-zinc-200 truncate">
            {att.file_name || 'Photograph'}
          </p>
          <p className="text-[10px] text-rose-500/80">Failed to load photograph</p>
        </div>
        <button
          onClick={handleRetry}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-transform active:scale-95"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Tap to retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative group/photo rounded-2xl sm:rounded-3xl overflow-hidden shadow-md max-w-full my-1 bg-stone-100 dark:bg-zinc-900">
      {(isResolving || isLoading) && (
        <div className="w-56 sm:w-64 h-40 sm:h-56 max-w-full rounded-2xl bg-gradient-to-br from-rose-100/50 to-pink-50/50 dark:from-zinc-800 dark:to-zinc-900 animate-pulse flex flex-col items-center justify-center text-rose-400 gap-2">
          <ImageIcon className="w-8 h-8 animate-bounce" />
          <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400">
            {isResolving ? 'Resolving photo...' : 'Loading photo...'}
          </span>
        </div>
      )}

      {resolvedUrl && (
        <img
          src={resolvedUrl}
          alt={att.file_name || 'Photograph'}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={() => onOpenMedia?.(resolvedUrl, 'image')}
          className={cn(
            'max-h-[55vh] sm:max-h-96 w-auto max-w-full rounded-2xl sm:rounded-3xl object-contain sm:object-cover cursor-pointer transition-transform duration-300 group-hover/photo:scale-[1.01]',
            (isResolving || isLoading) && 'hidden'
          )}
        />
      )}

      {!isResolving && !isLoading && resolvedUrl && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
          <span className="text-[11px] font-medium text-white/90 truncate max-w-[60%]">
            {att.file_name}
          </span>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <a
              href={resolvedUrl}
              download={att.file_name || 'photo.jpg'}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white transition-colors"
              title="Download photograph"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => onOpenMedia?.(resolvedUrl, 'image')}
              className="p-1.5 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white transition-colors"
              title="Full screen view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoMessagePlayer({ att, spaceId }: { att: any; spaceId?: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function resolve() {
      const candidate = att.download_url || att.signed_url || att.file_path;
      if (!candidate) return;
      if (att.is_e2ee || candidate.startsWith('/api/media/') || att.iv) {
        try {
          const dec = await fetchAndDecryptMediaUrl(candidate, att, spaceId);
          if (isMounted) {
            setVideoUrl(dec);
            return;
          }
        } catch (err) {
          console.warn('[VideoMessagePlayer] Decryption fallback:', err);
        }
      }
      if (isMounted) setVideoUrl(candidate);
    }
    resolve();
    return () => { isMounted = false; };
  }, [att, spaceId]);

  return (
    <video
      src={videoUrl || att.download_url || att.signed_url || att.file_path}
      controls
      className="max-h-72 w-full rounded-2xl bg-black"
    />
  );
}

function AudioMessagePlayer({ att, isMine, spaceId }: { att: any; isMine: boolean; spaceId?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(att.duration_seconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function resolve() {
      const candidate = att.download_url || att.signed_url || att.file_path;
      if (!candidate) return;
      if (att.is_e2ee || candidate.startsWith('/api/media/') || att.iv) {
        try {
          const dec = await fetchAndDecryptMediaUrl(candidate, att, spaceId);
          if (isMounted) {
            setAudioUrl(dec);
            return;
          }
        } catch (err) {
          console.warn('[AudioMessagePlayer] Decryption fallback:', err);
        }
      }
      if (isMounted) setAudioUrl(candidate);
    }
    resolve();
    return () => { isMounted = false; };
  }, [att, spaceId]);

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
        src={audioUrl || att.download_url || att.signed_url || att.file_path}
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

export function MessageBubble({ message, currentUserId, onOpenMedia }: MessageBubbleProps) {
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
                {(att.media_category === 'image' || att.media_category === 'images' || att.file_type?.startsWith('image/')) && (
                  <ImageAttachment att={att} onOpenMedia={onOpenMedia} messageId={message.id} spaceId={message.space_id} />
                )}

                {(att.media_category === 'video' || att.media_category === 'videos' || att.file_type?.startsWith('video/')) && (
                  <VideoMessagePlayer att={att} spaceId={message.space_id} />
                )}

                {(att.media_category === 'audio' || att.file_type?.startsWith('audio/')) && (
                  <AudioMessagePlayer att={att} isMine={isMine} spaceId={message.space_id} />
                )}

                {(att.media_category === 'document' || (!att.media_category && !att.file_type?.startsWith('image/') && !att.file_type?.startsWith('video/') && !att.file_type?.startsWith('audio/'))) && (
                  <a
                    href={att.download_url || att.signed_url || att.file_path}
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
