import { useCallback, useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { BlockEditor } from '../editor/BlockEditor';
import {
  useVaultPage,
  useUpdateVaultPage,
  useToggleVaultPageFavorite,
} from '../hooks/useVaultPages';

interface BlockPageViewProps {
  pageId: string;
  onNavigate: (pageId: string) => void;
}

export function BlockPageView({ pageId, onNavigate }: BlockPageViewProps) {
  const { data: pageData, isLoading, error } = useVaultPage(pageId);
  const updatePage = useUpdateVaultPage();
  const toggleFavorite = useToggleVaultPageFavorite();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <PageHeader
        page={page}
        breadcrumbs={breadcrumbs}
        onTitleChange={handleTitleChange}
        onIconChange={handleIconChange}
        onToggleFavorite={handleToggleFavorite}
        onNavigate={onNavigate}
      />

      <div className="px-24 pb-24">
        <BlockEditor
          pageId={pageId}
          initialContent={blocks}
          onContentChange={handleContentChange}
          onSave={handleSave}
          placeholder="Type '/' for commands..."
          autoFocus={blocks.length === 0}
        />
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-3 py-1.5 rounded-full text-sm shadow-lg">
          Unsaved changes
        </div>
      )}
    </div>
  );
}
