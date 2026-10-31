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

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-001',
    conversation_id: 'main',
    space_id: '11111111-1111-1111-1111-111111111111',
    sender_id: '00000000-0000-0000-0000-000000000002', // Jordan
    content: 'Good morning my love! Hope you slept well ✨',
    type: 'text',
    reply_to_id: null,
    is_edited: false,
    edited_at: null,
    deleted_for_all: false,
    pinned: false,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    reactions: [
      {
        id: 'rx-001',
        message_id: 'msg-001',
        space_id: '11111111-1111-1111-1111-111111111111',
        user_id: '00000000-0000-0000-0000-000000000001',
        emoji: '❤️',
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'msg-002',
    conversation_id: 'main',
    space_id: '11111111-1111-1111-1111-111111111111',
    sender_id: '00000000-0000-0000-0000-000000000001', // Alex
    content: 'Morning sweetheart! Just making coffee. Are we still on for our dinner date tonight?',
    type: 'text',
    reply_to_id: 'msg-001',
    is_edited: false,
    edited_at: null,
    deleted_for_all: false,
    pinned: true,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'msg-003',
    conversation_id: 'main',
    space_id: '11111111-1111-1111-1111-111111111111',
    sender_id: '00000000-0000-0000-0000-000000000002', // Jordan
    content: 'Absolutely! I booked that cozy Italian place by the river for 7:30 PM 🍝🥂',
    type: 'text',
    reply_to_id: null,
    is_edited: false,
    edited_at: null,
    deleted_for_all: false,
    pinned: false,
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    reactions: [
      {
        id: 'rx-002',
        message_id: 'msg-003',
        space_id: '11111111-1111-1111-1111-111111111111',
        user_id: '00000000-0000-0000-0000-000000000001',
        emoji: '😍',
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'msg-004',
    conversation_id: 'main',
    space_id: '11111111-1111-1111-1111-111111111111',
    sender_id: '00000000-0000-0000-0000-000000000001',
    content: 'Look at the sunrise from the balcony earlier today!',
    type: 'image',
    reply_to_id: null,
    is_edited: false,
    edited_at: null,
    deleted_for_all: false,
    pinned: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    attachments: [
      {
        id: 'att-001',
        message_id: 'msg-004',
        space_id: '11111111-1111-1111-1111-111111111111',
        file_path: 'mock/sunrise.jpg',
        file_name: 'sunrise_balcony.jpg',
        file_size: 2450000,
        file_type: 'image/jpeg',
        media_category: 'image',
        thumbnail_path: null,
        duration_seconds: null,
        width: 1200,
        height: 800,
        created_at: new Date(Date.now() - 1800000).toISOString(),
        signed_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
      },
    ],
  },
];

let firestoreMessagesUnsubscribe: (() => void) | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: INITIAL_MESSAGES,
  isLoading: false,
  isPartnerTyping: false,
  activeReply: null,
  pinnedMessages: INITIAL_MESSAGES.filter((m) => m.pinned),
  searchQuery: '',

  fetchMessages: async (spaceId) => {
    set({ isLoading: true });
    try {
      if (isFirebaseConfigured()) {
        if (firestoreMessagesUnsubscribe) firestoreMessagesUnsubscribe();

        firestoreMessagesUnsubscribe = subscribeToFirestoreMessages(spaceId, (realtimeMsgs) => {
          if (realtimeMsgs && realtimeMsgs.length > 0) {
            set({
              messages: realtimeMsgs,
              pinnedMessages: realtimeMsgs.filter((m) => m.pinned),
            });
          }
        });
      }
    } catch (err) {
      console.warn('Failed to listen to messages:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async ({ spaceId, senderId, content, type = 'text', replyToId = null, attachment }) => {
    const newMessageId = 'msg-' + Math.random().toString(36).substring(2, 9);

    let createdAttachment: MessageAttachment | undefined;
    if (attachment && attachment.file_name) {
      createdAttachment = {
        id: 'att-' + Math.random().toString(36).substring(2, 9),
        message_id: newMessageId,
        space_id: spaceId,
        file_path: attachment.file_path || 'local',
        file_name: attachment.file_name,
        file_size: attachment.file_size || 1024,
        file_type: attachment.file_type || 'application/octet-stream',
        media_category: attachment.media_category || 'image',
        thumbnail_path: null,
        duration_seconds: null,
        width: null,
        height: null,
        created_at: new Date().toISOString(),
        signed_url: attachment.signed_url,
      };
    }

    const newMessage: Message = {
      id: newMessageId,
      conversation_id: 'main',
      space_id: spaceId,
      sender_id: senderId,
      content,
      type,
      reply_to_id: replyToId,
      reply_to: replyToId ? get().messages.find((m) => m.id === replyToId) : null,
      is_edited: false,
      edited_at: null,
      deleted_for_all: false,
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: createdAttachment ? [createdAttachment] : [],
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
      await sendMessageToFirestore(spaceId, newMessage);
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
