import { create } from 'zustand';
import type { Message, MessageAttachment, MessageReaction, UUID } from '@ourspace/types';
import {
  subscribeToFirestoreMessages,
  sendMessageToFirestore,
  updateMessageInFirestore,
  addReactionToFirestore,
} from '@/lib/firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase/firebase';
import { playChime } from '@ourspace/shared';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isPartnerTyping: boolean;
  activeReply: Message | null;
  pinnedMessages: Message[];
  searchQuery: string;

  // Actions
  fetchMessages: (spaceId: UUID) => Promise<void>;
  sendMessage: (payload: {
    spaceId: UUID;
    senderId: UUID;
    content: string | null;
    type?: Message['type'];
    replyToId?: UUID | null;
    attachment?: Partial<MessageAttachment>;
    attachments?: Partial<MessageAttachment>[];
  }) => Promise<void>;
  editMessage: (messageId: UUID, newContent: string, spaceId?: UUID) => Promise<void>;
  deleteMessage: (messageId: UUID, forEveryone: boolean, userId: UUID, spaceId?: UUID) => Promise<void>;
  togglePinMessage: (messageId: UUID, spaceId?: UUID) => Promise<void>;
  addReaction: (messageId: UUID, spaceId: UUID, userId: UUID, emoji: string) => Promise<void>;
  setTyping: (spaceId: UUID, userId: UUID, isTyping: boolean) => void;
  setActiveReply: (message: Message | null) => void;
  setSearchQuery: (query: string) => void;
  markAsRead: (spaceId: UUID, userId: UUID) => Promise<void>;
  cleanupListeners: () => void;
}

let firestoreMessagesUnsubscribe: (() => void) | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isPartnerTyping: false,
  activeReply: null,
  pinnedMessages: [],
  searchQuery: '',

  fetchMessages: async (spaceId) => {
    set({ isLoading: true });
    try {
      if (isFirebaseConfigured()) {
        if (firestoreMessagesUnsubscribe) firestoreMessagesUnsubscribe();

        firestoreMessagesUnsubscribe = subscribeToFirestoreMessages(spaceId, (realtimeMsgs) => {
          set({
            messages: realtimeMsgs || [],
            pinnedMessages: (realtimeMsgs || []).filter((m) => m.pinned),
            isLoading: false,
          });
        });
      } else {
        const local = localStorage.getItem(`ourspace_messages_${spaceId}`);
        const parsed = local ? JSON.parse(local) : [];
        set({
          messages: parsed,
          pinnedMessages: parsed.filter((m: Message) => m.pinned),
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  sendMessage: async ({ spaceId, senderId, content, type = 'text', replyToId = null, attachment, attachments }) => {
    const newMessageId = 'msg-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    const createdAttachments: MessageAttachment[] = [];
    const sourceAttachments = attachments && attachments.length > 0 
      ? attachments 
      : (attachment ? [attachment] : []);

    sourceAttachments.forEach((att) => {
      if (att && (att.file_name || att.download_url || att.signed_url || att.file_path || att.storage_path)) {
        createdAttachments.push({
          id: att.id || 'att-' + Math.random().toString(36).substring(2, 9),
          message_id: newMessageId,
          space_id: spaceId,
          file_path: att.file_path || att.storage_path || 'local',
          storage_path: att.storage_path || att.file_path,
          file_name: att.file_name || 'attachment',
          file_size: att.file_size || 1024,
          file_type: att.file_type || 'application/octet-stream',
          media_category: att.media_category || 'image',
          thumbnail_path: att.thumbnail_path || null,
          thumbnail_url: att.thumbnail_url || null,
          duration_seconds: att.duration_seconds || null,
          width: att.width || null,
          height: att.height || null,
          created_at: att.created_at || new Date().toISOString(),
          signed_url: att.signed_url || att.download_url,
          download_url: att.download_url || att.signed_url || null,
        });
      }
    });

    // Auto-detect message type if type was default 'text' but attachments exist
    let resolvedType = type;
    if (resolvedType === 'text' && createdAttachments.length > 0) {
      const firstCat = createdAttachments[0]?.media_category;
      if (firstCat === 'image') resolvedType = 'image';
      else if (firstCat === 'video') resolvedType = 'video';
      else if (firstCat === 'audio') resolvedType = 'audio';
      else resolvedType = 'document';
    }

    const newMessage: Message = {
      id: newMessageId,
      conversation_id: 'main',
      space_id: spaceId,
      sender_id: senderId,
      content,
      type: resolvedType,
      reply_to_id: replyToId,
      reply_to: replyToId ? get().messages.find((m) => m.id === replyToId) : null,
      is_edited: false,
      edited_at: null,
      deleted_for_all: false,
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: createdAttachments,
      reactions: [],
      receipts: [],
    };

    // Optimistic UI update
    set((state) => ({
      messages: [...state.messages, newMessage],
      activeReply: null,
    }));

    playChime('subtle-pop');

    if (isFirebaseConfigured()) {
      try {
        await sendMessageToFirestore(spaceId, newMessage);
      } catch (err) {
        console.error('Failed to sync message to Firestore:', err);
      }
    } else {
      try {
        const localKey = `ourspace_messages_${spaceId}`;
        const local = localStorage.getItem(localKey);
        const parsed = local ? JSON.parse(local) : [];
        localStorage.setItem(localKey, JSON.stringify([...parsed, newMessage]));
      } catch {}
    }
  },

  editMessage: async (messageId, newContent, spaceId) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, content: newContent, is_edited: true, edited_at: new Date().toISOString() }
          : m
      ),
    }));

    if (isFirebaseConfigured() && spaceId) {
      await updateMessageInFirestore(spaceId, messageId, {
        content: newContent,
        is_edited: true,
      });
    }
  },

  deleteMessage: async (messageId, forEveryone, userId, spaceId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
      pinnedMessages: state.pinnedMessages.filter((m) => m.id !== messageId),
    }));

    if (isFirebaseConfigured() && spaceId) {
      await updateMessageInFirestore(spaceId, messageId, {
        deleted_for_all: forEveryone,
      });
    }
  },

  togglePinMessage: async (messageId, spaceId) => {
    const target = get().messages.find((m) => m.id === messageId);
    if (!target) return;
    const newPinned = !target.pinned;

    set((state) => {
      const updatedMessages = state.messages.map((m) =>
        m.id === messageId ? { ...m, pinned: newPinned } : m
      );
      return {
        messages: updatedMessages,
        pinnedMessages: updatedMessages.filter((m) => m.pinned),
      };
    });

    if (isFirebaseConfigured() && spaceId) {
      await updateMessageInFirestore(spaceId, messageId, { pinned: newPinned });
    }
  },

  addReaction: async (messageId, spaceId, userId, emoji) => {
    playChime('subtle-pop');

    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions || [];
        const alreadyReacted = existing.some((r) => r.user_id === userId && r.emoji === emoji);
        if (alreadyReacted) {
          return {
            ...m,
            reactions: existing.filter((r) => !(r.user_id === userId && r.emoji === emoji)),
          };
        }
        const newReaction: MessageReaction = {
          id: 'rx-' + Math.random().toString(36).substring(2, 9),
          message_id: messageId,
          space_id: spaceId,
          user_id: userId,
          emoji,
          created_at: new Date().toISOString(),
        };
        return {
          ...m,
          reactions: [...existing, newReaction],
        };
      }),
    }));

    if (isFirebaseConfigured()) {
      await addReactionToFirestore(spaceId, messageId, userId, emoji);
    }
  },

  setTyping: (spaceId, userId, isTyping) => {
    // Ephemeral typing can be synced via Firebase Realtime Database
  },

  setActiveReply: (message) => set({ activeReply: message }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  markAsRead: async (spaceId, userId) => {
    // In production, sync readBy array in Firestore
  },

  cleanupListeners: () => {
    if (firestoreMessagesUnsubscribe) {
      firestoreMessagesUnsubscribe();
      firestoreMessagesUnsubscribe = null;
    }
  },
}));
