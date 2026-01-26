/**
 * ClassSessionView - Enhanced MBA class session page
 *
 * Features:
 * - Summary card with key takeaways
 * - PDF viewer for handwritten notes
 * - Recording transcripts with timestamps
 * - Confidence indicator for data matching
 * - My Notes tab for personal note-taking
 */

import { useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import {
  MicrophoneIcon,
  DocumentTextIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
  AcademicCapIcon,
  ClockIcon,
  SparklesIcon,
  BookOpenIcon,
  InformationCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { StudyMode } from './StudyMode';
import { BlockEditor } from '../../editor/BlockEditor';
import { useReviewedSessions } from '../../hooks/useMbaClasses';
import type { MbaClassSessionResponse, VaultBlock, VaultPage } from '../../lib/types';

interface ClassSessionViewProps {
  data: MbaClassSessionResponse;
  onNavigate?: (pageId: string) => void;
  // Block editing props for My Notes
  blocks?: VaultBlock[];
  onContentChange?: (content: { html: string; json: JSONContent }) => void;
  onSave?: () => void;
  onCreatePage?: (title: string) => Promise<VaultPage>;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
}

type TabType = 'recording' | 'notes' | 'my-notes';

export function ClassSessionView({
  data,
  onNavigate,
  blocks,
  onContentChange,
  onSave,
  onCreatePage,
  hasUnsavedChanges,
  isSaving,
}: ClassSessionViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('recording');
  const [expandedRecording, setExpandedRecording] = useState<string | null>(null);
  const [expandedVerification, setExpandedVerification] = useState<string | null>(null);
  const [verificationModalRecording, setVerificationModalRecording] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [showStudyMode, setShowStudyMode] = useState(false);

  const { toggleReviewed, isReviewed } = useReviewedSessions();

  const { summary, pdfUrl, pdfFilename, ocrText, confidence, stats, recordings, breadcrumbs, session } = data;
  const sessionIsReviewed = isReviewed(session.id);

  // Confidence display helper
  const getConfidenceDisplay = (score: number) => {
    if (score >= 85) {
      return {
        label: 'High Confidence',
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        icon: CheckCircleSolidIcon,
      };
    }
    if (score >= 70) {
      return {
        label: 'Good Confidence',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        icon: CheckCircleIcon,
      };
    }
    return {
      label: 'Needs Review',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
      icon: ExclamationTriangleIcon,
    };
  };

  const confidenceDisplay = getConfidenceDisplay(confidence);
  const ConfidenceIcon = confidenceDisplay.icon;

  return (
    <div className="space-y-6">
      {/* Header with breadcrumbs and confidence */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {idx > 0 && <span className="mx-1">/</span>}
              <button
                onClick={() => onNavigate?.(crumb.id)}
                className="hover:text-gray-900 dark:hover:text-gray-100 hover:underline"
              >
                {crumb.title}
              </button>
            </span>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Reviewed Toggle */}
          <button
            onClick={() => toggleReviewed(session.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              sessionIsReviewed
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {sessionIsReviewed ? (
              <CheckCircleSolidIcon className="w-4 h-4" />
            ) : (
              <CheckCircleIcon className="w-4 h-4" />
            )}
            {sessionIsReviewed ? 'Reviewed' : 'Mark Reviewed'}
          </button>

          {/* Study Mode Button */}
          <button
            onClick={() => setShowStudyMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-medium transition-colors"
          >
            <BookOpenIcon className="w-4 h-4" />
            Study
          </button>

          {/* Confidence Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${confidenceDisplay.bgColor} ${confidenceDisplay.borderColor} border`}
            title={`${confidence}% confidence that recordings and notes match this class`}
          >
            <ConfidenceIcon className={`w-4 h-4 ${confidenceDisplay.color}`} />
            <span className={confidenceDisplay.color}>{confidenceDisplay.label}</span>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {summary && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-800 rounded-xl">
              <SparklesIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Class Summary
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">{summary.overview}</p>

              {summary.keyPoints.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Key Takeaways
                  </h3>
                  <ul className="space-y-1.5">
                    {summary.keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircleSolidIcon className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.topics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {summary.topics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white dark:bg-gray-800 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-700 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              {stats.totalDurationMinutes} min
            </span>
            <span className="flex items-center gap-1.5">
              <MicrophoneIcon className="w-4 h-4" />
              {stats.totalRecordings} recordings
            </span>
            {stats.hasPdf && (
              <span className="flex items-center gap-1.5">
                <DocumentIcon className="w-4 h-4" />
                PDF notes
              </span>
            )}
          </div>
        </div>
      )}

      {/* No Summary Fallback */}
      {!summary && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
          <AcademicCapIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            No summary available yet. Summaries are generated when recordings have transcripts.
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6" data-testid="session-tabs">
          {[
            { id: 'recording' as TabType, label: 'Recordings', icon: MicrophoneIcon, count: stats.totalRecordings, testId: 'recordings-tab' },
            { id: 'notes' as TabType, label: 'Handwritten Notes', icon: DocumentTextIcon, show: stats.hasPdf || stats.hasOcrText, testId: 'notes-tab' },
            { id: 'my-notes' as TabType, label: 'My Notes', icon: PencilSquareIcon, testId: 'my-notes-tab', badge: hasUnsavedChanges ? '•' : undefined },
          ]
            .filter((tab) => tab.show !== false)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={tab.testId}
                className={`flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-amber-500 text-lg leading-none">{tab.badge}</span>
                )}
              </button>
            ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Recordings Tab */}
        {activeTab === 'recording' && (
          <div className="space-y-4" data-testid="recordings-list">
            {recordings.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400" data-testid="no-recordings">
                <MicrophoneIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recordings found for this session</p>
              </div>
            ) : (
              recordings.map((recording) => {
                const recConfidence = getConfidenceDisplay(recording.confidence);
                const RecConfIcon = recConfidence.icon;
                const isExpanded = expandedRecording === recording.id;

                return (
                  <div
                    key={recording.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Recording Header */}
                    <div className="p-4 bg-white dark:bg-gray-800">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                          <PlayIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {recording.title}
                            </h4>
                            <RecConfIcon className={`w-4 h-4 ${recConfidence.color}`} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {recording.recordedAt && (
                              <span>{new Date(recording.recordedAt).toLocaleTimeString()}</span>
                            )}
                            {recording.durationSeconds && (
                              <span>
                                {/* Show effective duration if partial recording */}
                                {recording.effectiveDurationSeconds && recording.effectiveDurationSeconds !== recording.durationSeconds ? (
                                  <>
                                    {Math.floor(recording.effectiveDurationSeconds / 60)}m{' '}
                                    {recording.effectiveDurationSeconds % 60}s
                                    <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                                      (of {Math.floor(recording.durationSeconds / 60)}m total)
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {Math.floor(recording.durationSeconds / 60)}m{' '}
                                    {recording.durationSeconds % 60}s
                                  </>
                                )}
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs ${
                                recording.status === 'complete'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {recording.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-3 flex items-center gap-3">
                        {/* Transcript Toggle */}
                        {recording.transcript && (
                          <button
                            onClick={() => setExpandedRecording(isExpanded ? null : recording.id)}
                            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <DocumentTextIcon className="w-4 h-4" />
                            {isExpanded ? 'Hide Transcript' : 'View Transcript'}
                          </button>
                        )}

                        {/* Verification Toggle */}
                        {recording.verification && (
                          <button
                            onClick={() => setExpandedVerification(expandedVerification === recording.id ? null : recording.id)}
                            className={`flex items-center gap-1.5 text-sm ${
                              recording.verification.isBestMatch && recording.verification.timeMatch !== 'warning'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                            } hover:underline`}
                          >
                            <InformationCircleIcon className="w-4 h-4" />
                            Verify Match
                            {expandedVerification === recording.id ? (
                              <ChevronUpIcon className="w-3 h-3" />
                            ) : (
                              <ChevronDownIcon className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Verification Panel */}
                    {expandedVerification === recording.id && recording.verification && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-amber-50 dark:bg-amber-900/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Confidence Reason */}
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                              <span className="font-medium">Match reason:</span>{' '}
                              {recording.verification.confidenceReason}
                            </p>

                            {/* Keywords Found */}
                            {recording.verification.keywordsFound.length > 0 && (
                              <div className="mb-3">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Keywords found:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {recording.verification.keywordsFound.map((kw, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-xs"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Time Match */}
                            <div className="flex items-center gap-2 mb-3">
                              <ClockIcon className={`w-4 h-4 ${
                                recording.verification.calendarMatch
                                  ? 'text-green-500'
                                  : recording.verification.timeMatch === 'warning'
                                  ? 'text-amber-500'
                                  : 'text-gray-400'
                              }`} />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Recorded at {recording.verification.recordingTime || 'unknown'}
                                {recording.verification.calendarMatch && recording.verification.overlapMinutes && (
                                  <span className="text-green-600 dark:text-green-400 ml-1">
                                    ({recording.verification.overlapMinutes} min overlap with class)
                                  </span>
                                )}
                                {!recording.verification.calendarMatch && recording.verification.timeMatch === 'warning' && (
                                  <span className="text-amber-600 dark:text-amber-400 ml-1">(no calendar match)</span>
                                )}
                              </span>
                            </div>

                            {/* Segment Note (for partial recordings) */}
                            {recording.verification.segmentNote && (
                              <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-sm">
                                <InformationCircleIcon className="w-4 h-4 text-blue-500" />
                                <span className="text-blue-700 dark:text-blue-300">
                                  {recording.verification.segmentNote}
                                </span>
                              </div>
                            )}

                            {/* Best Match Warning */}
                            {!recording.verification.isBestMatch && recording.verification.bestMatchClass && (
                              <div className="flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/40 rounded text-sm text-amber-700 dark:text-amber-300">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                Better match: "{recording.verification.bestMatchClass}" class
                              </div>
                            )}
                          </div>

                          {/* View Details Button */}
                          <button
                            onClick={() => setVerificationModalRecording(recording.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          >
                            <MagnifyingGlassIcon className="w-4 h-4" />
                            Details
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded Transcript */}
                    {isExpanded && recording.transcript && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
                          {recording.transcript.text.slice(0, 5000)}
                          {recording.transcript.text.length > 5000 && '\n\n... (transcript truncated)'}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            {/* PDF Section */}
            {pdfUrl && (
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-900/30 px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
                  <h3 className="font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    <DocumentIcon className="w-5 h-5" />
                    {pdfFilename || 'Handwritten Notes'}
                  </h3>
                  <a
                    href={pdfUrl}
                    download={pdfFilename}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded-md text-sm hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Download PDF
                  </a>
                </div>

                {/* PDF Viewer */}
                <div className="bg-gray-100 dark:bg-gray-900">
                  <iframe
                    src={`${pdfUrl}#page=${pdfPage}`}
                    className="w-full h-[600px]"
                    title={pdfFilename || 'PDF Document'}
                  />
                </div>

                {/* PDF Controls */}
                <div className="bg-amber-50 dark:bg-amber-900/30 px-4 py-2 border-t border-amber-200 dark:border-amber-800 flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                    disabled={pdfPage <= 1}
                    className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-800 rounded disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Page {pdfPage}</span>
                  <button
                    onClick={() => setPdfPage((p) => p + 1)}
                    className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-800 rounded"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* OCR Text Section */}
            {ocrText && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5" />
                    Searchable Text (OCR)
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Extracted text from handwritten notes for searching
                  </p>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                    {ocrText}
                  </pre>
                </div>
              </div>
            )}

            {/* No Notes */}
            {!pdfUrl && !ocrText && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No handwritten notes found for this session</p>
              </div>
            )}
          </div>
        )}

        {/* My Notes Tab */}
        {activeTab === 'my-notes' && (
          <div className="space-y-4" data-testid="my-notes-content">
            {/* Header with save status */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  My Notes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add your own notes, thoughts, and key takeaways from this class session.
                </p>
              </div>
              {(hasUnsavedChanges || isSaving) && (
                <div className="flex items-center gap-2 text-sm">
                  {isSaving ? (
                    <span className="text-blue-600 dark:text-blue-400">Saving...</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                  )}
                </div>
              )}
            </div>

            {/* Block Editor */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 min-h-[400px]">
              <BlockEditor
                pageId={session.id}
                initialContent={blocks}
                onContentChange={onContentChange}
                onSave={onSave}
                onCreatePage={onCreatePage}
                onPageClick={onNavigate}
                placeholder="Start typing your notes... Use '/' for commands, '[[' for page links..."
                autoFocus={false}
              />
            </div>

            {/* Tips */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
              <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-2 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                Tips for effective note-taking
              </h4>
              <ul className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1">
                <li>• Use <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">/</code> to access formatting commands</li>
                <li>• Create to-do items with <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">/todo</code></li>
                <li>• Link to other pages with <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">[[Page Name]]</code></li>
                <li>• Your notes auto-save as you type</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Verification Detail Modal */}
      {verificationModalRecording && (() => {
        const recording = recordings.find(r => r.id === verificationModalRecording);
        if (!recording?.verification) return null;
        const v = recording.verification;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setVerificationModalRecording(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Match Verification Details
                </h3>
                <button
                  onClick={() => setVerificationModalRecording(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-6">
                {/* Recording Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Recording</h4>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">{recording.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {recording.recordedAt && new Date(recording.recordedAt).toLocaleString()}
                    {recording.durationSeconds && ` • ${Math.floor(recording.durationSeconds / 60)}m ${recording.durationSeconds % 60}s`}
                  </p>
                </div>

                {/* Confidence Score */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Confidence Score</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          recording.confidence >= 85 ? 'bg-green-500' :
                          recording.confidence >= 70 ? 'bg-blue-500' :
                          recording.confidence >= 55 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${recording.confidence}%` }}
                      />
                    </div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{recording.confidence}%</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{v.confidenceReason}</p>
                </div>

                {/* Calendar Match */}
                {data.calendarEvent && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Class Schedule (Calendar)</h4>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="font-medium text-blue-700 dark:text-blue-300">{data.calendarEvent.title}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {new Date(data.calendarEvent.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {new Date(data.calendarEvent.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {data.calendarEvent.location && ` • ${data.calendarEvent.location}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Time Analysis */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Recording Time</h4>
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    v.calendarMatch ? 'bg-green-50 dark:bg-green-900/20' :
                    v.timeMatch === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' :
                    'bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <ClockIcon className={`w-5 h-5 ${
                      v.calendarMatch ? 'text-green-500' :
                      v.timeMatch === 'warning' ? 'text-amber-500' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className={`font-medium ${
                        v.calendarMatch ? 'text-green-700 dark:text-green-300' :
                        v.timeMatch === 'warning' ? 'text-amber-700 dark:text-amber-300' :
                        'text-gray-700 dark:text-gray-300'
                      }`}>
                        {v.recordingTime || 'Unknown time'}
                        {v.calendarMatch && v.overlapMinutes && ` (${v.overlapMinutes} min overlap)`}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {v.calendarMatch && 'Matches class schedule from calendar'}
                        {!v.calendarMatch && v.timeMatch === 'good' && 'Within typical class hours but no calendar match'}
                        {!v.calendarMatch && v.timeMatch === 'warning' && 'Outside class hours - may need verification'}
                        {v.timeMatch === 'unknown' && 'Time not available'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Segment Info (for partial recordings) */}
                {v.segmentNote && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Recording Segment</h4>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-blue-700 dark:text-blue-300">{v.segmentNote}</p>
                          {v.totalSegments !== undefined && v.relevantSegments !== undefined && (
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              {v.relevantSegments} of {v.totalSegments} transcript segments within class time
                            </p>
                          )}
                          {recording.transcript?.isFiltered && (
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              Transcript text has been filtered to show only content during class time.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Keywords Found */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Keywords Found for Current Class
                  </h4>
                  {v.keywordsFound.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {v.keywordsFound.map((kw, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full text-sm font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">No class-specific keywords found in transcript</p>
                  )}
                </div>

                {/* All Class Scores */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Keyword Matches by Class Type
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(v.classScores)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([classKey, data]) => (
                        <div key={classKey} className={`flex items-center justify-between p-2 rounded ${
                          classKey === v.bestMatchClass
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              classKey === v.bestMatchClass
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {classKey.charAt(0).toUpperCase() + classKey.slice(1)}
                            </span>
                            {classKey === v.bestMatchClass && (
                              <span className="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-xs">
                                Best Match
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {data.count} keyword{data.count !== 1 ? 's' : ''}
                            </span>
                            {data.keywords.length > 0 && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                ({data.keywords.slice(0, 3).join(', ')}{data.keywords.length > 3 ? '...' : ''})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Best Match Warning */}
                {!v.isBestMatch && v.bestMatchClass && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-300">
                          This recording may belong to a different class
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                          The "{v.bestMatchClass}" class has more keyword matches in the transcript.
                          Consider reviewing the transcript to verify the correct assignment.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Study Mode Overlay */}
      {showStudyMode && (
        <StudyMode
          sessionData={data}
          onClose={() => setShowStudyMode(false)}
          onMarkReviewed={(id) => {
            toggleReviewed(id);
          }}
          isReviewed={sessionIsReviewed}
        />
      )}
    </div>
  );
}
