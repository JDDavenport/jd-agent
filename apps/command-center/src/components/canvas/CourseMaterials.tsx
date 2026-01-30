/**
 * Course Materials Component
 *
 * Canvas Complete Phase 2: Displays course materials organized by module
 * with reading progress tracking and file downloads.
 */

import { useState } from 'react';
import {
  useCourseMaterials,
  useUnreadCounts,
  useMarkAsStarted,
  useMarkAsCompleted,
  useUpdateReadingProgress,
  type CanvasMaterial,
  getMaterialIcon,
  getStatusLabel,
  formatFileSize,
} from '../../hooks/useCanvasMaterials';

interface CourseMaterialsProps {
  courseId: string;
  courseName?: string;
}

export function CourseMaterials({ courseId, courseName }: CourseMaterialsProps) {
  const { data: groupedMaterials, isLoading, error } = useCourseMaterials(courseId);
  const { data: unreadCounts } = useUnreadCounts();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Error loading materials: {(error as Error).message}
      </div>
    );
  }

  if (!groupedMaterials || Object.keys(groupedMaterials).length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg">No materials found</p>
        <p className="text-sm mt-2">Materials will appear here once synced from Canvas</p>
      </div>
    );
  }

  const unreadCount = unreadCounts?.[courseId] || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {courseName && (
            <h2 className="text-xl font-semibold text-gray-900">{courseName}</h2>
          )}
          <p className="text-sm text-gray-500">
            {Object.values(groupedMaterials).flat().length} materials
            {unreadCount > 0 && (
              <span className="ml-2 text-blue-600">({unreadCount} unread)</span>
            )}
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-2">
        {Object.entries(groupedMaterials).map(([moduleName, materials]) => (
          <ModuleSection
            key={moduleName}
            moduleName={moduleName}
            materials={materials}
            expanded={expandedModules.has(moduleName) || expandedModules.size === 0}
            onToggle={() => toggleModule(moduleName)}
          />
        ))}
      </div>
    </div>
  );
}

interface ModuleSectionProps {
  moduleName: string;
  materials: CanvasMaterial[];
  expanded: boolean;
  onToggle: () => void;
}

function ModuleSection({ moduleName, materials, expanded, onToggle }: ModuleSectionProps) {
  const unreadInModule = materials.filter((m) => m.readStatus === 'unread').length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Module Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
          <span className="font-medium text-gray-900">{moduleName}</span>
          <span className="text-sm text-gray-500">({materials.length} items)</span>
        </div>
        {unreadInModule > 0 && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
            {unreadInModule} unread
          </span>
        )}
      </button>

      {/* Materials List */}
      {expanded && (
        <div className="divide-y divide-gray-100">
          {materials.map((material) => (
            <MaterialItem key={material.id} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}

interface MaterialItemProps {
  material: CanvasMaterial;
}

function MaterialItem({ material }: MaterialItemProps) {
  const markAsStarted = useMarkAsStarted();
  const markAsCompleted = useMarkAsCompleted();
  const updateProgress = useUpdateReadingProgress();
  const [showProgress, setShowProgress] = useState(false);

  const handleOpen = () => {
    // Mark as started if unread
    if (material.readStatus === 'unread') {
      markAsStarted.mutate(material.id);
    }
    // Open the file
    if (material.localPath) {
      window.open(`/api/canvas-materials/${material.id}/view`, '_blank');
    } else if (material.canvasUrl) {
      window.open(material.canvasUrl, '_blank');
    }
  };

  const handleDownload = () => {
    window.open(`/api/canvas-materials/${material.id}/download`, '_blank');
  };

  const handleMarkComplete = () => {
    markAsCompleted.mutate(material.id);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseInt(e.target.value, 10);
    updateProgress.mutate({
      id: material.id,
      progress: {
        readStatus: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'unread',
        readProgress: progress,
      },
    });
  };

  const statusColors = {
    unread: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon and Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl">{getMaterialIcon(material.fileType)}</span>
          <div className="flex-1 min-w-0">
            <button
              onClick={handleOpen}
              className="text-left hover:text-blue-600 transition-colors"
            >
              <h4 className="font-medium text-gray-900 truncate">
                {material.displayName || material.fileName}
              </h4>
            </button>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span className="uppercase">{material.fileType}</span>
              {material.fileSizeBytes && (
                <>
                  <span>•</span>
                  <span>{formatFileSize(material.fileSizeBytes)}</span>
                </>
              )}
              {material.pageCount && (
                <>
                  <span>•</span>
                  <span>{material.pageCount} pages</span>
                </>
              )}
              {material.materialType && (
                <>
                  <span>•</span>
                  <span className="capitalize">{material.materialType}</span>
                </>
              )}
            </div>
            {material.aiSummary && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {material.aiSummary}
              </p>
            )}
          </div>
        </div>

        {/* Right: Status and Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              statusColors[material.readStatus]
            }`}
          >
            {getStatusLabel(material.readStatus)}
          </span>

          {/* Progress Toggle */}
          <button
            onClick={() => setShowProgress(!showProgress)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            title="Track progress"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </button>

          {/* Download Button */}
          {material.localPath && (
            <button
              onClick={handleDownload}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              title="Download"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          )}

          {/* Mark Complete Button */}
          {material.readStatus !== 'completed' && (
            <button
              onClick={handleMarkComplete}
              className="p-1.5 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-50"
              title="Mark as completed"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Slider */}
      {showProgress && (
        <div className="mt-3 pl-11">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={material.readProgress}
              onChange={handleProgressChange}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 w-12 text-right">
              {material.readProgress}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact material list for assignment detail modals
 */
interface AssignmentMaterialsListProps {
  canvasItemId: string;
}

export function AssignmentMaterialsList({ canvasItemId }: AssignmentMaterialsListProps) {
  const { data: materials, isLoading } = useCourseMaterials(canvasItemId);

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-100 rounded" />;
  }

  if (!materials || Object.values(materials).flat().length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No materials attached</p>
    );
  }

  const allMaterials = Object.values(materials).flat();

  return (
    <div className="space-y-2">
      {allMaterials.map((material) => (
        <a
          key={material.id}
          href={`/api/canvas-materials/${material.id}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors"
        >
          <span>{getMaterialIcon(material.fileType)}</span>
          <span className="text-sm text-gray-700 truncate">
            {material.displayName || material.fileName}
          </span>
          {material.readStatus === 'completed' && (
            <span className="text-green-500 text-xs">✓</span>
          )}
        </a>
      ))}
    </div>
  );
}

export default CourseMaterials;
