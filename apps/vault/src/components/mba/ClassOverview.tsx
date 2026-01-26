/**
 * ClassOverview - Dashboard view for a single MBA class
 *
 * Shows all sessions in a timeline with:
 * - Progress tracking (reviewed/not reviewed)
 * - Quick stats
 * - Session cards with summaries
 */

import { useState, useEffect } from 'react';
import {
  AcademicCapIcon,
  CalendarIcon,
  MicrophoneIcon,
  DocumentIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  BookOpenIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import type { MbaClass } from '../../lib/types';

interface ClassOverviewProps {
  classData: MbaClass;
  semesterTitle: string;
  onSelectSession: (sessionId: string) => void;
  onStartStudyMode: (sessionId: string) => void;
}

// Local storage key for tracking reviewed sessions
const REVIEWED_SESSIONS_KEY = 'mba-reviewed-sessions';

export function ClassOverview({
  classData,
  semesterTitle,
  onSelectSession,
  onStartStudyMode,
}: ClassOverviewProps) {
  const [reviewedSessions, setReviewedSessions] = useState<Set<string>>(new Set());

  // Load reviewed sessions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(REVIEWED_SESSIONS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setReviewedSessions(new Set(parsed));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Toggle reviewed status
  const toggleReviewed = (sessionId: string) => {
    setReviewedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      // Persist to localStorage
      localStorage.setItem(REVIEWED_SESSIONS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Calculate stats
  const totalSessions = classData.sessions.length;
  const reviewedCount = classData.sessions.filter((s) => reviewedSessions.has(s.id)).length;
  const sessionsWithNotes = classData.sessions.filter((s) => s.remarkableNotes.length > 0).length;
  const totalRecordings = classData.sessions.reduce((sum, s) => sum + s.recordings.length, 0);

  // Sort sessions by date (newest first)
  const sortedSessions = [...classData.sessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <AcademicCapIcon className="w-4 h-4" />
            <span>{semesterTitle}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {classData.icon && <span className="mr-2">{classData.icon}</span>}
            {classData.title}
          </h1>
        </div>

        {/* Progress Ring */}
        <div className="text-center">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${(reviewedCount / totalSessions) * 176} 176`}
                className="text-green-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {Math.round((reviewedCount / totalSessions) * 100)}%
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Reviewed</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-sm">Sessions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalSessions}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <MicrophoneIcon className="w-4 h-4" />
            <span className="text-sm">Recordings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalRecordings}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <DocumentIcon className="w-4 h-4" />
            <span className="text-sm">With Notes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{sessionsWithNotes}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-green-500 mb-1">
            <CheckCircleIcon className="w-4 h-4" />
            <span className="text-sm">Reviewed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {reviewedCount}/{totalSessions}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            const firstUnreviewed = sortedSessions.find((s) => !reviewedSessions.has(s.id));
            if (firstUnreviewed) onStartStudyMode(firstUnreviewed.id);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <BookOpenIcon className="w-5 h-5" />
          Start Studying
        </button>
        <button
          onClick={() => {
            // Mark all as reviewed
            const allIds = classData.sessions.map((s) => s.id);
            setReviewedSessions(new Set(allIds));
            localStorage.setItem(REVIEWED_SESSIONS_KEY, JSON.stringify(allIds));
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <CheckCircleIcon className="w-5 h-5" />
          Mark All Reviewed
        </button>
      </div>

      {/* Session Timeline */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Class Sessions</h2>

        {sortedSessions.map((session) => {
          const isReviewed = reviewedSessions.has(session.id);
          const hasRecordings = session.recordings.length > 0;
          const hasNotes = session.remarkableNotes.length > 0;

          return (
            <div
              key={session.id}
              className={`bg-white dark:bg-gray-800 rounded-lg border transition-all ${
                isReviewed
                  ? 'border-green-200 dark:border-green-800'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Reviewed Checkbox */}
                    <button
                      onClick={() => toggleReviewed(session.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isReviewed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                      }`}
                    >
                      {isReviewed && <CheckCircleSolidIcon className="w-4 h-4" />}
                    </button>

                    {/* Session Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(session.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </h3>
                        {isReviewed && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Reviewed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {hasRecordings && (
                          <span className="flex items-center gap-1">
                            <MicrophoneIcon className="w-3.5 h-3.5" />
                            {session.recordings.length} recording
                            {session.recordings.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {hasNotes && (
                          <span className="flex items-center gap-1">
                            <DocumentIcon className="w-3.5 h-3.5" />
                            Notes
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartStudyMode(session.id)}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                      title="Study this session"
                    >
                      <SparklesIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="View session details"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
