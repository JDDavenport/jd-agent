/**
 * Submission Panel
 *
 * Canvas Complete Phase 5: Direct assignment submission UI
 * - Text entry submission
 * - URL submission
 * - File upload submission
 * - Submission status display
 */

import { useState } from 'react';
import {
  useSubmissionStatus,
  useCanSubmit,
  useSubmitText,
  useSubmitUrl,
  type SubmissionStatus,
} from '../../hooks/useCanvasComplete';

interface SubmissionPanelProps {
  canvasItemId: string;
  onSubmitSuccess?: () => void;
}

export function SubmissionPanel({ canvasItemId, onSubmitSuccess }: SubmissionPanelProps) {
  const { data: status, isLoading: statusLoading } = useSubmissionStatus(canvasItemId);
  const { data: canSubmitInfo, isLoading: canSubmitLoading } = useCanSubmit(canvasItemId);

  const submitTextMutation = useSubmitText();
  const submitUrlMutation = useSubmitUrl();

  const [activeTab, setActiveTab] = useState<'status' | 'submit'>('status');
  const [submissionType, setSubmissionType] = useState<'text' | 'url' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [urlContent, setUrlContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isLoading = statusLoading || canSubmitLoading;

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-slate-400 text-sm">Loading submission info...</span>
        </div>
      </div>
    );
  }

  const handleSubmitText = async () => {
    if (!textContent.trim()) {
      setError('Please enter some text to submit');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await submitTextMutation.mutateAsync({
        canvasItemId,
        textBody: textContent,
      });
      setSuccessMessage('Assignment submitted successfully!');
      setTextContent('');
      onSubmitSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    }
  };

  const handleSubmitUrl = async () => {
    if (!urlContent.trim()) {
      setError('Please enter a URL to submit');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await submitUrlMutation.mutateAsync({
        canvasItemId,
        url: urlContent,
      });
      setSuccessMessage('URL submitted successfully!');
      setUrlContent('');
      onSubmitSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    }
  };

  const submissionAllowed = canSubmitInfo?.allowed ?? false;
  const availableTypes = canSubmitInfo?.submissionTypes ?? [];

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header with tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'status'
              ? 'bg-slate-700/50 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
          }`}
        >
          Submission Status
        </button>
        <button
          onClick={() => setActiveTab('submit')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'submit'
              ? 'bg-slate-700/50 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
          }`}
          disabled={!submissionAllowed}
        >
          Submit Assignment
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'status' ? (
          <SubmissionStatusView status={status} />
        ) : (
          <div className="space-y-4">
            {!submissionAllowed ? (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  {canSubmitInfo?.reason || 'Submission not available for this assignment'}
                </p>
              </div>
            ) : (
              <>
                {/* Submission type selector */}
                <div className="flex gap-2">
                  {availableTypes.includes('online_text_entry') && (
                    <button
                      onClick={() => setSubmissionType('text')}
                      className={`px-3 py-1.5 rounded text-sm ${
                        submissionType === 'text'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Text Entry
                    </button>
                  )}
                  {availableTypes.includes('online_url') && (
                    <button
                      onClick={() => setSubmissionType('url')}
                      className={`px-3 py-1.5 rounded text-sm ${
                        submissionType === 'url'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      URL
                    </button>
                  )}
                  {availableTypes.includes('online_upload') && (
                    <button
                      onClick={() => setSubmissionType('file')}
                      className={`px-3 py-1.5 rounded text-sm ${
                        submissionType === 'file'
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      File Upload
                    </button>
                  )}
                </div>

                {/* Submission form based on type */}
                {submissionType === 'text' && (
                  <div className="space-y-3">
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Enter your submission text..."
                      className="w-full h-48 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        {textContent.length} characters
                      </span>
                      <button
                        onClick={handleSubmitText}
                        disabled={submitTextMutation.isPending || !textContent.trim()}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {submitTextMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Submit
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {submissionType === 'url' && (
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={urlContent}
                      onChange={(e) => setUrlContent(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitUrl}
                        disabled={submitUrlMutation.isPending || !urlContent.trim()}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {submitUrlMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Submit URL
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {submissionType === 'file' && (
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                      <svg className="w-12 h-12 mx-auto text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-slate-400 mb-2">File upload coming soon</p>
                      <p className="text-xs text-slate-500">
                        {canSubmitInfo?.allowedExtensions?.length ? (
                          <>Allowed: {canSubmitInfo.allowedExtensions.join(', ')}</>
                        ) : (
                          'Any file type allowed'
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error/Success messages */}
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
                {successMessage && (
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                    <p className="text-green-400 text-sm">{successMessage}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionStatusView({ status }: { status: SubmissionStatus | null | undefined }) {
  if (!status) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-400">No submission information available</p>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (status.workflowState) {
      case 'graded':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            Graded
          </span>
        );
      case 'submitted':
        return (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            Submitted
          </span>
        );
      case 'pending_review':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            Pending Review
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded-full">
            Not Submitted
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status.hasSubmission ? (
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-10 h-10 bg-slate-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-white font-medium">
              {status.hasSubmission ? 'Submitted' : 'Not Submitted'}
            </p>
            {status.submittedAt && (
              <p className="text-xs text-slate-400">
                {new Date(status.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Submission details */}
      {status.hasSubmission && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Attempt</p>
            <p className="text-white font-medium">{status.attempt}</p>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-slate-400 text-xs mb-1">Type</p>
            <p className="text-white font-medium capitalize">
              {status.submissionType?.replace('_', ' ') || 'Unknown'}
            </p>
          </div>
          {status.score !== null && (
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Score</p>
              <p className="text-white font-medium">{status.score}</p>
            </div>
          )}
          {status.grade && (
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-400 text-xs mb-1">Grade</p>
              <p className="text-white font-medium">{status.grade}</p>
            </div>
          )}
        </div>
      )}

      {/* Late/Missing flags */}
      {(status.late || status.missing) && (
        <div className="flex gap-2">
          {status.late && (
            <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
              Late
            </span>
          )}
          {status.missing && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
              Missing
            </span>
          )}
        </div>
      )}

      {/* Comments */}
      {status.comments && status.comments.length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Comments</p>
          <div className="space-y-2">
            {status.comments.map((comment) => (
              <div key={comment.id} className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{comment.author_name}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{comment.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {status.attachments && status.attachments.length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Submitted Files</p>
          <div className="space-y-2">
            {status.attachments.map((file) => (
              <div key={file.id} className="flex items-center gap-2 bg-slate-700/30 rounded-lg p-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-white flex-1 truncate">{file.display_name}</span>
                <span className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SubmissionPanel;
