import { useCallback, useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Backlinks } from '../components/Backlinks';
import { BlockEditor } from '../editor/BlockEditor';
import { MobileBlockEditor } from '../editor/mobile';
import { usePlatform } from '../hooks/usePlatform';
import {
  useVaultPage,
  useUpdateVaultPage,
  useToggleVaultPageFavorite,
  useCreateVaultPage,
} from '../hooks/useVaultPages';

interface BlockPageViewProps {
  pageId: string;
  onNavigate: (pageId: string) => void;
  onOpenSearch?: () => void;
}

export function BlockPageView({ pageId, onNavigate, onOpenSearch }: BlockPageViewProps) {
  const { isMobile } = usePlatform();
  const { data: pageData, isLoading, error } = useVaultPage(pageId);
  const updatePage = useUpdateVaultPage();
  const toggleFavorite = useToggleVaultPageFavorite();
  const createPage = useCreateVaultPage();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Handler for creating new pages from [[Page Name]] links
  const handleCreatePage = useCallback(
    async (title: string) => {
      const newPage = await createPage.mutateAsync({ title });
      return newPage;
    },
    [createPage]
  );

  // Handler for clicking on page links
  const handlePageClick = useCallback(
    (linkedPageId: string) => {
      onNavigate(linkedPageId);
    },
    [onNavigate]
  );

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleTitleChange = useCallback(
    (title: string) => {
      updatePage.mutate({ id: pageId, input: { title } });
    },
    [pageId, updatePage]
  );

  const handleIconChange = useCallback(
    (icon: string) => {
      updatePage.mutate({ id: pageId, input: { icon: icon || null } });
    },
    [pageId, updatePage]
  );

  const handleCoverChange = useCallback(
    (coverImage: string | null) => {
      updatePage.mutate({ id: pageId, input: { coverImage } });
    },
    [pageId, updatePage]
  );

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite.mutate(pageId);
  }, [pageId, toggleFavorite]);

  const handleContentChange = useCallback(
    (_content: string) => {
      setHasUnsavedChanges(true);
    },
    []
  );

  const handleSave = useCallback(() => {
    // For now, just mark as saved
    // In a full implementation, we would parse the editor content
    // and convert it to blocks, then call batchBlocks.mutate()
    setHasUnsavedChanges(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-24 pt-8 pb-4 animate-pulse">
          <div className="flex items-center gap-1 mb-4">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
            <div className="h-4 w-4 bg-gray-200 rounded"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-12 h-12 bg-gray-200 rounded"></div>
            <div className="h-10 w-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="px-24 py-4 animate-pulse">
          <div className="max-w-[708px] mx-auto space-y-4">
            <div className="h-4 w-full bg-gray-200 rounded"></div>
            <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
            <div className="h-4 w-4/6 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h2>
          <p className="text-gray-500">The page you're looking for doesn't exist or was deleted.</p>
        </div>
      </div>
    );
  }

  const page = pageData;
  const blocks = page.blocks || [];
  const breadcrumbs = page.breadcrumbs || [];

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 h-full">
        <PageHeader
          page={page}
          breadcrumbs={breadcrumbs}
          onTitleChange={handleTitleChange}
          onIconChange={handleIconChange}
          onCoverChange={handleCoverChange}
          onToggleFavorite={handleToggleFavorite}
          onNavigate={onNavigate}
          onOpenSearch={onOpenSearch}
        />

        <div className="flex-1 overflow-hidden">
          <MobileBlockEditor
            pageId={pageId}
            initialContent={blocks}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onCreatePage={handleCreatePage}
            onPageClick={handlePageClick}
            placeholder="Tap to start writing..."
            autoFocus={blocks.length === 0}
          />
        </div>

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-20 right-4 bg-gray-900 dark:bg-gray-700 text-white px-3 py-1.5 rounded-full text-sm shadow-lg">
            Unsaved changes
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      <PageHeader
        page={page}
        breadcrumbs={breadcrumbs}
        onTitleChange={handleTitleChange}
        onIconChange={handleIconChange}
        onCoverChange={handleCoverChange}
        onToggleFavorite={handleToggleFavorite}
        onNavigate={onNavigate}
        onOpenSearch={onOpenSearch}
      />

      <div className="px-24 pb-24">
        <BlockEditor
          pageId={pageId}
          initialContent={blocks}
          onContentChange={handleContentChange}
          onSave={handleSave}
          onCreatePage={handleCreatePage}
          onPageClick={handlePageClick}
          placeholder="Type '/' for commands, '[[' for page links..."
          autoFocus={blocks.length === 0}
        />

        {/* Backlinks section */}
        <div className="max-w-[708px] mx-auto">
          <Backlinks pageId={pageId} onNavigate={onNavigate} />
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-700 text-white px-3 py-1.5 rounded-full text-sm shadow-lg">
          Unsaved changes
        </div>
      )}
    </div>
  );
}
