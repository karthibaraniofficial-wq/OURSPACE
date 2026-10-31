import { create } from 'zustand';
import type { Album, AlbumItem, AlbumCategory, AlbumVisibility, UUID } from '@ourspace/types';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

interface AlbumState {
  albums: Album[];
  currentAlbum: Album | null;
  currentAlbumItems: AlbumItem[];
  selectedCategory: string;
  selectedYear: string;
  searchQuery: string;
  isLoading: boolean;
  activeSlideshowIndex: number | null;
  isSlideshowPlaying: boolean;

  // Actions
  fetchAlbums: (spaceId: UUID, userId: UUID) => () => void;
  fetchAlbumItems: (spaceId: UUID, albumId: UUID) => () => void;
  setCurrentAlbum: (album: Album | null) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedYear: (year: string) => void;
  setSearchQuery: (query: string) => void;
  createAlbum: (payload: {
    spaceId: UUID;
    userId: UUID;
    title: string;
    description?: string;
    category: AlbumCategory | string;
    albumDate?: string;
    visibility: AlbumVisibility;
    coverUrl?: string;
  }) => Promise<string>;
  updateAlbum: (spaceId: UUID, albumId: UUID, updates: Partial<Album>) => Promise<void>;
  deleteAlbum: (spaceId: UUID, albumId: UUID) => Promise<void>;
  toggleAlbumFavourite: (spaceId: UUID, albumId: UUID) => Promise<void>;
  addItemToAlbum: (payload: {
    spaceId: UUID;
    albumId: UUID;
    userId: UUID;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    originalDate?: string;
  }) => Promise<void>;
  deleteAlbumItem: (spaceId: UUID, albumId: UUID, itemId: UUID) => Promise<void>;
  startSlideshow: (startIndex?: number) => void;
  stopSlideshow: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  toggleSlideshowPlay: () => void;
}

export const useAlbumStore = create<AlbumState>((set, get) => ({
  albums: [],
  currentAlbum: null,
  currentAlbumItems: [],
  selectedCategory: 'all',
  selectedYear: 'all',
  searchQuery: '',
  isLoading: false,
  activeSlideshowIndex: null,
  isSlideshowPlaying: false,

  setCurrentAlbum: (album) => set({ currentAlbum: album }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSelectedYear: (year) => set({ selectedYear: year }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  fetchAlbums: (spaceId, userId) => {
    if (!isFirebaseConfigured()) {
      // Local demo mode
      const raw = localStorage.getItem(`ourspace_albums_${spaceId}`);
      if (raw) {
        try {
          const list = JSON.parse(raw) as Album[];
          set({ albums: list.filter((a) => a.visibility === 'shared' || a.created_by === userId) });
        } catch {}
      }
      return () => {};
    }

    const db = getFirebaseFirestore();
    const albumsColl = collection(db, 'privateSpaces', spaceId, 'albums');
    const q = query(albumsColl, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Album[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            space_id: spaceId,
            created_by: data.createdBy,
            title: data.title,
            description: data.description || null,
            cover_file_path: data.coverFilePath || null,
            cover_url: data.coverUrl || null,
            category: data.category || 'Everyday Moments',
            album_date: data.albumDate || null,
            visibility: data.visibility || 'shared',
            is_favourite: data.isFavourite || false,
            is_archived: data.isArchived || false,
            sort_order: data.sortOrder || 0,
            memory_count: data.memoryCount || 0,
            created_at: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updated_at: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          };
        })
        .filter((a) => a.visibility === 'shared' || a.created_by === userId);

      set({ albums: list });
    });

    return unsub;
  },

  fetchAlbumItems: (spaceId, albumId) => {
    if (!isFirebaseConfigured()) {
      const raw = localStorage.getItem(`ourspace_album_items_${albumId}`);
      if (raw) {
        try {
          set({ currentAlbumItems: JSON.parse(raw) });
        } catch {}
      }
      return () => {};
    }

    const db = getFirebaseFirestore();
    const itemsColl = collection(db, 'privateSpaces', spaceId, 'albums', albumId, 'items');
    const q = query(itemsColl, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const items: AlbumItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          album_id: albumId,
          space_id: spaceId,
          storage_path: data.storagePath || '',
          media_url: data.mediaUrl,
          media_type: data.mediaType || 'image',
          caption: data.caption || null,
          description: data.description || null,
          uploaded_by: data.uploadedBy,
          original_date: data.originalDate || null,
          sort_order: data.sortOrder || 0,
          is_favourite: data.isFavourite || false,
          created_at: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        };
      });

      set({ currentAlbumItems: items });
    });

    return unsub;
  },

  createAlbum: async (payload) => {
    const albumId = 'alb_' + Date.now();
    const now = new Date().toISOString();

    const newAlbum: Album = {
      id: albumId,
      space_id: payload.spaceId,
      created_by: payload.userId,
      title: payload.title,
      description: payload.description || null,
      cover_file_path: null,
      cover_url: payload.coverUrl || null,
      category: payload.category,
      album_date: payload.albumDate || null,
      visibility: payload.visibility,
      is_favourite: false,
      is_archived: false,
      sort_order: 0,
      memory_count: 0,
      created_at: now,
      updated_at: now,
    };

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await setDoc(doc(db, 'privateSpaces', payload.spaceId, 'albums', albumId), {
        title: payload.title,
        description: payload.description || null,
        createdBy: payload.userId,
        category: payload.category,
        albumDate: payload.albumDate || null,
        visibility: payload.visibility,
        coverUrl: payload.coverUrl || null,
        isFavourite: false,
        isArchived: false,
        sortOrder: 0,
        memoryCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const raw = localStorage.getItem(`ourspace_albums_${payload.spaceId}`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(newAlbum);
      localStorage.setItem(`ourspace_albums_${payload.spaceId}`, JSON.stringify(list));
      set((state) => ({ albums: [newAlbum, ...state.albums] }));
    }

    return albumId;
  },

  updateAlbum: async (spaceId, albumId, updates) => {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      const ref = doc(db, 'privateSpaces', spaceId, 'albums', albumId);
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.title !== undefined) data.title = updates.title;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.category !== undefined) data.category = updates.category;
      if (updates.album_date !== undefined) data.albumDate = updates.album_date;
      if (updates.visibility !== undefined) data.visibility = updates.visibility;
      if (updates.cover_url !== undefined) data.coverUrl = updates.cover_url;
      await updateDoc(ref, data);
    }
    set((state) => ({
      albums: state.albums.map((a) => (a.id === albumId ? { ...a, ...updates } : a)),
      currentAlbum: state.currentAlbum?.id === albumId ? { ...state.currentAlbum, ...updates } : state.currentAlbum,
    }));
  },

  deleteAlbum: async (spaceId, albumId) => {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await deleteDoc(doc(db, 'privateSpaces', spaceId, 'albums', albumId));
    }
    set((state) => ({
      albums: state.albums.filter((a) => a.id !== albumId),
      currentAlbum: state.currentAlbum?.id === albumId ? null : state.currentAlbum,
    }));
  },

  toggleAlbumFavourite: async (spaceId, albumId) => {
    const album = get().albums.find((a) => a.id === albumId);
    if (!album) return;
    const newFav = !album.is_favourite;

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'privateSpaces', spaceId, 'albums', albumId), {
        isFavourite: newFav,
        updatedAt: serverTimestamp(),
      });
    }
    set((state) => ({
      albums: state.albums.map((a) => (a.id === albumId ? { ...a, is_favourite: newFav } : a)),
      currentAlbum: state.currentAlbum?.id === albumId ? { ...state.currentAlbum, is_favourite: newFav } : state.currentAlbum,
    }));
  },

  addItemToAlbum: async (payload) => {
    const itemId = 'item_' + Date.now();
    const now = new Date().toISOString();

    const newItem: AlbumItem = {
      id: itemId,
      album_id: payload.albumId,
      space_id: payload.spaceId,
      storage_path: '',
      media_url: payload.mediaUrl,
      media_type: payload.mediaType,
      caption: payload.caption || null,
      uploaded_by: payload.userId,
      original_date: payload.originalDate || null,
      sort_order: 0,
      is_favourite: false,
      created_at: now,
    };

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await setDoc(doc(db, 'privateSpaces', payload.spaceId, 'albums', payload.albumId, 'items', itemId), {
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        caption: payload.caption || null,
        uploadedBy: payload.userId,
        originalDate: payload.originalDate || null,
        isFavourite: false,
        sortOrder: 0,
        createdAt: serverTimestamp(),
      });

      // Update album cover if not set and increment memoryCount
      const albumRef = doc(db, 'privateSpaces', payload.spaceId, 'albums', payload.albumId);
      const album = get().albums.find((a) => a.id === payload.albumId);
      const updates: Record<string, unknown> = {
        memoryCount: (album?.memory_count || 0) + 1,
        updatedAt: serverTimestamp(),
      };
      if (!album?.cover_url) {
        updates.coverUrl = payload.mediaUrl;
      }
      await updateDoc(albumRef, updates);
    } else {
      const raw = localStorage.getItem(`ourspace_album_items_${payload.albumId}`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(newItem);
      localStorage.setItem(`ourspace_album_items_${payload.albumId}`, JSON.stringify(list));
      set((state) => ({
        currentAlbumItems: [newItem, ...state.currentAlbumItems],
        albums: state.albums.map((a) =>
          a.id === payload.albumId
            ? { ...a, memory_count: a.memory_count + 1, cover_url: a.cover_url || payload.mediaUrl }
            : a
        ),
      }));
    }
  },

  deleteAlbumItem: async (spaceId, albumId, itemId) => {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      await deleteDoc(doc(db, 'privateSpaces', spaceId, 'albums', albumId, 'items', itemId));
      const albumRef = doc(db, 'privateSpaces', spaceId, 'albums', albumId);
      const album = get().albums.find((a) => a.id === albumId);
      await updateDoc(albumRef, {
        memoryCount: Math.max(0, (album?.memory_count || 1) - 1),
        updatedAt: serverTimestamp(),
      });
    }
    set((state) => ({
      currentAlbumItems: state.currentAlbumItems.filter((i) => i.id !== itemId),
      albums: state.albums.map((a) =>
        a.id === albumId ? { ...a, memory_count: Math.max(0, a.memory_count - 1) } : a
      ),
    }));
  },

  startSlideshow: (startIndex = 0) => {
    set({ activeSlideshowIndex: startIndex, isSlideshowPlaying: true });
  },

  stopSlideshow: () => {
    set({ activeSlideshowIndex: null, isSlideshowPlaying: false });
  },

  nextSlide: () => {
    const { activeSlideshowIndex, currentAlbumItems } = get();
    if (activeSlideshowIndex === null || currentAlbumItems.length === 0) return;
    const nextIdx = (activeSlideshowIndex + 1) % currentAlbumItems.length;
    set({ activeSlideshowIndex: nextIdx });
  },

  prevSlide: () => {
    const { activeSlideshowIndex, currentAlbumItems } = get();
    if (activeSlideshowIndex === null || currentAlbumItems.length === 0) return;
    const prevIdx = (activeSlideshowIndex - 1 + currentAlbumItems.length) % currentAlbumItems.length;
    set({ activeSlideshowIndex: prevIdx });
  },

  toggleSlideshowPlay: () => {
    set((state) => ({ isSlideshowPlaying: !state.isSlideshowPlaying }));
  },
}));
