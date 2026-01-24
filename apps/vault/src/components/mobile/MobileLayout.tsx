import { useState, useCallback, ReactNode } from 'react';
import { MobileNavigation, TabId } from './MobileNavigation';
import { MobileSidebar } from './MobileSidebar';
import { BottomSheet } from './BottomSheet';
import { useSync } from '../../contexts/SyncContext';
import type { VaultPageTreeNode, VaultPage } from '../../lib/types';

interface MobileLayoutProps {
  children: ReactNode;
  pageTree: VaultPageTreeNode[];
  favorites: VaultPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onOpenSearch: () => void;
  onOpenChat: () => void;
  showChat: boolean;
  onCloseChat: () => void;
  chatContent: ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function MobileLayout({
  children,
  pageTree,
  favorites,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onOpenSearch,
  onOpenChat,
  showChat,
  onCloseChat,
  chatContent,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOnline, isSyncing, pendingChanges } = useSync();

  const handleOpenSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleSelectPage = useCallback(
    (pageId: string) => {
      onSelectPage(pageId);
      setSidebarOpen(false);
    },
    [onSelectPage]
  );

  const handleCreatePage = useCallback(
    (parentId?: string) => {
      onCreatePage(parentId);
      setSidebarOpen(false);
    },
    [onCreatePage]
  );

  return (
    <div className="flex flex-col h-screen bg-white safe-area-inset">
      {/* Status Bar Area */}
      <div className="h-safe-top bg-gray-50 flex-shrink-0" />

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={handleOpenSidebar}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation flex-shrink-0"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Search Bar - Prominent and Accessible */}
        <button
          onClick={onOpenSearch}
          className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 active:bg-gray-300 touch-manipulation transition-colors"
          aria-label="Search notes"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="text-sm">Search notes...</span>
        </button>

        {/* Sync status indicator */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isOnline && (
            <span className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
              Offline
            </span>
          )}
          {isSyncing && (
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Syncing..." />
          )}
          {pendingChanges > 0 && !isSyncing && (
            <span className="w-2 h-2 bg-yellow-500 rounded-full" title={`${pendingChanges} pending`} />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Bottom Navigation */}
      <MobileNavigation
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenChat={onOpenChat}
        hasUnreadChat={false}
      />

      {/* Bottom Safe Area */}
      <div className="h-safe-bottom bg-white flex-shrink-0" />

      {/* Sidebar Drawer */}
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        pageTree={pageTree}
        favorites={favorites}
        selectedPageId={selectedPageId}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
      />

      {/* Chat Bottom Sheet */}
      <BottomSheet isOpen={showChat} onClose={onCloseChat} title="Ask Vault">
        {chatContent}
      </BottomSheet>
    </div>
  );
}
