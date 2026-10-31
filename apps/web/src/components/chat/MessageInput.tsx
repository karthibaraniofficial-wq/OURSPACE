'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Film,
  FileText,
  X,
  Sparkles,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Trash2,
  Languages,
  Check,
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import type { MessageAttachment } from '@ourspace/types';
import { cn } from '@/lib/utils';

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

  // ========================================================================
  // VOICE NOTE RECORDING STATE
  // ========================================================================
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // ========================================================================
  // VOICE-TO-TEXT (SPEECH RECOGNITION) STATE
  // English (en-US) & Tamil (ta-IN)
  // ========================================================================
  const [isSpeechRecognizing, setIsSpeechRecognizing] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<'en-US' | 'ta-IN'>('en-US');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
    };
  }, []);

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

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedAttachment({
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        media_category: category,
        signed_url: dataUrl,
        file_path: 'inline/' + file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  // ========================================================================
  // VOICE NOTE HANDLERS
  // ========================================================================
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudioUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordedAudioUrl(null);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      alert('Microphone permission is required to record voice notes.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordedAudioUrl(null);
    setRecordingDuration(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (audioPreviewRef.current) audioPreviewRef.current.pause();
    setIsPlayingPreview(false);
  };

  const togglePreviewPlayback = () => {
    if (!recordedAudioUrl) return;
    if (!audioPreviewRef.current) {
      audioPreviewRef.current = new Audio(recordedAudioUrl);
      audioPreviewRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const sendVoiceNote = async () => {
    if (!space || !user || !recordedAudioUrl) return;

    await sendMessage({
      spaceId: space.id,
      senderId: user.id,
      content: text.trim() || null,
      type: 'audio',
      replyToId: activeReply?.id || null,
      attachment: {
        file_name: `Voice_Note_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`,
        file_size: audioChunksRef.current.reduce((acc, c) => acc + c.size, 0),
        file_type: 'audio/webm',
        media_category: 'audio',
        duration_seconds: recordingDuration || 1,
        signed_url: recordedAudioUrl,
        file_path: 'inline/voice_note.webm',
      },
    });

    cancelVoiceRecording();
    setText('');
  };

  // ========================================================================
  // VOICE-TO-TEXT SPEECH RECOGNITION
  // ========================================================================
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    if (isSpeechRecognizing) {
      recognitionRef.current?.stop();
      setIsSpeechRecognizing(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLanguage;

      recognition.onstart = () => {
        setIsSpeechRecognizing(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setText((prev) => (prev ? prev + ' ' + transcript : transcript));
      };

      recognition.onerror = (event: any) => {
        setIsSpeechRecognizing(false);
        setSpeechError('Speech recognition error: ' + event.error);
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsSpeechRecognizing(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsSpeechRecognizing(false);
      setSpeechError('Could not start microphone speech recognition.');
      setTimeout(() => setSpeechError(null), 4000);
    }
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
          : selectedAttachment.media_category === 'audio'
          ? 'audio'
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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 p-4 glass-panel border-t border-rose-200/50 dark:border-purple-900/30">
      {/* Speech Error Banner */}
      {speechError && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-700 text-xs flex items-center justify-between">
          <span>{speechError}</span>
          <button onClick={() => setSpeechError(null)} className="text-amber-500 hover:text-amber-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

      {/* Voice Recording / Preview Mode */}
      {isRecording || recordedAudioUrl ? (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-purple-950/30 border border-rose-300 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={cancelVoiceRecording}
              className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
              title="Discard Recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {isRecording ? (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="font-mono text-xs font-bold text-red-600">
                  {formatTimer(recordingDuration)}
                </span>
                {/* Visualizer Waveform Bar */}
                <div className="flex items-center gap-1 ml-2">
                  {[4, 12, 8, 16, 10, 14, 6, 12].map((height, i) => (
                    <div
                      key={i}
                      className="w-1 bg-rose-500 rounded-full animate-pulse"
                      style={{
                        height: `${height}px`,
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePreviewPlayback}
                  className="p-2 rounded-xl bg-rose-500 text-white hover:brightness-105 transition-all shadow-sm"
                  title="Preview Voice Note"
                >
                  {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>
                <span className="text-xs font-bold text-stone-700 dark:text-zinc-200">
                  Voice Note ({formatTimer(recordingDuration)})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isRecording ? (
              <button
                onClick={stopVoiceRecording}
                className="px-3.5 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-black transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Done</span>
              </button>
            ) : (
              <button
                onClick={sendVoiceNote}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/25 hover:scale-105 active:scale-95 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Voice Note</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Normal Typing Input Row */
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

          {/* Voice Typing (Speech-to-Text) Button with Language Toggle */}
          <div className="flex items-center">
            <button
              onClick={toggleSpeechRecognition}
              title={isSpeechRecognizing ? 'Stop Voice Typing' : `Voice-to-Text Typing (${speechLanguage === 'en-US' ? 'English' : 'Tamil'})`}
              className={cn(
                'p-2.5 rounded-2xl transition-all flex items-center gap-1',
                isSpeechRecognizing
                  ? 'bg-rose-500 text-white shadow-md animate-pulse'
                  : 'hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-300'
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setSpeechLanguage((prev) => (prev === 'en-US' ? 'ta-IN' : 'en-US'))
              }
              title="Toggle Voice Typing Language (English / Tamil)"
              className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-100 text-rose-700 hover:bg-rose-200 ml-0.5"
            >
              {speechLanguage === 'en-US' ? 'EN' : 'TA'}
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={text}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder={isSpeechRecognizing ? 'Listening... speak naturally' : 'Type a loving message...'}
              className={cn(
                'w-full rounded-2xl glass-input py-3 pl-4 pr-10 text-sm text-stone-800 dark:text-zinc-100 placeholder:text-stone-400 focus:outline-none transition-all',
                isSpeechRecognizing && 'ring-2 ring-rose-400/60 bg-rose-50/20'
              )}
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

          {/* Voice Note Record Trigger or Send Button */}
          {text.trim() || selectedAttachment ? (
            <button
              onClick={handleSend}
              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 flex items-center justify-center transition-all"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={startVoiceRecording}
              className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-200 dark:hover:bg-rose-900/40 hover:scale-105 active:scale-95 flex items-center justify-center transition-all border border-rose-200/60"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
