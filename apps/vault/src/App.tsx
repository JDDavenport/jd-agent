import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { NotionSidebar } from './components/NotionSidebar';
import { MobileLayout, MobileHomeView, TabId } from './components/mobile';
import { SyncProvider } from './contexts/SyncContext';
import { usePlatform } from './hooks/usePlatform';
import { BlockPageView } from './views/BlockPageView';
import { SearchView } from './views/SearchView';
import { JournalViewConnected } from './views/JournalViewConnected';
import { ArchiveViewConnected } from './views/ArchiveViewConnected';
import { TagsView } from './views/TagsView';
import { GoalsView } from './views/GoalsView';
import { ClassView } from './views/ClassView';
import { PageView } from './components/PageView';
import { VaultList } from './components/VaultList';
import { NewEntryModal } from './components/NewEntryModal';
import { Breadcrumb } from './components/Breadcrumb';
import { CommandPalette } from './components/CommandPalette';
import { VaultChat } from './components/VaultChat';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import {
  useVaultEntries,
  useVaultSearch,
  useVaultEntry,
  useVaultBreadcrumb,
  useVaultChildren,
  useUpdateVaultEntry,
} from './hooks/useVault';
import {
  useVaultPageTree,
  useVaultPageFavorites,
  useCreateVaultPage,
  useVaultPages,
  vaultPageKeys,
  useToggleVaultPageFavorite,
  useUpdateVaultPage,
  useDeleteVaultPage,
  usePARAFolders,
  useInitializePARA,
} from './hooks/useVaultPages';
import type { VaultEntry } from './api';
import './editor/editor.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

type AppMode = 'notion' | 'legacy';
type ViewType =
  | 'search'
  | 'inbox'
  | 'favorites'
  | 'journal'
  | 'goals'
  | 'archive'
  | 'projects'
  | 'areas'
  | 'resources'
  | 'people'
  | 'recordings'
  | 'tags'
  | 'page'
  | 'legacy-page'
  | 'classes'
  | 'class-detail';

function VaultApp() {
  // Platform detection
  const { isMobile } = usePlatform();

  // App mode: 'legacy' for vault entries (primary mode)
  const [appMode, setAppMode] = useState<AppMode>('legacy');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Mobile-specific state
  const [mobileTab, setMobileTab] = useState<TabId>('home');

  // Class view state
  const [selectedClassCode, setSelectedClassCode] = useState<string | null>(null);

  // Legacy mode state
  const [_selectedView, setSelectedView] = useState('search');
  const [viewType, setViewType] = useState<ViewType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEntryParentId, setNewEntryParentId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string>('inbox'); // Track active sidebar view

  // New Notion-style hooks
  const { data: pageTree = [], isLoading: isLoadingPageTree } = useVaultPageTree();
  const { data: favorites = [] } = useVaultPageFavorites();
  const { data: allPages = [] } = useVaultPages();
  const { data: paraFolders = [] } = usePARAFolders();
  const initializePARA = useInitializePARA();
  const createPage = useCreateVaultPage();
  const togglePageFavorite = useToggleVaultPageFavorite();
  const updatePage = useUpdateVaultPage();
  const deletePage = useDeleteVaultPage();
  const queryClient = useQueryClient();

  // Auto-initialize PARA folders if they don't exist
  useEffect(() => {
    if (paraFolders.length === 0 && !initializePARA.isPending) {
      initializePARA.mutate();
    }
  }, [paraFolders, initializePARA]);

  // Legacy hooks
  const { data: allEntries, isLoading: isLoadingAll } = useVaultEntries();
  const { data: searchResults, isLoading: isSearching } = useVaultSearch({
    query: searchQuery,
  });
  const { data: selectedEntry } = useVaultEntry(selectedEntryId);
  const { data: breadcrumb } = useVaultBreadcrumb(selectedEntryId);
  const { data: entryChildren = [] } = useVaultChildren(selectedEntryId);
  const updateEntry = useUpdateVaultEntry();

  // Notion mode handlers
  const handleSelectPage = useCallback((pageId: string) => {
    setSelectedPageId(pageId);
    setAppMode('notion');
    // On mobile, switch to pages tab when viewing a page
    if (isMobile) {
      setMobileTab('pages');
    }
  }, [isMobile]);

  // Notion-style instant page creation - creates "Untitled" and navigates immediately
  const handleCreatePage = useCallback(
    async (parentId?: string) => {
      try {
        const newPage = await createPage.mutateAsync({
          title: 'Untitled',
          parentId: parentId || null,
        });
        setSelectedPageId(newPage.id);
        setAppMode('notion');
      } catch (error) {
        console.error('Failed to create page:', error);
      }
    },
    [createPage]
  );

  const handleOpenSearch = useCallback(() => {
    setShowCommandPalette(true);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  // Legacy mode handlers
  const handleSelectView = useCallback((viewId: string, type: ViewType) => {
    setSelectedView(viewId);
    setViewType(type);
    if (type === 'legacy-page') {
      setSelectedEntryId(viewId);
      setAppMode('legacy');
    } else {
      setSelectedEntryId(null);
    }
  }, []);

  const handleSelectEntry = (entry: VaultEntry) => {
    setSelectedEntryId(entry.id);
    setSelectedView(entry.id);
    setViewType('legacy-page');
    setAppMode('legacy');
  };

  const handleUpdateEntry = useCallback(
    async (id: string, data: Partial<{ title: string; content: string }>) => {
      try {
        await updateEntry.mutateAsync({ id, input: data });
      } catch (error) {
        console.error('Failed to update entry:', error);
      }
    },
    [updateEntry]
  );

  const handleNewEntry = (parentId?: string) => {
    setNewEntryParentId(parentId ?? null);
    setShowNewModal(true);
  };

  const handleCloseNewModal = () => {
    setShowNewModal(false);
    setNewEntryParentId(null);
  };

  const handleBreadcrumbNavigate = (id: string | null) => {
    if (id) {
      handleSelectView(id, 'legacy-page');
    } else {
      handleSelectView('search', 'search');
    }
  };

  const handleQuickAction = (action: string) => {
    const actionMap: Record<string, ViewType> = {
      inbox: 'inbox',
      journal: 'journal',
      goals: 'goals',
      favorites: 'favorites',
      projects: 'projects',
      areas: 'areas',
      resources: 'resources',
      people: 'people',
      recordings: 'recordings',
    };
    const type = actionMap[action];
    if (type) {
      handleSelectView(action, type);
      setAppMode('legacy');
    }
  };

  // Navigation handler for sidebar
  const handleNavigateTo = useCallback((view: 'journal' | 'favorites' | 'recordings' | 'classes') => {
    setActiveView(view);
    const viewTypeMap: Record<string, ViewType> = {
      journal: 'journal',
      favorites: 'favorites',
      recordings: 'recordings',
      classes: 'classes',
    };
    setViewType(viewTypeMap[view] || 'search');
    setAppMode('legacy');
    setSelectedEntryId(null);
    setSelectedPageId(null);
    setSelectedClassCode(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Command palette: ⌘K
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      // New page: ⌘N - Always use Notion-style instant creation
      if (e.key === 'n' && (e.metaKey || e.ctrlKey) && !isInput) {
        e.preventDefault();
        handleCreatePage();
        return;
      }

      // Toggle sidebar: ⌘\
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
        } else if (showNewModal) {
          handleCloseNewModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, showCommandPalette, showNewModal, handleCreatePage, handleToggleSidebar]);

  // Filter entries by view type (legacy mode)
  const getFilteredEntries = () => {
    if (!allEntries) return [];

    switch (viewType) {
      case 'inbox':
        return allEntries.filter((e) => !e.tags?.includes('processed'));
      case 'favorites':
        return allEntries.filter((e) => e.tags?.includes('favorite'));
      case 'recordings':
        return allEntries.filter((e) =>
          ['recording_summary', 'meeting'].includes(e.contentType)
        );
      case 'people':
        return allEntries.filter(
          (e) => e.contentType === 'reference' && e.tags?.includes('person')
        );
      case 'journal':
        return allEntries.filter((e) => e.contentType === 'journal');
      case 'archive':
        return allEntries.filter((e) => e.tags?.includes('archived'));
      case 'resources':
        return allEntries.filter((e) =>
          ['article', 'reference', 'document'].includes(e.contentType)
        );
      case 'projects':
        return allEntries.filter((e) => e.tags?.includes('project'));
      case 'areas':
        return allEntries.filter((e) => e.tags?.includes('area'));
      default:
        return allEntries;
    }
  };

  const getViewTitle = () => {
    switch (viewType) {
      case 'inbox':
        return 'Inbox';
      case 'favorites':
        return 'Favorites';
      case 'journal':
        return 'Journal';
      case 'goals':
        return 'Goals';
      case 'archive':
        return 'Archive';
      case 'projects':
        return 'Projects';
      case 'areas':
        return 'Areas';
      case 'resources':
        return 'Resources';
      case 'people':
        return 'People';
      case 'recordings':
        return 'Recordings';
      case 'tags':
        return 'Tags';
      case 'classes':
        return 'MBA Classes';
      case 'class-detail':
        return selectedClassCode || 'Class';
      case 'legacy-page':
        return selectedEntry?.title || 'Page';
      default:
        return 'Vault';
    }
  };

  // Render main content based on mode
  const renderMainContent = () => {
    // Notion mode: show block page view
    if (appMode === 'notion' && selectedPageId) {
      return <BlockPageView pageId={selectedPageId} onNavigate={handleSelectPage} onOpenSearch={handleOpenSearch} />;
    }

    // Notion mode with no page selected: show welcome
    if (appMode === 'notion' && !selectedPageId) {
      return (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📚</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to JD Vault</h1>
            <p className="text-gray-500 mb-6">
              Select a page from the sidebar or create a new one to get started.
            </p>
            <button
              onClick={() => handleCreatePage()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <span>Create your first page</span>
            </button>
          </div>
        </div>
      );
    }

    // Legacy mode: viewing a specific entry
    if (selectedEntry && viewType === 'legacy-page') {
      return (
        <div className="flex flex-col h-full">
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
              <Breadcrumb items={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <PageView
              entry={selectedEntry}
              children={entryChildren}
              onUpdate={handleUpdateEntry}
              onLinkClick={(title) => {
                const linked = allEntries?.find((e) => e.title === title);
                if (linked) {
                  handleSelectEntry(linked);
                }
              }}
              onSelectEntry={handleSelectEntry}
              onCreateChild={(parentId) => handleNewEntry(parentId)}
            />
          </div>
        </div>
      );
    }

    // Legacy views
    switch (viewType) {
      case 'search':
        return (
          <SearchView
            recentEntries={allEntries?.slice(0, 5)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            onSelectEntry={handleSelectEntry}
            onQuickAction={handleQuickAction}
          />
        );

      case 'journal':
        return <JournalViewConnected />;

      case 'archive':
        return (
          <ArchiveViewConnected
            onTaskClick={(taskId) => {
              // Navigate to the task's vault entry if available
              const entry = allEntries?.find((e) => e.sourceRef === taskId);
              if (entry) {
                handleSelectEntry(entry);
              }
            }}
          />
        );

      case 'goals':
        return (
          <GoalsView
            onGoalSelect={(goalId) => {
              // Could navigate to a goal detail view or link
              console.log('Selected goal:', goalId);
            }}
          />
        );

      case 'tags':
        return (
          <TagsView
            entries={allEntries}
            onTagSelect={(tag) => {
              setSearchQuery(`tag:${tag}`);
              handleSelectView('search', 'search');
            }}
          />
        );

      case 'class-detail':
        return selectedClassCode ? (
          <ClassView
            classCode={selectedClassCode}
            onNavigateToPage={handleSelectPage}
            onBack={() => {
              setSelectedClassCode(null);
              setViewType('classes');
            }}
          />
        ) : null;

      case 'classes':
        // Show class list view (using ClassView for all semesters)
        return (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-[#191919]">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                MBA Classes
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Select a class from the sidebar to view and combine notes.
              </p>
            </div>
          </div>
        );

      default:
        // List view for inbox, favorites, projects, etc.
        return (
          <div className="max-w-3xl mx-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-gray-900">{getViewTitle()}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {getFilteredEntries().length} entries
              </p>
            </div>
            <VaultList
              entries={getFilteredEntries()}
              isLoading={isLoadingAll}
              emptyMessage={`No entries in ${getViewTitle().toLowerCase()}`}
              onSelect={handleSelectEntry}
            />
          </div>
        );
    }
  };

  // Mobile tab change handler
  const handleMobileTabChange = useCallback(
    (tab: TabId) => {
      setMobileTab(tab);
      if (tab === 'new') {
        handleCreatePage();
        setMobileTab('pages');
      } else if (tab === 'home') {
        setViewType('search');
        setAppMode('legacy');
        setSelectedPageId(null);
      } else if (tab === 'favorites') {
        setViewType('favorites');
        setAppMode('legacy');
      } else if (tab === 'pages') {
        // Stay on current page or show page list
      }
    },
    [handleCreatePage]
  );

  // Mobile-specific content rendering
  const handleRefreshMobile = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() }),
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.favorites() }),
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.list() }),
    ]);
  }, [queryClient]);

  const handleFavoritePage = useCallback((pageId: string) => {
    togglePageFavorite.mutate(pageId);
  }, [togglePageFavorite]);

  const handleArchivePage = useCallback((pageId: string) => {
    updatePage.mutate({ id: pageId, input: { isArchived: true } });
  }, [updatePage]);

  const handleDeletePage = useCallback((pageId: string) => {
    deletePage.mutate(pageId);
  }, [deletePage]);

  const renderMobileContent = () => {
    // Home tab shows hierarchical page list
    if (mobileTab === 'home') {
      return (
        <MobileHomeView
          pageTree={pageTree}
          favorites={favorites}
          recentPages={allPages}
          onQuickAction={(action) => {
            if (action === 'classes') {
              handleNavigateTo('classes');
            } else {
              handleQuickAction(action);
            }
          }}
          onOpenSearch={handleOpenSearch}
          onOpenChat={() => setShowChat(true)}
          onRefresh={handleRefreshMobile}
          onFavoritePage={handleFavoritePage}
          onArchivePage={handleArchivePage}
          onDeletePage={handleDeletePage}
          onSelectPage={handleSelectPage}
          onCreatePage={handleCreatePage}
        />
      );
    }

    // Favorites tab shows favorite pages
    if (mobileTab === 'favorites') {
      return (
        <MobileHomeView
          pageTree={[]}
          favorites={favorites}
          recentPages={[]}
          onQuickAction={(action) => {
            if (action === 'classes') {
              handleNavigateTo('classes');
            } else {
              handleQuickAction(action);
            }
          }}
          onOpenSearch={handleOpenSearch}
          onOpenChat={() => setShowChat(true)}
          onRefresh={handleRefreshMobile}
          onFavoritePage={handleFavoritePage}
          onArchivePage={handleArchivePage}
          onDeletePage={handleDeletePage}
          onSelectPage={handleSelectPage}
          onCreatePage={handleCreatePage}
        />
      );
    }

    // Pages tab or when a page is selected
    return renderMainContent();
  };

  // Mobile layout
  if (isMobile) {
    const showMobileHeader = !(appMode === 'notion' && selectedPageId);
    return (
      <MobileLayout
        pageTree={pageTree}
        favorites={favorites}
        selectedPageId={selectedPageId}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        onOpenSearch={handleOpenSearch}
        onOpenChat={() => setShowChat(true)}
        showChat={showChat}
        onCloseChat={() => setShowChat(false)}
        chatContent={
          <VaultChat
            isOpen={true}
            onClose={() => setShowChat(false)}
            onNavigateToPage={handleSelectPage}
            embedded
          />
        }
        activeTab={mobileTab}
        onTabChange={handleMobileTabChange}
        showHeader={showMobileHeader}
      >
        {renderMobileContent()}

        {/* Command Palette */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onSelectPage={handleSelectPage}
          onSelectLegacyEntry={handleSelectEntry}
          onCreatePage={handleCreatePage}
        />

        {/* Legacy New Entry Modal */}
        <NewEntryModal
          isOpen={showNewModal}
          onClose={handleCloseNewModal}
          parentId={newEntryParentId}
        />
      </MobileLayout>
    );
  }

  // Desktop layout
  return (
    <div data-testid="vault-app" className="flex h-screen bg-white">
      {/* Notion-style Sidebar */}
      <NotionSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        selectedPageId={selectedPageId}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        onOpenSearch={handleOpenSearch}
        onOpenChat={() => setShowChat(true)}
        onNavigateTo={handleNavigateTo}
        pageTree={pageTree}
        favorites={favorites}
        isLoading={isLoadingPageTree}
        activeView={activeView}
      />

      {/* Main Content */}
      <main data-testid="vault-main" className="flex-1 flex flex-col overflow-hidden">{renderMainContent()}</main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onSelectPage={handleSelectPage}
        onSelectLegacyEntry={handleSelectEntry}
        onCreatePage={handleCreatePage}
      />

      {/* Legacy New Entry Modal */}
      <NewEntryModal
        isOpen={showNewModal}
        onClose={handleCloseNewModal}
        parentId={newEntryParentId}
      />

      {/* Vault Chat Panel */}
      <VaultChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onNavigateToPage={handleSelectPage}
      />

    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <div className="relative">
          <VaultApp />
          <PwaUpdateToast />
        </div>
      </SyncProvider>
    </QueryClientProvider>
  );
}
