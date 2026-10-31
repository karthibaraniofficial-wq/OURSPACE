import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export interface PendingItem {
  id: string;
  type: 'message' | 'reaction' | 'reminder';
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface NetworkState {
  isOnline: boolean;
  connectionStatus: ConnectionStatus;
  effectiveType: string | null; // e.g. '4g', '3g', 'wifi'
  pendingQueue: PendingItem[];
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;

  // Actions
  initializeNetworkListeners: () => () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  enqueuePendingItem: (item: Omit<PendingItem, 'timestamp' | 'retryCount'>) => void;
  removePendingItem: (id: string) => void;
  clearPendingQueue: () => void;
  flushPendingQueue: (senderFn: (item: PendingItem) => Promise<boolean>) => Promise<void>;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  connectionStatus: 'connected',
  effectiveType: null,
  pendingQueue: [],
  lastOnlineAt: Date.now(),
  lastOfflineAt: null,

  initializeNetworkListeners: () => {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = () => {
      console.log('[NETWORK] Network connection restored.');
      set({
        isOnline: true,
        connectionStatus: 'reconnecting',
        lastOnlineAt: Date.now(),
      });

      // Brief transition to verify backend heartbeat then mark connected
      setTimeout(() => {
        if (navigator.onLine) {
          set({ connectionStatus: 'connected' });
        }
      }, 1200);
    };

    const handleOffline = () => {
      console.warn('[NETWORK] Device is offline. Queuing local actions.');
      set({
        isOnline: false,
        connectionStatus: 'offline',
        lastOfflineAt: Date.now(),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API (detect Wi-Fi to 4G/5G handovers)
    const navConn = (navigator as unknown as { connection?: { effectiveType?: string; addEventListener?: (ev: string, cb: () => void) => void } }).connection;
    const handleConnChange = () => {
      if (navConn?.effectiveType) {
        console.log(`[NETWORK] Connection handover detected: ${navConn.effectiveType}`);
        set({ effectiveType: navConn.effectiveType });
      }
    };

    if (navConn && navConn.addEventListener) {
      navConn.addEventListener('change', handleConnChange);
      handleConnChange();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  enqueuePendingItem: (item) => {
    const fullItem: PendingItem = {
      ...item,
      timestamp: Date.now(),
      retryCount: 0,
    };
    set((state) => ({
      pendingQueue: [...state.pendingQueue, fullItem],
    }));
  },

  removePendingItem: (id) => {
    set((state) => ({
      pendingQueue: state.pendingQueue.filter((i) => i.id !== id),
    }));
  },

  clearPendingQueue: () => set({ pendingQueue: [] }),

  flushPendingQueue: async (senderFn) => {
    const queue = get().pendingQueue;
    if (queue.length === 0) return;

    console.log(`[NETWORK] Flushing ${queue.length} pending offline actions.`);
    const remaining: PendingItem[] = [];

    for (const item of queue) {
      try {
        const success = await senderFn(item);
        if (!success) {
          remaining.push({ ...item, retryCount: item.retryCount + 1 });
        }
      } catch (err) {
        console.warn(`[NETWORK] Failed to sync item ${item.id}:`, err);
        remaining.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }

    set({ pendingQueue: remaining });
  },
}));
