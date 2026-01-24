import { useEffect, useRef, ReactNode, useState, useCallback } from 'react';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  initialHeight?: 'half' | 'full';
  allowFullExpand?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  initialHeight = 'half',
  allowFullExpand = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isFullHeight, setIsFullHeight] = useState(initialHeight === 'full');
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset to initial height when closing
  useEffect(() => {
    if (!isOpen) {
      setIsFullHeight(initialHeight === 'full');
    }
  }, [isOpen, initialHeight]);

  // Drag handling
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    startYRef.current = clientY;
    currentYRef.current = clientY;
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    currentYRef.current = clientY;
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const threshold = 50;

    if (deltaY > threshold) {
      // Dragged down
      if (isFullHeight) {
        setIsFullHeight(false);
      } else {
        onClose();
      }
    } else if (deltaY < -threshold && allowFullExpand) {
      // Dragged up
      setIsFullHeight(true);
    }
  }, [isDragging, isFullHeight, allowFullExpand, onClose]);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleDragStart(e.touches[0].clientY);
    },
    [handleDragStart]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleDragMove(e.touches[0].clientY);
    },
    [handleDragMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Mouse handlers (for testing on desktop)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleDragStart(e.clientY);
    },
    [handleDragStart]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const sheetHeight = isFullHeight ? 'calc(100% - env(safe-area-inset-top) - 20px)' : '60%';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`
          fixed left-0 right-0 bottom-0 bg-white z-50 rounded-t-2xl shadow-2xl
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
          flex flex-col
        `}
        style={{ height: sheetHeight }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
      >
        {/* Drag Handle */}
        <div
          ref={dragRef}
          className="flex-shrink-0 pt-3 pb-2 cursor-grab active:cursor-grabbing touch-manipulation"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <div className="flex items-center gap-2">
              {allowFullExpand && (
                <button
                  onClick={() => setIsFullHeight(!isFullHeight)}
                  className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                  aria-label={isFullHeight ? 'Minimize' : 'Expand'}
                >
                  <ChevronDownIcon
                    className={`w-5 h-5 text-gray-500 transition-transform ${isFullHeight ? '' : 'rotate-180'}`}
                  />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {/* Safe Area Bottom */}
        <div className="h-safe-bottom flex-shrink-0" />
      </div>
    </>
  );
}
