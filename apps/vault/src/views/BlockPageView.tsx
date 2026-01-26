import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import type { JSONContent } from '@tiptap/react';
import { PageHeader } from '../components/PageHeader';
import { Backlinks } from '../components/Backlinks';
import { BlockEditor } from '../editor/BlockEditor';
import { MobileBlockEditor } from '../editor/mobile';
import { ClassSessionView } from '../components/mba/ClassSessionView';
import { usePlatform } from '../hooks/usePlatform';
import { useBatchVaultBlocks } from '../hooks/useVaultBlocks';
import { buildReplaceOperations, tiptapJsonToBlocks } from '../editor/serializeBlocks';
import {
  useVaultPage,
  useUpdateVaultPage,
  useToggleVaultPageFavorite,
  useCreateVaultPage,
} from '../hooks/useVaultPages';
import { useMbaClassSession } from '../hooks/useMbaClasses';

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
  const batchBlocks = useBatchVaultBlocks(pageId);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check if this is an MBA session page (date page under MBA BYU hierarchy)
  const isMbaSession = useMemo(() => {
    if (!pageData?.breadcrumbs) return false;
    // Check if breadcrumbs include "MBA BYU" or similar MBA-related page
    const hasMbaBreadcrumb = pageData.breadcrumbs.some(
      (crumb) =>
        crumb.title.toLowerCase().includes('mba') ||
        crumb.title.toLowerCase().includes('byu')
    );
    // Also check if the page title looks like a date (YYYY-MM-DD)
    const isDatePage = /^\d{4}-\d{2}-\d{2}$/.test(pageData.title || '');
    return hasMbaBreadcrumb && isDatePage;
  }, [pageData?.breadcrumbs, pageData?.title]);

  // Fetch MBA session data (recordings) if this is an MBA session
  const { data: mbaSessionData, isLoading: isLoadingMbaSession } = useMbaClassSession(
    isMbaSession ? pageId : null
  );

  const latestDocRef = useRef<JSONContent | null>(null);
  const changeIdRef = useRef(0);
  const lastSavedChangeIdRef = useRef(0);
  const lastBlockIdsRef = useRef<string[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

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

  useEffect(() => {
    if (pageData?.blocks) {
      lastBlockIdsRef.current = pageData.blocks.map((block) => block.id);
    } else {
      lastBlockIdsRef.current = [];
    }
    changeIdRef.current = 0;
    lastSavedChangeIdRef.current = 0;
    latestDocRef.current = null;
    setHasUnsavedChanges(false);
    setSaveError(null);
  }, [pageId]);

  useEffect(() => {
    if (hasUnsavedChanges) return;
    if (pageData?.blocks) {
      lastBlockIdsRef.current = pageData.blocks.map((block) => block.id);
    }
  }, [pageData?.blocks, hasUnsavedChanges]);

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

  const persistBlocks = useCallback(
    async (force = false) => {
      if (!latestDocRef.current) return;
      if (isSavingRef.current) return;

      const saveId = changeIdRef.current;
      if (!force && saveId === lastSavedChangeIdRef.current) return;

      const blocks = tiptapJsonToBlocks(latestDocRef.current);
      const operations = buildReplaceOperations(lastBlockIdsRef.current, blocks);
      if (operations.length === 0) {
        lastSavedChangeIdRef.current = saveId;
        setHasUnsavedChanges(false);
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      setSaveError(null);

      try {
        const updatedBlocks = await batchBlocks.mutateAsync(operations);
        lastBlockIdsRef.current = updatedBlocks.map((block) => block.id);
        lastSavedChangeIdRef.current = saveId;
        if (saveId === changeIdRef.current) {
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error('Failed to save blocks:', err);
        setSaveError('Could not save changes. Check your connection.');
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
        if (saveId < changeIdRef.current) {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = setTimeout(() => {
            void persistBlocks();
          }, 1200);
        }
      }
    },
    [batchBlocks]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      void persistBlocks();
    }, 1200);
  }, [persistBlocks]);

  const handleContentChange = useCallback(
    (content: { html: string; json: JSONContent }) => {
      latestDocRef.current = content.json;
      changeIdRef.current += 1;
      setHasUnsavedChanges(true);
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    void persistBlocks(true);
  }, [persistBlocks]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
        {(hasUnsavedChanges || isSaving || saveError) && (
          <div className="fixed top-16 right-4 bg-gray-900 dark:bg-gray-700 text-white px-3 py-1.5 rounded-full text-sm shadow-lg">
            {saveError ? saveError : isSaving ? 'Saving…' : 'Unsaved changes'}
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
        {/* Regular page editor - shown when NOT an MBA session OR when MBA data is still loading */}
        {(!isMbaSession || isLoadingMbaSession || !mbaSessionData) && (
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
        )}

        {/* MBA Session Loading indicator */}
        {isMbaSession && isLoadingMbaSession && (
          <div className="max-w-[708px] mx-auto mt-8 mb-6">
            <div className="space-y-4 animate-pulse">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-200 dark:bg-indigo-700 rounded-xl"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-32 bg-indigo-200 dark:bg-indigo-700 rounded"></div>
                    <div className="h-4 w-full bg-indigo-100 dark:bg-indigo-800 rounded"></div>
                    <div className="h-4 w-3/4 bg-indigo-100 dark:bg-indigo-800 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced MBA Session View */}
        {isMbaSession && mbaSessionData && !isLoadingMbaSession && (
          <div className="max-w-[800px] mx-auto">
            <ClassSessionView
              data={mbaSessionData}
              onNavigate={onNavigate}
              blocks={blocks}
              onContentChange={handleContentChange}
              onSave={handleSave}
              onCreatePage={handleCreatePage}
              hasUnsavedChanges={hasUnsavedChanges}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* Backlinks section - show for all pages */}
        <div className="max-w-[708px] mx-auto mt-8">
          <Backlinks pageId={pageId} onNavigate={onNavigate} />
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {(hasUnsavedChanges || isSaving || saveError) && (
        <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-700 text-white px-3 py-1.5 rounded-full text-sm shadow-lg">
          {saveError ? saveError : isSaving ? 'Saving…' : 'Unsaved changes'}
        </div>
      )}
    </div>
  );
}
