import React, { useState, useRef, useEffect } from 'react';
import type { MentionableItem } from '../../utils/mentionResolver';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  availableItems?: MentionableItem[];
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const TYPE_ICONS: Record<MentionableItem['type'], string> = {
  model: '👤',
  clothing: '👗',
  scene: '🌄',
  storyboard: '🎬',
  layer: '📄'
};

const TYPE_NAMES: Record<MentionableItem['type'], string> = {
  model: '模特',
  clothing: '服装',
  scene: '场景',
  storyboard: '分镜',
  layer: '图层'
};

export const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  placeholder = '输入提示词或描述，键入 @ 可引用模特、场景或分镜素材...',
  rows = 3,
  availableItems = [],
  className = '',
  style = {},
  disabled = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter items based on query after '@'
  const filteredItems = availableItems.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
  );

  // Detect '@' trigger while typing
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);

    // Look back from cursor to find if we're currently typing a mention
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's no space between '@' and cursor
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!/\s/.test(textAfterAt)) {
        setMentionStartIndex(lastAtIndex);
        setQuery(textAfterAt);
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowDropdown(false);
    setMentionStartIndex(null);
  };

  const insertMention = (item: MentionableItem) => {
    if (mentionStartIndex === null || !textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart || 0;
    const before = value.slice(0, mentionStartIndex);
    const after = value.slice(cursorPos);
    const mentionToken = `@[${item.label}] `;
    const nextValue = `${before}${mentionToken}${after}`;

    onChange(nextValue);
    setShowDropdown(false);
    setMentionStartIndex(null);

    // Reposition cursor after the inserted token
    setTimeout(() => {
      if (textareaRef.current) {
        const nextPos = mentionStartIndex + mentionToken.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showDropdown && filteredItems[selectedIndex]) {
        e.preventDefault();
        insertMention(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute active referenced chips
  const activeTokens = (value.match(/@\[([^\]]+)\]/g) || []).map(t => t.slice(2, -1));
  const activeItems = availableItems.filter(item => activeTokens.includes(item.label));

  const removeMentionChip = (label: string) => {
    const next = value.replace(new RegExp(`@\\[${label}\\]\\s?`, 'g'), '');
    onChange(next);
  };

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-element)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          lineHeight: '1.6',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          ...style
        }}
      />

      {/* Floating Autocomplete Dropdown */}
      {showDropdown && filteredItems.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: '6px',
            maxHeight: '220px',
            overflowY: 'auto',
            background: 'var(--modal-bg, var(--bg-surface))',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 1000,
            padding: '6px'
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
            💡 引用素材或分镜（回车键确认）
          </div>
          {filteredItems.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => insertMention(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: idx === selectedIndex ? 'var(--accent-purple-glow, rgba(124, 58, 237, 0.12))' : 'transparent',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.label}
                  style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '16px' }}>{TYPE_ICONS[item.type]}</span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-element)', color: 'var(--text-muted)' }}>
                    {TYPE_NAMES[item.type]}
                  </span>
                </div>
                {item.description && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active References Chips */}
      {activeItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>已关联素材:</span>
          {activeItems.map(item => (
            <span
              key={item.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'var(--accent-purple-glow, rgba(124, 58, 237, 0.1))',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                fontSize: '11px',
                color: 'var(--accent-purple)'
              }}
            >
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span>{TYPE_ICONS[item.type]}</span>
              )}
              <span>{item.label}</span>
              <button
                type="button"
                onClick={() => removeMentionChip(item.label)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-purple)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '12px',
                  lineHeight: '1'
                }}
                title="移除引用"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
