import { useState, useRef, useEffect } from 'react';
import {
  StarIcon as StarOutline,
  EllipsisHorizontalIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import type { VaultPage, VaultPageBreadcrumb } from '../api';

interface PageHeaderProps {
  page: VaultPage;
  breadcrumbs: VaultPageBreadcrumb[];
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string) => void;
  onToggleFavorite: () => void;
  onNavigate: (pageId: string) => void;
}

export function PageHeader({
  page,
  breadcrumbs,
  onTitleChange,
  onIconChange,
  onToggleFavorite,
  onNavigate,
}: PageHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Common emojis for quick selection
  const commonEmojis = [
    '📝', '📚', '💡', '🎯', '✨', '🚀', '💼', '📊',
    '🔧', '🎨', '📱', '💻', '🌟', '📌', '🔖', '📋',
    '✅', '❤️', '🔥', '⭐', '💪', '🧠', '🎓', '🏠',
  ];

  useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (title.trim() && title !== page.title) {
      onTitleChange(title.trim());
    } else {
      setTitle(page.title);
    }
  };

  const handleIconSelect = (emoji: string) => {
    onIconChange(emoji);
    setShowIconPicker(false);
  };

  return (
    <div className="px-24 pt-8 pb-4">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
          {breadcrumbs.slice(0, -1).map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1">
              {index > 0 && <ChevronRightIcon className="w-3 h-3" />}
              <button
                onClick={() => onNavigate(crumb.id)}
                className="hover:text-gray-800 hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors"
              >
                {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                <span className="max-w-[150px] truncate">{crumb.title}</span>
              </button>
            </div>
          ))}
        </nav>
      )}

      {/* Icon + Title Row */}
      <div className="flex items-start gap-2 group">
        {/* Icon */}
        <div className="relative">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="w-12 h-12 rounded hover:bg-gray-100 flex items-center justify-center text-3xl transition-colors"
          >
            {page.icon || '📄'}
          </button>

          {/* Icon Picker Dropdown */}
          {showIconPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-64">
              <div className="text-xs text-gray-500 px-2 py-1 mb-1">Quick icons</div>
              <div className="grid grid-cols-8 gap-1">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleIconSelect(emoji)}
                    className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleIconSelect('')}
                className="w-full mt-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors text-left"
              >
                Remove icon
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTitle(page.title);
                  setIsEditingTitle(false);
                }
              }}
              className="w-full text-4xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-400"
              placeholder="Untitled"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-4xl font-bold text-gray-900 cursor-text hover:bg-gray-50 rounded px-1 -ml-1 transition-colors"
            >
              {page.title || 'Untitled'}
            </h1>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleFavorite}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title={page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {page.isFavorite ? (
              <StarSolid className="w-5 h-5 text-yellow-500" />
            ) : (
              <StarOutline className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <button
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title="More options"
          >
            <EllipsisHorizontalIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
