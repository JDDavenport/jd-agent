/**
 * StudyMode - Focused review experience for MBA class sessions
 *
 * Features:
 * - Distraction-free interface
 * - Key points as flashcards
 * - Quick navigation between sessions
 * - Progress tracking
 */

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  LightBulbIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import type { MbaClassSessionResponse } from '../../lib/types';

interface StudyModeProps {
  sessionData: MbaClassSessionResponse;
  onClose: () => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onMarkReviewed: (sessionId: string) => void;
  isReviewed: boolean;
}

type StudyView = 'overview' | 'keypoints' | 'transcript';

export function StudyMode({
  sessionData,
  onClose,
  onNavigatePrev,
  onNavigateNext,
  onMarkReviewed,
  isReviewed,
}: StudyModeProps) {
  const [currentView, setCurrentView] = useState<StudyView>('overview');
  const [currentKeyPointIndex, setCurrentKeyPointIndex] = useState(0);
  const [revealedKeyPoints, setRevealedKeyPoints] = useState<Set<number>>(new Set());

  const { summary, stats, recordings, className, session } = sessionData;
  const keyPoints = summary?.keyPoints || [];
  const topics = summary?.topics || [];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (currentView === 'keypoints' && currentKeyPointIndex > 0) {
          setCurrentKeyPointIndex((prev) => prev - 1);
        } else if (onNavigatePrev) {
          onNavigatePrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (currentView === 'keypoints' && currentKeyPointIndex < keyPoints.length - 1) {
          setCurrentKeyPointIndex((prev) => prev + 1);
        } else if (onNavigateNext) {
          onNavigateNext();
        }
      } else if (e.key === ' ' && currentView === 'keypoints') {
        e.preventDefault();
        setRevealedKeyPoints((prev) => new Set([...prev, currentKeyPointIndex]));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, currentKeyPointIndex, keyPoints.length, onClose, onNavigatePrev, onNavigateNext]);

  // Reset revealed key points when changing sessions
  useEffect(() => {
    setRevealedKeyPoints(new Set());
    setCurrentKeyPointIndex(0);
    setCurrentView('overview');
  }, [session.id]);

  const handleRevealKeyPoint = () => {
    setRevealedKeyPoints((prev) => new Set([...prev, currentKeyPointIndex]));
  };

  const formattedDate = new Date(session.title).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">{className}</h1>
            <p className="text-sm text-gray-400">{formattedDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigatePrev}
              disabled={!onNavigatePrev}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onNavigateNext}
              disabled={!onNavigateNext}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Mark Reviewed */}
          <button
            onClick={() => onMarkReviewed(session.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isReviewed
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isReviewed ? (
              <CheckCircleSolidIcon className="w-5 h-5" />
            ) : (
              <CheckCircleIcon className="w-5 h-5" />
            )}
            {isReviewed ? 'Reviewed' : 'Mark as Reviewed'}
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex justify-center gap-2 px-6 py-3 border-b border-gray-800">
        {[
          { id: 'overview' as const, label: 'Overview', icon: BookOpenIcon },
          { id: 'keypoints' as const, label: 'Key Points', icon: LightBulbIcon, count: keyPoints.length },
          { id: 'transcript' as const, label: 'Transcript', icon: DocumentTextIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentView === tab.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview View */}
        {currentView === 'overview' && (
          <div className="max-w-3xl mx-auto p-8">
            {summary ? (
              <div className="space-y-8">
                {/* Overview Card */}
                <div className="bg-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Summary</h2>
                  <p className="text-gray-300 text-lg leading-relaxed">{summary.overview}</p>
                </div>

                {/* Topics */}
                {topics.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-white mb-3">Topics Covered</h3>
                    <div className="flex flex-wrap gap-2">
                      {topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-indigo-900/50 text-indigo-300 rounded-full text-sm"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-white">{stats.totalDurationMinutes}</p>
                    <p className="text-sm text-gray-400">Minutes</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-white">{stats.totalRecordings}</p>
                    <p className="text-sm text-gray-400">Recordings</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-white">{keyPoints.length}</p>
                    <p className="text-sm text-gray-400">Key Points</p>
                  </div>
                </div>

                {/* Start Studying CTA */}
                {keyPoints.length > 0 && (
                  <button
                    onClick={() => setCurrentView('keypoints')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <LightBulbIcon className="w-5 h-5" />
                    Review Key Points ({keyPoints.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <BookOpenIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No summary available for this session</p>
                <p className="text-gray-500 mt-2">
                  Summaries are generated from recording transcripts
                </p>
              </div>
            )}
          </div>
        )}

        {/* Key Points View - Flashcard Style */}
        {currentView === 'keypoints' && (
          <div className="flex flex-col items-center justify-center min-h-full p-8">
            {keyPoints.length > 0 ? (
              <div className="w-full max-w-2xl">
                {/* Progress */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-gray-400">
                    Point {currentKeyPointIndex + 1} of {keyPoints.length}
                  </span>
                  <div className="flex gap-1">
                    {keyPoints.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentKeyPointIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          idx === currentKeyPointIndex
                            ? 'bg-indigo-500'
                            : revealedKeyPoints.has(idx)
                            ? 'bg-green-500'
                            : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Flashcard */}
                <div
                  className={`bg-gray-800 rounded-2xl p-8 min-h-[300px] flex items-center justify-center cursor-pointer transition-all ${
                    revealedKeyPoints.has(currentKeyPointIndex)
                      ? 'border-2 border-green-500'
                      : 'border-2 border-gray-700 hover:border-indigo-500'
                  }`}
                  onClick={handleRevealKeyPoint}
                >
                  {revealedKeyPoints.has(currentKeyPointIndex) ? (
                    <p className="text-xl text-white text-center leading-relaxed">
                      {keyPoints[currentKeyPointIndex]}
                    </p>
                  ) : (
                    <div className="text-center">
                      <LightBulbIcon className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                      <p className="text-gray-400">Click or press Space to reveal</p>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={() => setCurrentKeyPointIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentKeyPointIndex === 0}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                    Previous
                  </button>

                  <button
                    onClick={() => {
                      setRevealedKeyPoints(new Set());
                      setCurrentKeyPointIndex(0);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    Reset
                  </button>

                  <button
                    onClick={() =>
                      setCurrentKeyPointIndex((prev) => Math.min(keyPoints.length - 1, prev + 1))
                    }
                    disabled={currentKeyPointIndex === keyPoints.length - 1}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Keyboard hint */}
                <p className="text-center text-sm text-gray-500 mt-8">
                  Use ← → arrows to navigate, Space to reveal
                </p>
              </div>
            ) : (
              <div className="text-center">
                <LightBulbIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No key points available</p>
              </div>
            )}
          </div>
        )}

        {/* Transcript View */}
        {currentView === 'transcript' && (
          <div className="max-w-3xl mx-auto p-8">
            {recordings.length > 0 ? (
              <div className="space-y-6">
                {recordings
                  .filter((r) => r.transcript)
                  .map((recording) => (
                    <div key={recording.id} className="bg-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-white mb-2">{recording.title}</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        {recording.recordedAt &&
                          new Date(recording.recordedAt).toLocaleTimeString()}
                        {recording.durationSeconds &&
                          ` • ${Math.floor(recording.durationSeconds / 60)}m ${recording.durationSeconds % 60}s`}
                      </p>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed">
                          {recording.transcript?.text}
                        </pre>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <DocumentTextIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No transcripts available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
