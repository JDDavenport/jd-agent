import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import type { VaultBreadcrumb } from '@jd-agent/types';

interface BreadcrumbProps {
  items: VaultBreadcrumb[];
  onNavigate: (id: string | null) => void;
  showHome?: boolean;
}

export function Breadcrumb({ items, onNavigate, showHome = true }: BreadcrumbProps) {
  if (items.length === 0 && !showHome) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {showHome && (
        <>
          <button
            onClick={() => onNavigate(null)}
            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Vault</span>
          </button>
          {items.length > 0 && (
            <ChevronRightIcon className="w-3 h-3 text-gray-400" />
          )}
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={item.id} className="flex items-center gap-1">
            {isLast ? (
              <span className="text-gray-900 font-medium truncate max-w-[200px]">
                {item.title}
              </span>
            ) : (
              <>
                <button
                  onClick={() => onNavigate(item.id)}
                  className="hover:text-gray-700 transition-colors truncate max-w-[150px]"
                >
                  {item.title}
                </button>
                <ChevronRightIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
