import { memo } from 'react';
import {
  HomeIcon,
  DocumentTextIcon,
  StarIcon,
  SparklesIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  StarIcon as StarIconSolid,
} from '@heroicons/react/24/solid';

export type TabId = 'home' | 'pages' | 'favorites' | 'new';

interface MobileNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onOpenChat: () => void;
  hasUnreadChat?: boolean;
}

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof HomeIcon;
  activeIcon: typeof HomeIconSolid;
}

const tabs: TabConfig[] = [
  { id: 'home', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { id: 'pages', label: 'Pages', icon: DocumentTextIcon, activeIcon: DocumentTextIconSolid },
  { id: 'favorites', label: 'Favorites', icon: StarIcon, activeIcon: StarIconSolid },
];

export const MobileNavigation = memo(function MobileNavigation({
  activeTab,
  onTabChange,
  onOpenChat,
  hasUnreadChat = false,
}: MobileNavigationProps) {
  return (
    <nav className="flex items-center justify-around bg-white border-t border-gray-200 px-2 py-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = isActive ? tab.activeIcon : tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex flex-col items-center justify-center min-w-[64px] py-2 px-3
              rounded-lg transition-colors touch-manipulation
              ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
            `}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">{tab.label}</span>
          </button>
        );
      })}

      {/* New Page Button (center, prominent with label) */}
      <button
        onClick={() => onTabChange('new')}
        className="flex flex-col items-center justify-center min-w-[64px] py-1 px-3 touch-manipulation"
        aria-label="New note"
      >
        <div className="w-10 h-10 flex items-center justify-center bg-blue-600 rounded-full shadow-md active:scale-95 transition-transform">
          <PlusIcon className="w-6 h-6 text-white" />
        </div>
        <span className="text-xs mt-0.5 font-medium text-blue-600">New</span>
      </button>

      {/* AI Chat Button - Prominent with sparkle icon */}
      <button
        onClick={onOpenChat}
        className="flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-lg text-purple-600 hover:text-purple-700 transition-colors touch-manipulation relative"
        aria-label="Ask AI"
      >
        <SparklesIcon className="w-6 h-6" />
        <span className="text-xs mt-1 font-medium">Ask AI</span>
        {hasUnreadChat && (
          <span className="absolute top-1 right-3 w-2 h-2 bg-purple-600 rounded-full" />
        )}
      </button>
    </nav>
  );
});
