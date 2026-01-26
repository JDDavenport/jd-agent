/**
 * Assignment Detail Modal - Canvas Complete Phase 1
 *
 * Shows full Canvas assignment details including:
 * - Instructions (cleaned text)
 * - Rubric with criteria and points
 * - Submission requirements
 * - Time estimate
 * - Related materials (future)
 * - Subtasks checklist
 */

import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '../../types/task';
import { SubmissionPanel } from './SubmissionPanel';

interface AssignmentDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

interface RubricCriterion {
  id: string;
  criterion: string;
  description: string | null;
  points: number;
  ratings: Array<{ description: string; points: number }>;
}

interface CanvasAssignmentData {
  id: string;
  canvasId: string;
  title: string;
  courseName: string;
  url: string | null;
  dueAt: string | null;
  pointsPossible: number | null;
  gradingType: string | null;
  submissionTypes: string[] | null;
  allowedExtensions: string[] | null;
  instructions: string | null;
  instructionsHtml: string | null;
  rubric: RubricCriterion[] | null;
  totalRubricPoints: number | null;
  wordCountMin: number | null;
  wordCountMax: number | null;
  isGroupAssignment: boolean;
  hasPeerReview: boolean;
  estimatedMinutes: number | null;
  subtasks: Array<{
    id: string;
    title: string;
    subtaskType: string | null;
    isCompleted: boolean;
    sortOrder: number;
  }>;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  4: { label: 'Urgent', color: 'text-red-400 bg-red-500/20' },
  3: { label: 'High', color: 'text-orange-400 bg-orange-500/20' },
  2: { label: 'Medium', color: 'text-yellow-400 bg-yellow-500/20' },
  1: { label: 'Low', color: 'text-blue-400 bg-blue-500/20' },
  0: { label: 'None', color: 'text-slate-400 bg-slate-500/20' },
};

async function fetchCanvasAssignment(taskId: string): Promise<CanvasAssignmentData | null> {
  const response = await fetch(`/api/canvas-integrity/by-task/${taskId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch canvas assignment');
  }
  const result = await response.json();
  if (!result.success) return null;

  // Fetch full details
  const fullResponse = await fetch(`/api/canvas-integrity/assignments/${result.data.id}/full`);
  if (!fullResponse.ok) return null;
  const fullResult = await fullResponse.json();
  return fullResult.data;
}

async function toggleSubtask(subtaskId: string, isCompleted: boolean) {
  const response = await fetch(`/api/canvas-integrity/subtasks/${subtaskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCompleted }),
  });
  if (!response.ok) throw new Error('Failed to update subtask');
  return response.json();
}

export function AssignmentDetailModal({ task, isOpen, onClose }: AssignmentDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'details' | 'rubric' | 'checklist' | 'submit'>('details');

  // Fetch Canvas assignment data
  const { data: canvasData, isLoading } = useQuery({
    queryKey: ['canvas-assignment', task?.id],
    queryFn: () => fetchCanvasAssignment(task!.id),
    enabled: isOpen && !!task && task.source === 'canvas',
    staleTime: 30000,
  });

  // Subtask toggle mutation
  const subtaskMutation = useMutation({
    mutationFn: ({ subtaskId, isCompleted }: { subtaskId: string; isCompleted: boolean }) =>
      toggleSubtask(subtaskId, isCompleted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment', task?.id] });
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const priority = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[0];
  const isCompleted = !!task.completedAt;
  const isCanvasTask = task.source === 'canvas';

  // Format time estimate
  const formatTime = (minutes: number | null | undefined) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Format word count
  const formatWordCount = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max && min !== max) return `${min.toLocaleString()}-${max.toLocaleString()} words`;
    return `${(min || max)?.toLocaleString()} words`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-detail-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-700">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {isCanvasTask && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded">
                  Canvas
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>
                {priority.label}
              </span>
            </div>
            <h2
              id="assignment-detail-title"
              className={`text-lg font-semibold text-white ${isCompleted ? 'line-through opacity-60' : ''}`}
            >
              {task.title}
            </h2>
            {canvasData?.courseName && (
              <div className="mt-1 text-sm text-slate-400">
                {canvasData.courseName}
              </div>
            )}
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close assignment details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs - Only show for Canvas tasks */}
        {isCanvasTask && (
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Details
            </button>
            {canvasData?.rubric && canvasData.rubric.length > 0 && (
              <button
                onClick={() => setActiveTab('rubric')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'rubric'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rubric ({canvasData.rubric.length})
              </button>
            )}
            {canvasData?.subtasks && canvasData.subtasks.length > 0 && (
              <button
                onClick={() => setActiveTab('checklist')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'checklist'
                    ? 'text-purple-400 border-b-2 border-purple-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Checklist ({canvasData.subtasks.filter(s => s.isCompleted).length}/{canvasData.subtasks.length})
              </button>
            )}
            {canvasData && (
              <button
                onClick={() => setActiveTab('submit')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'submit'
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Submit
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-4">
          {isLoading && isCanvasTask ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : activeTab === 'details' ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {task.dueDate && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Due Date</div>
                    <div className="text-sm text-white font-medium">
                      {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                    </div>
                    {task.dueDateIsHard && (
                      <div className="text-xs text-red-400">Hard deadline</div>
                    )}
                  </div>
                )}

                {(canvasData?.estimatedMinutes || task.timeEstimateMinutes) && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Estimated Time</div>
                    <div className="text-sm text-white font-medium">
                      {formatTime(canvasData?.estimatedMinutes || task.timeEstimateMinutes)}
                    </div>
                  </div>
                )}

                {canvasData?.pointsPossible && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Points</div>
                    <div className="text-sm text-white font-medium">
                      {canvasData.pointsPossible}
                    </div>
                  </div>
                )}

                {formatWordCount(canvasData?.wordCountMin || null, canvasData?.wordCountMax || null) && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">Word Count</div>
                    <div className="text-sm text-white font-medium">
                      {formatWordCount(canvasData?.wordCountMin || null, canvasData?.wordCountMax || null)}
                    </div>
                  </div>
                )}
              </div>

              {/* Submission Info */}
              {canvasData && (canvasData.submissionTypes?.length || canvasData.isGroupAssignment || canvasData.hasPeerReview) && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Submission Requirements
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {canvasData.submissionTypes?.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                      >
                        {type.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {canvasData.allowedExtensions?.map((ext) => (
                      <span
                        key={ext}
                        className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs"
                      >
                        {ext}
                      </span>
                    ))}
                    {canvasData.isGroupAssignment && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        Group Assignment
                      </span>
                    )}
                    {canvasData.hasPeerReview && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        Peer Review
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {(canvasData?.instructions || task.description) && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Instructions
                  </h3>
                  <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {canvasData?.instructions || task.description}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {canvasData && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Quick Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Open Assignment Page in Vault */}
                    <button
                      onClick={() => {
                        // Navigate to vault page - for now just log
                        console.log('Open assignment page for:', canvasData.id);
                        window.open(`/vault?assignment=${canvasData.id}`, '_blank');
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Open Assignment Page
                    </button>

                    {/* View Materials */}
                    <button
                      onClick={() => {
                        console.log('View materials for:', canvasData.id);
                        window.open(`/vault/materials?course=${canvasData.id}`, '_blank');
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      View Materials
                    </button>

                    {/* Add Note */}
                    <button
                      onClick={() => {
                        console.log('Add note for:', canvasData.id);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Add Note
                    </button>

                    {/* Open in Canvas */}
                    {canvasData.url && (
                      <a
                        href={canvasData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open in Canvas
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'rubric' && canvasData?.rubric ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">
                  Rubric ({canvasData.totalRubricPoints} total points)
                </h3>
              </div>
              {canvasData.rubric.map((criterion) => (
                <div
                  key={criterion.id}
                  className="bg-slate-800 rounded-lg p-3 border border-slate-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-white">{criterion.criterion}</h4>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded">
                      {criterion.points} pts
                    </span>
                  </div>
                  {criterion.description && (
                    <p className="text-sm text-slate-400 mb-2">{criterion.description}</p>
                  )}
                  {criterion.ratings.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {criterion.ratings.map((rating, idx) => (
                        <div
                          key={idx}
                          className="text-xs px-2 py-1 bg-slate-700 rounded"
                        >
                          <span className="text-slate-400">{rating.description}:</span>{' '}
                          <span className="text-white">{rating.points}pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : activeTab === 'checklist' && canvasData?.subtasks ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">
                  Assignment Checklist
                </h3>
                <span className="text-xs text-slate-400">
                  {canvasData.subtasks.filter(s => s.isCompleted).length} of {canvasData.subtasks.length} complete
                </span>
              </div>
              {canvasData.subtasks
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((subtask) => (
                  <label
                    key={subtask.id}
                    className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.isCompleted}
                      onChange={(e) =>
                        subtaskMutation.mutate({
                          subtaskId: subtask.id,
                          isCompleted: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900"
                    />
                    <div className="flex-1">
                      <span
                        className={`text-sm ${
                          subtask.isCompleted ? 'text-slate-500 line-through' : 'text-white'
                        }`}
                      >
                        {subtask.title}
                      </span>
                      {subtask.subtaskType && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({subtask.subtaskType})
                        </span>
                      )}
                    </div>
                  </label>
                ))}
            </div>
          ) : activeTab === 'submit' && canvasData ? (
            <SubmissionPanel
              canvasItemId={canvasData.id}
              onSubmitSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['canvas-assignment', task?.id] });
              }}
            />
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Press <kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs">Esc</kbd> to close
          </p>
          {canvasData?.url && (
            <a
              href={canvasData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Open in Canvas
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssignmentDetailModal;
