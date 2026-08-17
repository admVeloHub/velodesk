/**
 * WhatsAppEmojiPicker v1.0.0 — grade de emojis para compose WhatsApp
 * VERSION: v1.0.0 | DATE: 2026-08-17
 */
import React, { useState } from 'react';

const EMOJI_GROUPS = [
  {
    id: 'faces',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
      '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '😕', '😟', '🙁', '😮', '😯', '😲',
      '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
    ],
  },
  {
    id: 'gestures',
    icon: '👍',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '👋', '🤚',
      '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️',
    ],
  },
  {
    id: 'hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    ],
  },
  {
    id: 'common',
    icon: '⭐',
    emojis: [
      '⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌', '⚠️', '📌', '📞', '📱', '💻', '📧', '📅', '🕐', '💰', '💳',
      '🧾', '📦', '🎉', '🎊', '🎁', '🏆', '☕', '🍕', '🌹', '☀️', '🌙', '🌈', '🙏', '👀', '💬', '📝',
    ],
  },
];

export default function WhatsAppEmojiPicker({ onSelect, className = '' }) {
  const [activeGroupId, setActiveGroupId] = useState(EMOJI_GROUPS[0].id);
  const activeGroup = EMOJI_GROUPS.find((group) => group.id === activeGroupId) || EMOJI_GROUPS[0];

  return (
    <div className={`wa-emoji-picker${className ? ` ${className}` : ''}`} role="dialog" aria-label="Emojis">
      <div className="wa-emoji-picker__tabs" role="tablist" aria-label="Categorias de emoji">
        {EMOJI_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            className={'wa-emoji-picker__tab' + (group.id === activeGroupId ? ' wa-emoji-picker__tab--active' : '')}
            aria-selected={group.id === activeGroupId}
            aria-label={`Categoria ${group.id}`}
            onClick={() => setActiveGroupId(group.id)}
          >
            {group.icon}
          </button>
        ))}
      </div>
      <div className="wa-emoji-picker__grid" role="tabpanel">
        {activeGroup.emojis.map((emoji) => (
          <button
            key={`${activeGroup.id}-${emoji}`}
            type="button"
            className="wa-emoji-picker__emoji"
            aria-label={`Inserir emoji ${emoji}`}
            onClick={() => onSelect?.(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
