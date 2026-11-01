'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  X,
  RotateCcw,
  FlipHorizontal,
  Zap,
  ZapOff,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InAppCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPhoto: (
    file: File,
    thumbnailFile: File,
    dimensions: { width: number; height: number },
    caption?: string
  ) => Promise<void>;
}

export function InAppCameraModal({
  isOpen,
  onClose,
  onConfirmPhoto,
}: InAppCameraModalProps) {
  const [mounted, setMounted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [photoDimensions, setPhotoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [availableCamerasCount, setAvailableCamerasCount] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Stop all camera tracks helper
  const stopCurrentStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Enumerate cameras to check if multi-camera flip is available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCamerasCount(videoDevices.length);
      }).catch(() => {});
    }
  }, []);

  // Start webcam / camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported by this browser.');
      }

      // Stop previous tracks if switching
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }

      // Check for torch / flash support
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() || {}) as any;
        setIsTorchSupported(Boolean(capabilities.torch));
      }
    } catch (err: unknown) {
      let message = 'Unable to access camera.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera permission was denied. Please allow camera access in browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Camera is currently in use by another application.';
        } else {
          message = err.message;
        }
      }
      setCameraError(message);
    }
  }, [facingMode, stream]);

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen && !capturedPhotoUrl) {
      startCamera();
    } else if (!isOpen) {
      stopCurrentStream();
      setCapturedPhotoUrl(null);
      setCapturedBlob(null);
      setCaption('');
      setCameraError(null);
      setIsSending(false);
      setIsTorchOn(false);
    }

    return () => {
      stopCurrentStream();
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending, onClose]);

  // Toggle front/rear camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && isTorchSupported) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch {}
    }
  };

  // Capture still photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, mirror horizontally
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const photoUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedPhotoUrl(photoUrl);
        setPhotoDimensions({ width, height });

        // Temporarily pause camera stream to preserve battery
        stopCurrentStream();
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake photo
  const retakePhoto = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setCaption('');
    startCamera();
  };

  // Generate thumbnail canvas
  const createThumbnailBlob = (sourceCanvas: HTMLCanvasElement): Promise<Blob> => {
    return new Promise((resolve) => {
      const thumbCanvas = document.createElement('canvas');
      const maxThumbDim = 320;
      let thumbW = sourceCanvas.width;
      let thumbH = sourceCanvas.height;

      if (thumbW > thumbH) {
        if (thumbW > maxThumbDim) {
          thumbH = Math.round((thumbH * maxThumbDim) / thumbW);
          thumbW = maxThumbDim;
        }
      } else {
        if (thumbH > maxThumbDim) {
          thumbW = Math.round((thumbW * maxThumbDim) / thumbH);
          thumbH = maxThumbDim;
        }
      }

      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const ctx = thumbCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(sourceCanvas, 0, 0, thumbW, thumbH);
        thumbCanvas.toBlob(
          (b) => resolve(b || new Blob()),
          'image/jpeg',
          0.85
        );
      } else {
        resolve(new Blob());
      }
    });
  };

  // Confirm and Send photograph
  const handleConfirmAndSend = async () => {
    if (!capturedBlob || !canvasRef.current) return;
    setIsSending(true);

    try {
      const timestamp = Date.now();
      const photoFileName = `camera_photo_${timestamp}.jpg`;
      const thumbFileName = `camera_thumb_${timestamp}.jpg`;

      const originalFile = new File([capturedBlob], photoFileName, { type: 'image/jpeg' });
      const thumbBlob = await createThumbnailBlob(canvasRef.current);
      const thumbnailFile = new File([thumbBlob], thumbFileName, { type: 'image/jpeg' });

      await onConfirmPhoto(originalFile, thumbnailFile, photoDimensions, caption.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Failed to send photograph.';
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Missing or insufficient permissions')) {
        msg = 'Storage Ledger permission warning. Please ensure Firestore rules are updated in Firebase Console, or reconnect your session.';
      } else if (msg.includes('Central Google Drive') || msg.includes('Google Drive is not connected')) {
        msg = 'Google Drive is not connected yet. Please visit the 250 GB Storage Manager to connect your central Google account.';
      }
      setCameraError(msg);
      setIsSending(false);
    }
  };

  if (!isOpen || !mounted) return null;

  // Use React Portal to attach modal directly to document.body.
  // This guarantees it is never constrained by parent backdrop-filter, overflow-hidden, or transforms.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative w-full max-w-lg md:max-w-xl max-h-[92vh] bg-stone-950 rounded-3xl overflow-hidden border border-rose-500/30 shadow-2xl flex flex-col justify-between">
        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-all active:scale-95 shadow-md"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {isTorchSupported && !capturedPhotoUrl && (
              <button
                type="button"
                onClick={toggleTorch}
                className={cn(
                  'p-2.5 rounded-full backdrop-blur-md transition-all active:scale-95 shadow-md',
                  isTorchOn ? 'bg-amber-500 text-stone-950 shadow-lg' : 'bg-black/50 text-white hover:bg-black/80'
                )}
                title="Toggle Flash / Torch"
              >
                {isTorchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
              </button>
            )}

            {!capturedPhotoUrl && availableCamerasCount > 1 && (
              <button
                type="button"
                onClick={toggleFacingMode}
                className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-all active:scale-95 shadow-md"
                title="Switch Camera (Front / Rear)"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden aspect-[4/3] max-h-[60vh]">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-white">{cameraError}</p>
              <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                {cameraError.includes('Google Drive') || cameraError.includes('Storage Manager') ? (
                  <a
                    href="/dashboard/admin/storage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5"
                  >
                    Open Storage Manager
                  </a>
                ) : null}
                {capturedPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setCameraError(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all shadow-md"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    startCamera();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-md"
                >
                  {capturedPhotoUrl ? 'Retake Photo' : 'Try Again'}
                </button>
              </div>
            </div>
          ) : capturedPhotoUrl ? (
            /* Still Photo Review */
            <img
              src={capturedPhotoUrl}
              alt="Captured Photograph"
              className="w-full h-full object-contain max-h-[58vh]"
            />
          ) : (
            /* Live Camera Stream */
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'w-full h-full object-cover max-h-[60vh]',
                facingMode === 'user' && 'scale-x-[-1]'
              )}
            />
          )}
        </div>

        {/* Bottom Controls Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-3 z-20 shrink-0">
          {capturedPhotoUrl ? (
            /* Post-Capture Review Actions */
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a loving caption... (optional)"
                className="w-full rounded-2xl bg-white/10 text-white placeholder:text-stone-400 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/60 backdrop-blur-md"
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={retakePhoto}
                  disabled={isSending}
                  className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 backdrop-blur-md transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retake</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndSend}
                  disabled={isSending}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:brightness-105 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSending ? 'Sending...' : 'Send Photograph'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Shutter Capture Button */
            <div className="flex flex-col items-center justify-center py-2 gap-1.5">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={Boolean(cameraError)}
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-rose-500 p-1 flex items-center justify-center hover:scale-105 active:scale-90 transition-all shadow-xl shadow-rose-500/30 group"
                title="Capture Photograph"
              >
                <div className="w-full h-full rounded-full bg-white hover:bg-rose-50 transition-colors shadow-xl flex items-center justify-center">
                  <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-rose-600" />
                </div>
              </button>
              <span className="text-[11px] font-semibold text-rose-200/80">Tap to Capture</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
