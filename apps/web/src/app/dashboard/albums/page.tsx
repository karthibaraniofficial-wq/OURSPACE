'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Film,
  Plus,
  Heart,
  Star,
  Calendar,
  Lock,
  Users,
  Search,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Edit2,
  Upload,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAlbumStore } from '@/store/useAlbumStore';
import type { Album, AlbumCategory, AlbumVisibility } from '@ourspace/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const CATEGORIES: AlbumCategory[] = [
  'Our Beginning',
  'First Meeting',
  'First Date',
  'Special Days',
  'Birthdays',
  'Anniversaries',
  'Trips',
  'Festivals',
  'Celebrations',
  'Everyday Moments',
  'Future Memories',
  'Custom',
];

export default function AlbumsPage() {
  const { user, space } = useAuthStore();
  const {
    albums,
    currentAlbum,
    currentAlbumItems,
    selectedCategory,
    searchQuery,
    activeSlideshowIndex,
    isSlideshowPlaying,
    fetchAlbums,
    fetchAlbumItems,
    setCurrentAlbum,
    setSelectedCategory,
    setSearchQuery,
    createAlbum,
    deleteAlbum,
    toggleAlbumFavourite,
    addItemToAlbum,
    deleteAlbumItem,
    startSlideshow,
    stopSlideshow,
    nextSlide,
    prevSlide,
    toggleSlideshowPlay,
  } = useAlbumStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<AlbumCategory>('Everyday Moments');
  const [newDate, setNewDate] = useState(new Date().toISOString().substring(0, 10));
  const [newVisibility, setNewVisibility] = useState<AlbumVisibility>('shared');
  const [newCoverUrl, setNewCoverUrl] = useState('');

  // Item uploader state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCaption, setUploadCaption] = useState('');

  // Fetch albums on mount
  useEffect(() => {
    if (!space?.id || !user?.id) return;
    const unsub = fetchAlbums(space.id, user.id);
    return () => unsub();
  }, [space?.id, user?.id, fetchAlbums]);

  // Fetch items when currentAlbum selected
  useEffect(() => {
    if (!space?.id || !currentAlbum?.id) return;
    const unsub = fetchAlbumItems(space.id, currentAlbum.id);
    return () => unsub();
  }, [space?.id, currentAlbum?.id, fetchAlbumItems]);

  // Slideshow auto-advance timer
  useEffect(() => {
    if (!isSlideshowPlaying || activeSlideshowIndex === null) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 4000);
    return () => clearInterval(timer);
  }, [isSlideshowPlaying, activeSlideshowIndex, nextSlide]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space?.id || !user?.id || !newTitle.trim()) return;

    await createAlbum({
      spaceId: space.id,
      userId: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      category: newCategory,
      albumDate: newDate,
      visibility: newVisibility,
      coverUrl: newCoverUrl.trim() || undefined,
    });

    setNewTitle('');
    setNewDescription('');
    setNewCoverUrl('');
    setIsCreateModalOpen(false);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !space?.id || !currentAlbum?.id || !user?.id) return;

    const mediaType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await addItemToAlbum({
        spaceId: space.id,
        albumId: currentAlbum.id,
        userId: user.id,
        mediaUrl: dataUrl,
        mediaType,
        caption: uploadCaption.trim() || file.name,
        originalDate: new Date().toISOString(),
      });
      setUploadCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const filteredAlbums = albums.filter((alb) => {
    if (selectedCategory !== 'all' && alb.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return alb.title.toLowerCase().includes(q) || alb.description?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Detail Album Header or Main Header */}
      {currentAlbum ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentAlbum(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Albums</span>
            </button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => startSlideshow(0)}
                disabled={currentAlbumItems.length === 0}
              >
                <Play className="w-3.5 h-3.5 mr-1 text-rose-500 fill-rose-500" />
                Slideshow
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                Add Memories
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaUpload}
              />
            </div>
          </div>

          {/* Album Hero Cover Banner */}
          <div className="relative rounded-3xl overflow-hidden glass-card p-6 sm:p-8 border border-rose-200/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-rose-100 flex items-center justify-center shrink-0 border border-rose-300 shadow-md">
                {currentAlbum.cover_url ? (
                  <img
                    src={currentAlbum.cover_url}
                    alt={currentAlbum.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                    {currentAlbum.category}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-stone-500">
                    {currentAlbum.visibility === 'personal' ? (
                      <>
                        <Lock className="w-3 h-3 text-amber-500" /> Personal
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3 text-rose-500" /> Shared with Partner
                      </>
                    )}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
                  {currentAlbum.title}
                </h2>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  {currentAlbum.description || 'A timeless collection of romantic memories.'}
                </p>
                <p className="text-[11px] text-rose-500 font-semibold mt-1">
                  {currentAlbumItems.length} {currentAlbumItems.length === 1 ? 'memory' : 'memories'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => space?.id && toggleAlbumFavourite(space.id, currentAlbum.id)}
                className="p-2.5 rounded-2xl glass-card border border-rose-200 hover:scale-105 transition-all text-amber-500"
                title="Favourite Album"
              >
                <Star
                  className={cn(
                    'w-5 h-5',
                    currentAlbum.is_favourite && 'fill-amber-400 text-amber-500'
                  )}
                />
              </button>
              <button
                onClick={() => space?.id && deleteAlbum(space.id, currentAlbum.id)}
                className="p-2.5 rounded-2xl glass-card border border-rose-200 hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                title="Delete Album"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Items Grid */}
          {currentAlbumItems.length === 0 ? (
            <div className="p-16 text-center rounded-3xl glass-card border border-rose-200/50 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                No memories in this album yet
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Upload your special photographs and videos from this occasion.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1" /> Upload First Memory
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {currentAlbumItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="group relative rounded-2xl overflow-hidden glass-card border border-rose-200/60 aspect-square shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => startSlideshow(idx)}
                >
                  {item.media_type === 'video' ? (
                    <video
                      src={item.media_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.media_url}
                      alt={item.caption || 'Memory'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between text-white text-xs">
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (space?.id) deleteAlbumItem(space.id, currentAlbum.id, item.id);
                        }}
                        className="p-1 rounded-full bg-black/40 text-white/80 hover:text-red-400"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <p className="font-semibold truncate">{item.caption || 'Memory'}</p>
                      <p className="text-[10px] text-white/70">
                        {item.original_date ? new Date(item.original_date).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Albums Gallery Overview */
        <>
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-rose-200/60 shadow-lg">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Memory Collections</span>
              </span>
              <h2 className="text-2xl font-extrabold text-stone-900 dark:text-zinc-100 mt-1">
                MEMORY ALBUMS
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Organize your shared moments, dates, travels, and milestones into beautiful albums.
              </p>
            </div>

            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Album
            </Button>
          </div>

          {/* Filters & Category Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search albums by title or memory..."
                  className="w-full rounded-2xl glass-input pl-10 pr-4 py-2.5 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0',
                  selectedCategory === 'all'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'glass-card text-stone-600 hover:text-rose-600'
                )}
              >
                All Albums ({albums.length})
              </button>
              {CATEGORIES.map((cat) => {
                const count = albums.filter((a) => a.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5',
                      selectedCategory === cat
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'glass-card text-stone-600 hover:text-rose-600'
                    )}
                  >
                    <span>{cat}</span>
                    {count > 0 && <span className="text-[10px] opacity-75 font-bold">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Albums Grid */}
          {filteredAlbums.length === 0 ? (
            <div className="p-16 text-center rounded-3xl glass-card border border-rose-200/50 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-stone-800 dark:text-zinc-200">No albums created yet</h3>
              <p className="text-xs text-stone-400 max-w-xs mt-1">
                Start capturing your love story with dedicated memory albums like First Date or Trips.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Your First Album
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filteredAlbums.map((alb) => (
                <div
                  key={alb.id}
                  onClick={() => setCurrentAlbum(alb)}
                  className="group rounded-3xl overflow-hidden glass-card border border-rose-200/60 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  {/* Cover */}
                  <div className="relative aspect-[4/3] bg-gradient-to-tr from-rose-100 to-pink-50 overflow-hidden">
                    {alb.cover_url ? (
                      <img
                        src={alb.cover_url}
                        alt={alb.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-rose-300">
                        <ImageIcon className="w-12 h-12 mb-1" />
                        <span className="text-[10px] font-semibold">No cover photo</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md text-stone-800 dark:text-zinc-100 shadow-sm">
                      {alb.category}
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      {alb.visibility === 'personal' && (
                        <div
                          className="p-1.5 rounded-full bg-black/40 text-amber-300 backdrop-blur-md"
                          title="Personal Album"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (space?.id) toggleAlbumFavourite(space.id, alb.id);
                        }}
                        className="p-1.5 rounded-full bg-black/40 text-white hover:text-amber-400 backdrop-blur-md transition-colors"
                      >
                        <Star
                          className={cn('w-3.5 h-3.5', alb.is_favourite && 'fill-amber-400 text-amber-400')}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col gap-1.5">
                    <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 group-hover:text-rose-600 transition-colors truncate">
                      {alb.title}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {alb.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-stone-400 pt-3 mt-2 border-t border-rose-100/60 dark:border-zinc-800">
                      <span>{alb.album_date ? new Date(alb.album_date).toLocaleDateString() : 'Date unset'}</span>
                      <span className="font-semibold text-rose-500">
                        {alb.memory_count} {alb.memory_count === 1 ? 'memory' : 'memories'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Album Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Memory Album"
      >
        <form onSubmit={handleCreateAlbum} className="flex flex-col gap-4 text-xs">
          <Input
            label="Album Title"
            placeholder="e.g. Paris Summer Getaway, Our First Date"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label className="block font-semibold mb-1 text-stone-700 dark:text-zinc-200">
              Description / Love Story
            </label>
            <textarea
              rows={3}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What makes this collection unforgettable?..."
              className="w-full rounded-2xl glass-input p-3 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-stone-700 dark:text-zinc-200">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as AlbumCategory)}
                className="w-full rounded-2xl glass-input p-2.5 text-xs text-stone-800 dark:text-zinc-100 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Album Date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-stone-700 dark:text-zinc-200">
              Privacy Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewVisibility('shared')}
                className={cn(
                  'p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all',
                  newVisibility === 'shared'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700'
                    : 'border-stone-200 text-stone-600'
                )}
              >
                <Users className="w-4 h-4 text-rose-500 shrink-0" />
                <div>
                  <p className="font-bold">Shared Album</p>
                  <p className="text-[10px] text-stone-400">Both can view & add</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNewVisibility('personal')}
                className={cn(
                  'p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all',
                  newVisibility === 'personal'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700'
                    : 'border-stone-200 text-stone-600'
                )}
              >
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <p className="font-bold">Personal Vault</p>
                  <p className="text-[10px] text-stone-400">Only visible to you</p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Album
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fullscreen Slideshow Modal */}
      {activeSlideshowIndex !== null && currentAlbumItems[activeSlideshowIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in">
          {/* Top Bar */}
          <div className="flex items-center justify-between text-white/90">
            <div>
              <p className="font-bold text-sm">{currentAlbum?.title}</p>
              <p className="text-xs text-white/60">
                {activeSlideshowIndex + 1} of {currentAlbumItems.length}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleSlideshowPlay}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title={isSlideshowPlaying ? 'Pause Slideshow' : 'Play Slideshow'}
              >
                {isSlideshowPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
              </button>
              <button
                onClick={stopSlideshow}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Presentation Display */}
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            {currentAlbumItems[activeSlideshowIndex].media_type === 'video' ? (
              <video
                src={currentAlbumItems[activeSlideshowIndex].media_url}
                controls
                autoPlay
                className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl"
              />
            ) : (
              <img
                src={currentAlbumItems[activeSlideshowIndex].media_url}
                alt="Memory Slide"
                className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
              />
            )}

            {/* Left / Right Nav Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-2 sm:left-4 p-3 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 sm:right-4 p-3 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Caption Footer */}
          <div className="text-center text-white/90">
            <p className="text-sm font-medium">
              {currentAlbumItems[activeSlideshowIndex].caption || 'A timeless moment with you'}
            </p>
            {currentAlbumItems[activeSlideshowIndex].original_date && (
              <p className="text-[11px] text-white/50 mt-0.5">
                {new Date(currentAlbumItems[activeSlideshowIndex].original_date!).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
