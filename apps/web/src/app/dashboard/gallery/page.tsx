'use client';

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Film,
  FileText,
  Heart,
  Upload,
  Download,
  Plus,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { Button } from '@/components/ui/Button';
import { MediaViewerModal } from '@/components/gallery/MediaViewerModal';
import { formatBytes } from '@ourspace/shared';

const MOCK_MEDIA_ITEMS = [
  {
    id: 'med-1',
    title: 'Sunrise from Balcony',
    category: 'image',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
    date: 'Oct 24, 2026',
    size: 2450000,
    isFavourite: true,
  },
  {
    id: 'med-2',
    title: 'Sunset Beach Walk',
    category: 'image',
    url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1200&auto=format&fit=crop&q=80',
    date: 'Oct 21, 2026',
    size: 3120000,
    isFavourite: true,
  },
  {
    id: 'med-3',
    title: 'Weekend Coffee Roast',
    category: 'image',
    url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=1200&auto=format&fit=crop&q=80',
    date: 'Oct 18, 2026',
    size: 1980000,
    isFavourite: false,
  },
  {
    id: 'med-4',
    title: 'Romantic Stargazing Memories',
    category: 'image',
    url: 'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=1200&auto=format&fit=crop&q=80',
    date: 'Oct 14, 2026',
    size: 2750000,
    isFavourite: true,
  },
  {
    id: 'med-5',
    title: 'Paris Holiday Travel Itinerary.pdf',
    category: 'document',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    date: 'Oct 10, 2026',
    size: 420000,
    isFavourite: false,
  },
  {
    id: 'med-6',
    title: 'Beach Waves Memories.mp4',
    category: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    date: 'Oct 05, 2026',
    size: 14500000,
    isFavourite: true,
  },
];

type CategoryFilter = 'all' | 'image' | 'video' | 'document' | 'favourites';

export default function GalleryPage() {
  const { user, space, partner } = useAuthStore();
  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [mediaItems, setMediaItems] = useState(MOCK_MEDIA_ITEMS);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string; title: string } | null>(null);

  const toggleFavourite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isFavourite: !item.isFavourite } : item))
    );
  };

  const filteredItems = mediaItems.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'favourites') return item.isFavourite;
    return item.category === activeTab;
  });

  const handleUploadDemo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let category = 'document';
    if (file.type.startsWith('image/')) category = 'image';
    else if (file.type.startsWith('video/')) category = 'video';

    const newObj = {
      id: 'med-' + Date.now(),
      title: file.name,
      category,
      url: URL.createObjectURL(file),
      date: 'Just now',
      size: file.size,
      isFavourite: false,
    };

    setMediaItems([newObj, ...mediaItems]);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Shared Vault & Memories</span>
            <Sparkles className="w-5 h-5 text-rose-500" />
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            Photographs, videos, and travel documents preserved privately for both of you.
          </p>
        </div>

        {/* Upload Button */}
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={handleUploadDemo} />
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:brightness-105 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all">
            <Upload className="w-4 h-4" />
            <span>Upload New Memory</span>
          </div>
        </label>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Items' },
          { id: 'image', label: 'Photos', icon: ImageIcon },
          { id: 'video', label: 'Videos', icon: Film },
          { id: 'document', label: 'Documents', icon: FileText },
          { id: 'favourites', label: 'Favourites', icon: Heart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CategoryFilter)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'glass-card hover:bg-rose-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive && tab.id === 'favourites' ? 'fill-white' : ''}`} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedMedia({ url: item.url, type: item.category, title: item.title })}
            className="group relative rounded-3xl overflow-hidden glass-panel border border-rose-200/50 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
          >
            {/* Visual Thumbnail */}
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

              {/* Favourite Heart Badge */}
              <button
                onClick={(e) => toggleFavourite(item.id, e)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-md text-white transition-all hover:scale-110"
              >
                <Heart
                  className={`w-4 h-4 ${item.isFavourite ? 'fill-rose-500 text-rose-500' : 'text-white'}`}
                />
              </button>
            </div>

            {/* Meta Info */}
            <div className="p-4 flex items-center justify-between text-xs">
              <div className="min-w-0 pr-2">
                <h4 className="font-bold text-stone-800 dark:text-zinc-100 truncate">
                  {item.title}
                </h4>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {item.date} • {formatBytes(item.size)}
                </p>
              </div>

              <a
                href={item.url}
                download
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
