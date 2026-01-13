import { useState, useRef, useEffect } from 'react';
import {
  StarIcon as StarOutline,
  EllipsisHorizontalIcon,
  ChevronRightIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import type { VaultPage, VaultPageBreadcrumb } from '../api';

interface PageHeaderProps {
  page: VaultPage;
  breadcrumbs: VaultPageBreadcrumb[];
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string) => void;
  onCoverChange: (coverUrl: string | null) => void;
  onToggleFavorite: () => void;
  onNavigate: (pageId: string) => void;
}

// Preset cover images (gradient colors and patterns)
const PRESET_COVERS = [
  // Gradients
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  // Solid colors
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
];

export function PageHeader({
  page,
  breadcrumbs,
  onTitleChange,
  onIconChange,
  onCoverChange,
  onToggleFavorite,
  onNavigate,
}: PageHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showAddButtons, setShowAddButtons] = useState(false);
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

  const handleCoverSelect = (cover: string) => {
    onCoverChange(cover);
    setShowCoverPicker(false);
  };

  const hasCover = !!page.coverImage;

  return (
    <div>
      {/* Cover Image */}
      {hasCover && (
        <div
          className="relative h-48 w-full group/cover"
          style={{
            background: page.coverImage?.startsWith('linear-gradient')
              ? page.coverImage
              : `url(${page.coverImage}) center/cover no-repeat`,
          }}
        >
          {/* Cover actions */}
          <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover/cover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowCoverPicker(true)}
              className="px-3 py-1.5 text-sm bg-white/90 hover:bg-white rounded shadow text-gray-700 transition-colors"
            >
              Change cover
            </button>
            <button
              onClick={() => onCoverChange(null)}
              className="p-1.5 bg-white/90 hover:bg-white rounded shadow text-gray-700 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cover Picker Modal */}
      {showCoverPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCoverPicker(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Choose cover</h3>
              <button onClick={() => setShowCoverPicker(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COVERS.map((cover, i) => (
                <button
                  key={i}
                  onClick={() => handleCoverSelect(cover)}
                  className="h-16 rounded-lg hover:ring-2 hover:ring-blue-500 transition-all"
                  style={{ background: cover }}
                />
              ))}
            </div>
            <button
              onClick={() => onCoverChange(null)}
              className="w-full mt-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Remove cover
            </button>
          </div>
        </div>
      )}

      <div className={`px-24 ${hasCover ? 'pt-4' : 'pt-8'} pb-4`}>
        {/* Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
            {breadcrumbs.slice(0, -1).map((crumb, index) => (
              <div key={crumb.id} className="flex items-center gap-1">
                {index > 0 && <ChevronRightIcon className="w-3 h-3" />}
                <button
                  onClick={() => onNavigate(crumb.id)}
                  className="hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 px-1.5 py-0.5 rounded transition-colors"
                >
                  {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                  <span className="max-w-[150px] truncate">{crumb.title}</span>
                </button>
              </div>
            ))}
          </nav>
        )}

        {/* Add cover/icon buttons (show on hover when no cover) */}
        {!hasCover && (
          <div
            className="mb-2 -ml-1"
            onMouseEnter={() => setShowAddButtons(true)}
            onMouseLeave={() => setShowAddButtons(false)}
          >
            <div className={`flex gap-2 transition-opacity ${showAddButtons ? 'opacity-100' : 'opacity-0'}`}>
              {!page.icon && (
                <button
                  onClick={() => setShowIconPicker(true)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  <span>😀</span>
                  <span>Add icon</span>
                </button>
              )}
              <button
                onClick={() => setShowCoverPicker(true)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <PhotoIcon className="w-4 h-4" />
                <span>Add cover</span>
              </button>
            </div>
          </div>
        )}

        {/* Icon + Title Row */}
        <div className="flex items-start gap-2 group">
          {/* Icon */}
          <div className="relative">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className={`rounded hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors ${
                hasCover && page.icon ? 'w-16 h-16 text-5xl -mt-10 bg-white dark:bg-gray-900 shadow-lg' : 'w-12 h-12 text-3xl'
              }`}
            >
              {page.icon || '📄'}
            </button>

            {/* Icon Picker Dropdown */}
            {showIconPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 w-64">
                <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">Quick icons</div>
                <div className="grid grid-cols-8 gap-1">
                  {commonEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleIconSelect(emoji)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleIconSelect('')}
                  className="w-full mt-2 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left"
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
                className="w-full text-4xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Untitled"
              />
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="text-4xl font-bold text-gray-900 dark:text-gray-100 cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 -ml-1 transition-colors"
              >
                {page.title || 'Untitled'}
              </h1>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onToggleFavorite}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {page.isFavorite ? (
                <StarSolid className="w-5 h-5 text-yellow-500" />
              ) : (
                <StarOutline className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <button
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="More options"
            >
              <EllipsisHorizontalIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
