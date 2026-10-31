'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Image as ImageIcon,
  Film,
  FileText,
  Heart,
  Upload,
  Download,
  Sparkles,
  BookOpen,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useAlbumStore } from '@/store/useAlbumStore';
import { Button } from '@/components/ui/Button';
import { MediaViewerModal } from '@/components/gallery/MediaViewerModal';
import { formatBytes } from '@ourspace/shared';

interface GalleryItem {
  id: string;
  title: string;
  category: 'image' | 'video' | 'document';
  url: string;
  date: string;
  size?: number;
  isFavourite?: boolean;
}

type CategoryFilter = 'all' | 'image' | 'video' | 'document' | 'favourites';

export default function GalleryPage() {
  const { user, space } = useAuthStore();
  const { messages } = useChatStore();
  const { albums, fetchAlbums } = useAlbumStore();

  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string; title: string } | null>(null);
  const [customMedia, setCustomMedia] = useState<GalleryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (space?.id && user?.id) {
      const unsub = fetchAlbums(space.id, user.id);
      return () => unsub();
    }
  }, [space?.id, user?.id, fetchAlbums]);

  // Extract all media from chat attachments
  const chatMedia: GalleryItem[] = messages
    .flatMap((m) =>
      (m.attachments || []).map((att) => ({
        id: att.id || 'att-' + Math.random(),
        title: att.file_name,
        category: (att.media_category === 'audio' ? 'document' : att.media_category) as 'image' | 'video' | 'document',
        url: att.signed_url || att.file_path,
        date: new Date(m.created_at).toLocaleDateString(),
        size: att.file_size,
        isFavourite: false,
      }))
    )
    .filter((item) => item.url && !item.url.startsWith('inline/'));

  // Combine custom uploaded media + chat media
  const allMediaItems = [...customMedia, ...chatMedia];

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let category: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) category = 'image';
    else if (file.type.startsWith('video/')) category = 'video';

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newObj: GalleryItem = {
        id: 'med-' + Date.now(),
        title: file.name,
        category,
        url: dataUrl,
        date: 'Just now',
        size: file.size,
        isFavourite: false,
      };
      setCustomMedia((prev) => [newObj, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  const filteredItems = allMediaItems.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'favourites') return item.isFavourite;
    return item.category === activeTab;
  });

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Top Header & Albums Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Shared Gallery</span>
            <Sparkles className="w-5 h-5 text-rose-500" />
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            Real uploaded photographs, videos, and shared memories from your sanctuary.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/albums"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-card border border-rose-300 text-rose-600 hover:text-rose-700 font-bold text-xs shadow-sm hover:scale-105 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Memory Albums ({albums.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:brightness-105 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all">
              <Upload className="w-4 h-4" />
              <span>Upload Memory</span>
            </div>
          </label>
        </div>
      </div>

      {/* Album Navigation Banner */}
      <div className="p-5 rounded-3xl glass-card border border-rose-200/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-rose-50/60 via-pink-50/40 to-purple-50/40 dark:from-rose-950/20 dark:to-purple-950/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
              Curate Your Journey in Memory Albums
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Create themed collections like First Date, Anniversaries, and Trips with slideshow playback.
            </p>
          </div>
        </div>

        <Link href="/dashboard/albums">
          <Button variant="primary" size="sm">
            Open Memory Albums <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: `All Items (${allMediaItems.length})` },
          { id: 'image', label: 'Photos', icon: ImageIcon },
          { id: 'video', label: 'Videos', icon: Film },
          { id: 'document', label: 'Documents', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CategoryFilter)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all',
                isActive
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'glass-card hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Media Grid or Clean Empty State */}
      {filteredItems.length === 0 ? (
        <div className="p-16 text-center rounded-3xl glass-card border border-rose-200/50 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
            <ImageIcon className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-200">
            No media shared yet
          </h3>
          <p className="text-xs text-stone-400 max-w-xs mt-1">
            Send photos and videos in chat or upload them directly to your shared vault.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5 mr-1" /> Upload Your First Photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedMedia({ url: item.url, type: item.category, title: item.title })}
              className="group relative rounded-3xl overflow-hidden glass-panel border border-rose-200/50 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="relative aspect-square w-full bg-stone-100 dark:bg-zinc-800 overflow-hidden">
                {item.category === 'image' && (
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}

                {item.category === 'video' && (
                  <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                    <Film className="w-12 h-12 text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md">
                      Video
                    </span>
                  </div>
                )}

                {item.category === 'document' && (
                  <div className="w-full h-full bg-rose-50/60 dark:bg-zinc-800 flex flex-col items-center justify-center p-4 text-center">
                    <FileText className="w-12 h-12 text-rose-500 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 line-clamp-2">
                      {item.title}
                    </p>
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="p-4 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <h4 className="font-bold text-stone-800 dark:text-zinc-100 truncate">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {item.date} {item.size ? `• ${formatBytes(item.size)}` : ''}
                  </p>
                </div>

                <a
                  href={item.url}
                  download={item.title}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Viewer */}
      <MediaViewerModal
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        mediaUrl={selectedMedia?.url || null}
        mediaType={selectedMedia?.type || 'image'}
        title={selectedMedia?.title}
      />
    </div>
  );
}
