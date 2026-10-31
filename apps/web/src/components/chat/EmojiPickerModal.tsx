'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji?: (emoji: string) => void;
}

const EMOJI_GROUPS = [
  {
    title: 'Love & Romance',
    emojis: ['❤️', '💖', '💕', '💘', '💞', '💓', '💗', '💌', '😍', '🥰', '😘', '😚', '🌹', '💐', '💍', '✨'],
  },
  {
    title: 'Smileys & Emotions',
    emojis: ['😊', '😇', '🥺', '😂', '🤣', '🤤', '😋', '🤗', '🤩', '🥳', '😎', '😴', '🙈', '🙉', '🙊', '💯'],
  },
  {
    title: 'Gestures & Cuddles',
    emojis: ['👋', '🤝', '🙌', '👏', '🙏', '💋', '👄', '🫂', '👫', '👩‍❤️‍👨', '👩‍❤️‍👩', '👨‍❤️‍👨', '💑', '🧸'],
  },
  {
    title: 'Celebration & Cozy',
    emojis: ['🎉', '🎊', '🥂', '🍾', '☕', '🍷', '🍕', '🍰', '🍫', '🍿', '🎬', '✈️', '🏖️', '🌙', '⭐', '🔥'],
  },
];

export function EmojiPickerModal({ isOpen, onClose, onSelectEmoji }: EmojiPickerModalProps) {
  const { user, space } = useAuthStore();
  const { sendMessage } = useChatStore();

  const handlePick = (emoji: string) => {
    if (onSelectEmoji) {
      onSelectEmoji(emoji);
    } else {
      if (!space || !user) return;
      sendMessage({
        spaceId: space.id,
        senderId: user.id,
        content: emoji,
        type: 'text',
      });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pick an Emoji" description="Tap an emoji to send immediately">
      <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-1">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1.5">
            <h5 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              {group.title}
            </h5>
            <div className="grid grid-cols-8 gap-2">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handlePick(emoji)}
                  className="w-10 h-10 rounded-2xl hover:bg-rose-100 dark:hover:bg-zinc-800 text-2xl flex items-center justify-center hover:scale-125 transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
