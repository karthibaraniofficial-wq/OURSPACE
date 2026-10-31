'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Search, Sparkles } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';

interface GiphyPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CURATED_GIFS = [
  {
    id: 'gif-1',
    title: 'Love Hug',
    url: 'https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif',
    category: 'Love',
  },
  {
    id: 'gif-2',
    title: 'Warm Hug',
    url: 'https://media.giphy.com/media/3o7TKoWXm3okO1kgHC/giphy.gif',
    category: 'Hug',
  },
  {
    id: 'gif-3',
    title: 'Sweet Kiss',
    url: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
    category: 'Kiss',
  },
  {
    id: 'gif-4',
    title: 'Heart Eyes',
    url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
    category: 'Love',
  },
  {
    id: 'gif-5',
    title: 'I Miss You',
    url: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif',
    category: 'Miss You',
  },
  {
    id: 'gif-6',
    title: 'Happy Dance',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    category: 'Cute',
  },
];

const CATEGORIES = ['All', 'Love', 'Kiss', 'Hug', 'Miss You', 'Cute'];

export function GiphyPickerModal({ isOpen, onClose }: GiphyPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { user, space } = useAuthStore();
  const { sendMessage } = useChatStore();

  const handleSelectGif = (gifUrl: string) => {
    if (!space || !user) return;
    sendMessage({
      spaceId: space.id,
      senderId: user.id,
      content: null,
      type: 'gif',
      attachment: {
        file_name: 'animated.gif',
        file_path: gifUrl,
        signed_url: gifUrl,
        file_size: 1048576,
        file_type: 'image/gif',
        media_category: 'image',
      },
    });
    onClose();
  };

  const filteredGifs = CURATED_GIFS.filter((gif) => {
    const matchesCategory =
      selectedCategory === 'All' || gif.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchTerm || gif.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Search GIFs"
      description="Powered by GIPHY — Express your love with motion"
    >
      <div className="flex flex-col gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search all the GIFs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-input rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white'
                  : 'bg-rose-50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 hover:bg-rose-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* GIF Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
          {filteredGifs.map((gif) => (
            <div
              key={gif.id}
              onClick={() => handleSelectGif(gif.url)}
              className="relative group rounded-2xl overflow-hidden aspect-video bg-stone-100 dark:bg-zinc-800 cursor-pointer hover:ring-2 hover:ring-rose-400 transition-all"
            >
              <img
                src={gif.url}
                alt={gif.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-xs">
                {gif.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
