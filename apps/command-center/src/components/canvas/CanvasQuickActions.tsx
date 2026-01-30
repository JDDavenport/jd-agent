/**
 * Canvas Quick Actions Component
 *
 * Canvas Complete Phase 3: Quick actions for Canvas tasks
 * - Open assignment Vault page
 * - View related materials
 * - Add notes
 * - Open in Canvas
 */

import { useState } from 'react';
import {
  useCanvasAssignmentByTask,
  useGetOrCreateAssignmentPage,
  useAssignmentPageByTask,
} from '../../hooks/useCanvasComplete';
import { useAssignmentMaterials } from '../../hooks/useCanvasMaterials';

interface CanvasQuickActionsProps {
  taskId: string;
  onOpenVaultPage?: (pageId: string) => void;
  onOpenMaterials?: (canvasItemId: string) => void;
  compact?: boolean;
}

export function CanvasQuickActions({
  taskId,
  onOpenVaultPage,
  onOpenMaterials,
  compact = false,
}: CanvasQuickActionsProps) {
  const { data: assignment, isLoading: loadingAssignment } = useCanvasAssignmentByTask(taskId);
  const { data: assignmentPage } = useAssignmentPageByTask(taskId);
  const { data: materials } = useAssignmentMaterials(assignment?.id || null, {
    enabled: !!assignment?.id,
  });
  const getOrCreatePage = useGetOrCreateAssignmentPage();
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  if (loadingAssignment || !assignment) {
    return null; // Not a Canvas task or still loading
  }

  const handleOpenVaultPage = async () => {
    if (assignmentPage?.vaultPageId) {
      onOpenVaultPage?.(assignmentPage.vaultPageId);
      return;
    }

    // Create the page if it doesn't exist
    setIsCreatingPage(true);
    try {
      const page = await getOrCreatePage.mutateAsync(assignment.id);
      if (page?.vaultPageId) {
        onOpenVaultPage?.(page.vaultPageId);
      }
    } catch (error) {
      console.error('Failed to create assignment page:', error);
    } finally {
      setIsCreatingPage(false);
    }
  };

  const handleOpenMaterials = () => {
    onOpenMaterials?.(assignment.id);
  };

  const handleOpenInCanvas = () => {
    if (assignment.url) {
      window.open(assignment.url, '_blank');
    }
  };

  const materialsCount = materials?.length || 0;
  const hasRubric = !!assignment.rubric;
  const hasInstructions = !!assignment.instructions;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {/* Vault Page Button */}
        <button
          onClick={handleOpenVaultPage}
          disabled={isCreatingPage}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          title={assignmentPage ? 'Open Assignment Page' : 'Create Assignment Page'}
        >
          {isCreatingPage ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </button>

        {/* Materials Button */}
        {materialsCount > 0 && (
          <button
            onClick={handleOpenMaterials}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors relative"
            title={`${materialsCount} Material${materialsCount > 1 ? 's' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {materialsCount}
            </span>
          </button>
        )}

        {/* Canvas Link */}
        {assignment.url && (
          <button
            onClick={handleOpenInCanvas}
            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
            title="Open in Canvas"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Full-size actions
  return (
    <div className="flex flex-wrap gap-2">
      {/* Open Assignment Page */}
      <button
        onClick={handleOpenVaultPage}
        disabled={isCreatingPage}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {isCreatingPage ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Creating...</span>
          </>
        ) : (
          <>
            <span>📄</span>
            <span>{assignmentPage ? 'Open Assignment Page' : 'Create Assignment Page'}</span>
          </>
        )}
      </button>

      {/* View Materials */}
      {materialsCount > 0 && (
        <button
          onClick={handleOpenMaterials}
          className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
        >
          <span>📚</span>
          <span>Materials ({materialsCount})</span>
        </button>
      )}

      {/* Info Badges */}
      <div className="flex items-center gap-2 ml-auto">
        {hasRubric && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
            Rubric
          </span>
        )}
        {hasInstructions && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
            Instructions
          </span>
        )}
      </div>

      {/* Open in Canvas */}
      {assignment.url && (
        <button
          onClick={handleOpenInCanvas}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <span>🔗</span>
          <span>Open in Canvas</span>
        </button>
      )}
    </div>
  );
}

/**
 * Inline quick action buttons for task list items
 */
interface InlineCanvasActionsProps {
  taskId: string;
  onOpenDetail?: () => void;
}

export function InlineCanvasActions({ taskId, onOpenDetail }: InlineCanvasActionsProps) {
  const { data: assignment } = useCanvasAssignmentByTask(taskId);
  const { data: materials } = useAssignmentMaterials(assignment?.id || null, {
    enabled: !!assignment?.id,
  });

  if (!assignment) return null;

  const hasDetails = !!assignment.instructions || !!assignment.rubric;
  const materialsCount = materials?.length || 0;

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {hasDetails && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail?.();
          }}
          className="p-1 text-blue-500 hover:bg-blue-50 rounded"
          title="View Details"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}
      {materialsCount > 0 && (
        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
          {materialsCount} file{materialsCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

export default CanvasQuickActions;
