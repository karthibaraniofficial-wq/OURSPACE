'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Camera,
  Film,
  FileText,
  X,
  Sparkles,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { uploadEncryptedMedia } from '@/lib/media/mediaStorageService';
import { InAppCameraModal } from '@/components/chat/InAppCameraModal';
import { formatBytes } from '@ourspace/shared';
import { cn } from '@/lib/utils';

export type UploadStage =
  | 'IDLE'
  | 'PREPARING ENCRYPTION'
  | 'CONNECTING TO OURSPACE'
  | 'UPLOADING TO DRIVE'
  | 'FINALIZING UPLOAD'
  | 'SAVING MESSAGE'
  | 'SENT'
  | 'UPLOAD FAILED';

interface MessageInputProps {
  onOpenGiphy: () => void;
  onOpenEmoji: () => void;
}

interface StagedMedia {
  file: File;
  previewUrl: string;
  category: 'image' | 'video' | 'document';
  width?: number;
  height?: number;
}

export function MessageInput({ onOpenGiphy, onOpenEmoji }: MessageInputProps) {
  const [text, setText] = useState('');
  const [stagedMediaList, setStagedMediaList] = useState<StagedMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadStage>('IDLE');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const activeUploadTaskRef = useRef<AbortController | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { user, space } = useAuthStore();
  const { sendMessage, activeReply, setActiveReply, setTyping } = useChatStore();

  let typingTimeout: NodeJS.Timeout | null = null;

  // ========================================================================
  // VOICE NOTE RECORDING STATE
  // ========================================================================
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
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
      stagedMediaList.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [stagedMediaList]);

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

  // Handle Photo selection (dedicated image picker with multiple photos support)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`Photo "${file.name}" exceeds the 50MB platform limit.`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        setUploadError(`File "${file.name}" is not a valid photograph.`);
        return;
      }
    }

    const newStaged: StagedMedia[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      category: 'image',
    }));

    setStagedMediaList((prev) => [...prev, ...newStaged]);
    setUploadError(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Handle generic file / document / video selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds the 50MB limit.`);
        return;
      }
    }

    const newStaged: StagedMedia[] = files.map((file) => {
      let category: 'image' | 'video' | 'document' = 'document';
      if (file.type.startsWith('image/')) category = 'image';
      else if (file.type.startsWith('video/')) category = 'video';
      return {
        file,
        previewUrl: category === 'image' || category === 'video' ? URL.createObjectURL(file) : '',
        category,
      };
    });

    setStagedMediaList((prev) => [...prev, ...newStaged]);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeStagedMedia = (index: number) => {
    setStagedMediaList((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
    setUploadProgress(0);
    setUploadError(null);
  };

  const clearAllStagedMedia = () => {
    stagedMediaList.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setStagedMediaList([]);
    setUploadProgress(0);
    setUploadError(null);
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
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Release hardware audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordedAudioBlob(null);
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
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioBlob(null);
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
    if (!space || !user || !recordedAudioBlob) return;

    try {
      setIsUploading(true);
      const audioFileName = `Voice_Note_${Date.now()}.webm`;
      const audioFile = new File([recordedAudioBlob], audioFileName, {
        type: recordedAudioBlob.type || 'audio/webm',
      });

      // Upload voice note with E2EE to Central Google Drive
      const uploadRes = await uploadEncryptedMedia({
        file: audioFile,
        fileName: audioFileName,
        spaceId: space.id,
        userId: user.id,
        category: 'VOICE_NOTES',
        onProgress: (percent) => setUploadProgress(percent),
      });

      await sendMessage({
        spaceId: space.id,
        senderId: user.id,
        content: text.trim() || null,
        type: 'audio',
        replyToId: activeReply?.id || null,
        attachment: {
          file_name: uploadRes.fileName,
          file_size: uploadRes.fileSize,
          file_type: uploadRes.fileType,
          media_category: 'audio',
          duration_seconds: recordingDuration || 1,
          signed_url: uploadRes.downloadUrl,
          download_url: uploadRes.downloadUrl,
          file_path: uploadRes.downloadUrl,
          storage_path: uploadRes.downloadUrl,
          iv: uploadRes.manifest.iv,
          wrapped_key: uploadRes.manifest.wrapped_key,
          ciphertext_sha256: uploadRes.manifest.ciphertext_sha256,
          is_e2ee: true,
        } as any,
      });

      cancelVoiceRecording();
      setText('');
      setIsUploading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send voice note';
      setUploadError(msg);
      setIsUploading(false);
    }
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

  const handleCancelUpload = () => {
    if (activeUploadTaskRef.current) {
      try {
        activeUploadTaskRef.current.abort();
      } catch {}
      activeUploadTaskRef.current = null;
    }
    setIsUploading(false);
    setUploadStage('IDLE');
    setUploadError('Upload cancelled by operator.');
  };

  const handleSend = async () => {
    if (!space || !user || isUploading) return;
    if (!text.trim() && stagedMediaList.length === 0) return;

    try {
      if (stagedMediaList.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);
        setUploadStage('PREPARING ENCRYPTION');

        // Retain stable message ID across retries so it is idempotent
        if (!activeMessageIdRef.current) {
          activeMessageIdRef.current =
            'msg-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
        }
        const messageId = activeMessageIdRef.current;

        setUploadStage('CONNECTING TO OURSPACE');

        const uploadedAttachments = [];
        const totalItems = stagedMediaList.length;

        for (let i = 0; i < totalItems; i++) {
          const item = stagedMediaList[i];
          const uploadResult = await uploadEncryptedMedia({
            file: item.file,
            fileName: item.file.name,
            spaceId: space.id,
            userId: user.id,
            category: item.category === 'video' ? 'CHAT_VIDEOS' : item.category === 'document' ? 'DOCUMENTS' : 'CHAT_IMAGES',
            onProgress: (percent) => {
              setUploadStage('UPLOADING TO DRIVE');
              const base = (i / totalItems) * 100;
              const contribution = percent / totalItems;
              setUploadProgress(Math.min(99, Math.round(base + contribution)));
            },
          });

          uploadedAttachments.push({
            file_name: uploadResult.fileName,
            file_size: uploadResult.fileSize,
            file_type: uploadResult.fileType,
            media_category: item.category,
            signed_url: uploadResult.downloadUrl,
            download_url: uploadResult.downloadUrl,
            file_path: uploadResult.downloadUrl,
            storage_path: uploadResult.downloadUrl,
            iv: uploadResult.manifest.iv,
            wrapped_key: uploadResult.manifest.wrapped_key,
            ciphertext_sha256: uploadResult.manifest.ciphertext_sha256,
            is_e2ee: true,
            width: item.width || null,
            height: item.height || null,
          });
        }

        activeUploadTaskRef.current = null;
        setUploadStage('FINALIZING UPLOAD');
        setUploadProgress(99);

        // Write message to Firestore storing only metadata (no large base64 or blob URLs)
        const primaryCat = uploadedAttachments[0]?.media_category;
        const msgType = primaryCat === 'image' ? 'image' : (primaryCat || 'image');

        setUploadStage('SAVING MESSAGE');
        await sendMessage({
          messageId,
          spaceId: space.id,
          senderId: user.id,
          content: text.trim() || null,
          type: msgType,
          replyToId: activeReply?.id || null,
          attachments: uploadedAttachments,
        });

        // 100% only after both upload and Firestore save complete
        setUploadProgress(100);
        setUploadStage('SENT');

        // Clean up object URLs only after confirmed Firestore write
        stagedMediaList.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        setStagedMediaList([]);
        setText('');
        activeMessageIdRef.current = null;

        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setUploadStage('IDLE');
        }, 500);
      } else {
        // Plain text message
        await sendMessage({
          spaceId: space.id,
          senderId: user.id,
          content: text.trim(),
          type: 'text',
          replyToId: activeReply?.id || null,
        });
        setText('');
      }

      setTyping(space.id, user.id, false);
    } catch (err: unknown) {
      console.error('[Send Message Error]', err);
      activeUploadTaskRef.current = null;
      setUploadStage('UPLOAD FAILED');
      const msg =
        (err as any)?.userMessage ||
        (err instanceof Error ? err.message : 'Upload failed. Please check network and retry.');
      setUploadError(msg);
      setIsUploading(false);
      // Retain staged attachments and text so user can retry without losing their work!
    }
  };

  // Handle instant photo captured via built-in in-app camera
  const handleCameraPhotoConfirm = async (
    file: File,
    thumbFile: File,
    dimensions: { width: number; height: number },
    caption?: string
  ) => {
    if (!space || !user) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadStage('PREPARING ENCRYPTION');

    const messageId =
      'msg-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    try {
      setUploadStage('UPLOADING TO DRIVE');
      const uploadResult = await uploadEncryptedMedia({
        file,
        fileName: file.name || `photo_${Date.now()}.jpg`,
        spaceId: space.id,
        userId: user.id,
        category: 'CHAT_IMAGES',
        onProgress: (percent) => {
          setUploadProgress(Math.min(95, percent));
        },
      });

      // 2. Resumable upload of thumbnail with E2EE
      let thumbUrl: string | undefined;
      try {
        const thumbResult = await uploadEncryptedMedia({
          file: thumbFile,
          fileName: `thumb_${uploadResult.fileName}`,
          spaceId: space.id,
          userId: user.id,
          category: 'THUMBNAILS',
        });
        thumbUrl = thumbResult.downloadUrl;
      } catch {
        // Thumbnail upload non-fatal
      }

      // 3. Save message with metadata only to Firestore
      setUploadStage('SAVING MESSAGE');
      setUploadProgress(99);
      await sendMessage({
        messageId,
        spaceId: space.id,
        senderId: user.id,
        content: caption || null,
        type: 'image',
        replyToId: activeReply?.id || null,
        attachment: {
          file_name: uploadResult.fileName,
          file_size: uploadResult.fileSize,
          file_type: uploadResult.fileType,
          media_category: 'image',
          signed_url: uploadResult.downloadUrl,
          download_url: uploadResult.downloadUrl,
          file_path: uploadResult.downloadUrl,
          storage_path: uploadResult.downloadUrl,
          thumbnail_url: thumbUrl || null,
          thumbnail_path: thumbUrl || null,
          width: dimensions.width,
          height: dimensions.height,
          iv: uploadResult.manifest.iv,
          wrapped_key: uploadResult.manifest.wrapped_key,
          ciphertext_sha256: uploadResult.manifest.ciphertext_sha256,
          is_e2ee: true,
        } as any,
      });

      setUploadStage('SENT');
      setUploadProgress(100);

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStage('IDLE');
      }, 500);

      setTyping(space.id, user.id, false);
    } catch (err: unknown) {
      console.error('[In-App Camera Upload Error]', err);
      activeUploadTaskRef.current = null;
      setUploadStage('UPLOAD FAILED');
      const msg =
        (err as any)?.userMessage ||
        (err instanceof Error ? err.message : 'Photo upload failed. Please try again.');
      setUploadError(msg);
      setIsUploading(false);
      throw err;
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4 glass-panel border-t border-rose-200/50 dark:border-purple-900/30">
      {/* Speech / Upload Error Banner */}
      {(speechError || uploadError) && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              {uploadError && (
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-rose-600 dark:text-rose-400">
                  UPLOAD FAILED
                </span>
              )}
              <span className="truncate max-w-[320px] sm:max-w-[480px]">
                {speechError || uploadError}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {uploadError && stagedMediaList.length > 0 && (
              <button
                type="button"
                onClick={handleSend}
                disabled={isUploading}
                className="px-2.5 py-1 rounded-xl bg-rose-200 dark:bg-rose-900/70 hover:bg-rose-300 dark:hover:bg-rose-800 text-rose-950 dark:text-rose-100 font-bold text-[11px] flex items-center gap-1 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSpeechError(null);
                setUploadError(null);
              }}
              className="p-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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

      {/* Dedicated Photograph & Media Preview Staging Tray (Supports Multiple Photos) */}
      {stagedMediaList.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/95 dark:bg-zinc-900 border border-rose-300 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-zinc-200">
            <span>
              {stagedMediaList.length} {stagedMediaList.length === 1 ? 'attachment' : 'attachments'} staged
            </span>
            {!isUploading && (
              <button
                type="button"
                onClick={clearAllStagedMedia}
                className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {stagedMediaList.map((item, idx) => (
              <div
                key={idx}
                className="relative group/staged flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-rose-50/60 dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 shrink-0"
              >
                {item.category === 'image' ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-rose-200">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : item.category === 'video' ? (
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                    <Film className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0 max-w-[120px]">
                  <p className="text-[11px] font-semibold text-stone-900 dark:text-zinc-100 truncate">
                    {item.file.name}
                  </p>
                  <p className="text-[10px] text-stone-500 dark:text-zinc-400">
                    {formatBytes(item.file.size)}
                  </p>
                </div>

                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => removeStagedMedia(idx)}
                    className="p-1 rounded-full hover:bg-rose-200 text-stone-400 hover:text-red-500 transition-colors ml-1"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Explicit Upload Stage & Progress Bar */}
          {isUploading && (
            <div className="w-full mt-2 p-2.5 rounded-xl bg-rose-50/80 dark:bg-zinc-800/80 border border-rose-200/80 dark:border-zinc-700 flex flex-col gap-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="uppercase tracking-wider font-mono">
                    {uploadStage === 'PREPARING ENCRYPTION'
                      ? 'PREPARING ENCRYPTION...'
                      : uploadStage === 'CONNECTING TO OURSPACE'
                      ? 'CONNECTING TO OURSPACE...'
                      : uploadStage === 'UPLOADING TO DRIVE'
                      ? `UPLOADING ${uploadProgress}%`
                      : uploadStage === 'FINALIZING UPLOAD'
                      ? 'FINALIZING UPLOAD...'
                      : uploadStage === 'SAVING MESSAGE'
                      ? 'SAVING MESSAGE...'
                      : uploadStage === 'SENT'
                      ? 'SENT'
                      : 'UPLOADING...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                    {uploadProgress}%
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-2 py-0.5 rounded-lg bg-rose-200 hover:bg-rose-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-[10px] font-bold text-rose-800 dark:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="w-full h-2 rounded-full bg-rose-100 dark:bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500 transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
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
                disabled={isUploading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/25 hover:scale-105 active:scale-95 transition-all"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? 'Sending...' : 'Send Voice Note'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Normal Typing Input Row */
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Dedicated Photo Picker Input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Generic Document File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.zip,video/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* 1. Dedicated In-App Camera Button */}
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            title="Take Photograph with Camera"
            className="p-2 sm:p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-rose-500 transition-colors shrink-0"
          >
            <Camera className="w-5 h-5" />
          </button>

          {/* 2. Dedicated Choose from Gallery Button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            title="Choose Photograph from Gallery"
            className="p-2 sm:p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-rose-500 transition-colors shrink-0"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* 3. Dedicated Attachment / Document / Video Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Document or Video"
            className="p-2 sm:p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-300 transition-colors shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* GIPHY Search Button */}
          <button
            type="button"
            onClick={onOpenGiphy}
            title="Search GIFs"
            className="p-2 sm:p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-300 font-bold text-xs transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">GIF</span>
          </button>

          {/* Voice Typing (Speech-to-Text) Button with Language Toggle */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isSpeechRecognizing ? 'Stop Voice Typing' : `Voice-to-Text Typing (${speechLanguage === 'en-US' ? 'English' : 'Tamil'})`}
              className={cn(
                'p-2 sm:p-2.5 rounded-2xl transition-all flex items-center gap-1',
                isSpeechRecognizing
                  ? 'bg-rose-500 text-white shadow-md animate-pulse'
                  : 'hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-300'
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSpeechLanguage((prev) => (prev === 'en-US' ? 'ta-IN' : 'en-US'))
              }
              title="Toggle Voice Typing Language (English / Tamil)"
              className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-200 ml-0.5"
            >
              {speechLanguage === 'en-US' ? 'EN' : 'TA'}
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 relative flex items-center min-w-0">
            <input
              type="text"
              value={text}
              disabled={isUploading}
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
              type="button"
              onClick={onOpenEmoji}
              title="Emoji"
              className="absolute right-3 text-stone-400 hover:text-rose-500 transition-colors"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Voice Note Record Trigger or Send Button */}
          {text.trim() || stagedMediaList.length > 0 ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={isUploading}
              className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-rose-500/25 flex items-center justify-center transition-all shrink-0"
              title="Send Message"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceRecording}
              className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-200 dark:hover:bg-rose-900/40 hover:scale-105 active:scale-95 flex items-center justify-center transition-all border border-rose-200/60 shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Built-in In-App Camera Modal */}
      <InAppCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onConfirmPhoto={handleCameraPhotoConfirm}
      />
    </div>
  );
}
