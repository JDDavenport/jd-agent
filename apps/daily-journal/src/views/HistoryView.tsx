import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { api } from '../api';
import type { ReviewMood, ReviewHistoryItem, ReviewHistoryResponse } from '@jd-agent/types';
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  FunnelIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const MOOD_EMOJI: Record<ReviewMood, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  difficult: '😔',
  terrible: '😢',
};

const MOOD_LABELS: Record<ReviewMood, string> = {
  great: 'Great',
  good: 'Good',
  okay: 'Okay',
  difficult: 'Difficult',
  terrible: 'Terrible',
};

interface Props {
  onStartReview: (date?: string) => void;
}

export function HistoryView({ onStartReview }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<ReviewHistoryItem | null>(null);
  const [moodFilter, setMoodFilter] = useState<ReviewMood | 'all'>('all');
  const limit = 10;

  // Fetch history or search results
  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', searchQuery, page, limit],
    queryFn: async (): Promise<ReviewHistoryResponse | ReviewHistoryItem[]> => {
      if (searchQuery.trim()) {
        return api.searchDailyReviews(searchQuery.trim());
      }
      return api.getDailyReviewHistory(page, limit);
    },
  });

  // Handle both response types
  const reviews: ReviewHistoryItem[] = Array.isArray(data) ? data : (data?.reviews || []);
  const totalPages = Array.isArray(data) ? 1 : Math.ceil((data?.total || 0) / limit) || 1;

  // Filter by mood if selected
  const filteredReviews = moodFilter === 'all'
    ? reviews
    : reviews.filter((r) => r.mood === moodFilter);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  if (selectedReview) {
    return (
      <ReviewDetail
        review={selectedReview}
        onBack={() => setSelectedReview(null)}
        onStartReview={onStartReview}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Review History</h1>
              <p className="text-sm text-gray-500">Browse your past daily reviews</p>
            </div>
            <button
              onClick={() => onStartReview()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              New Review
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search and filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search journal entries..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Mood filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Filter by mood:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setMoodFilter('all')}
                className={clsx(
                  'px-3 py-1 text-sm rounded-full transition-colors',
                  moodFilter === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                All
              </button>
              {(Object.keys(MOOD_EMOJI) as ReviewMood[]).map((mood) => (
                <button
                  key={mood}
                  onClick={() => setMoodFilter(mood)}
                  className={clsx(
                    'px-3 py-1 text-sm rounded-full transition-colors',
                    moodFilter === mood
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {MOOD_EMOJI[mood]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            Loading reviews...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Failed to load reviews. Please try again.
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p>No reviews found.</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-blue-500 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onClick={() => setSelectedReview(review)}
                />
              ))}
            </div>

            {/* Pagination */}
            {!searchQuery && totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  onClick,
}: {
  review: ReviewHistoryItem;
  onClick: () => void;
}) {
  const date = parseISO(review.date);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex flex-col items-center justify-center">
            <span className="text-xs text-blue-600 font-medium">
              {format(date, 'MMM')}
            </span>
            <span className="text-lg font-bold text-blue-700">
              {format(date, 'd')}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </p>
              {review.mood && (
                <span title={MOOD_LABELS[review.mood]}>
                  {MOOD_EMOJI[review.mood]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {review.reviewCompleted ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircleIcon className="w-4 h-4" />
                  Completed
                </span>
              ) : (
                <span className="flex items-center gap-1 text-orange-500">
                  <XCircleIcon className="w-4 h-4" />
                  Draft
                </span>
              )}
              {review.wordCount !== undefined && review.wordCount > 0 && (
                <span>{review.wordCount} words</span>
              )}
              {review.tasksCompleted !== undefined && review.tasksCompleted > 0 && (
                <span>{review.tasksCompleted} tasks</span>
              )}
              {review.habitsCompletionRate !== undefined && (
                <span>{Math.round(review.habitsCompletionRate * 100)}% habits</span>
              )}
            </div>
          </div>
        </div>
        <CalendarIcon className="w-5 h-5 text-gray-400" />
      </div>

      {/* Journal preview */}
      {review.journalPreview && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">
          {review.journalPreview}
        </p>
      )}
    </button>
  );
}

function ReviewDetail({
  review,
  onBack,
  onStartReview,
}: {
  review: ReviewHistoryItem;
  onBack: () => void;
  onStartReview: (date?: string) => void;
}) {
  const date = parseISO(review.date);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {format(date, 'EEEE, MMMM d, yyyy')}
                </h1>
                <p className="text-sm text-gray-500">
                  {review.reviewCompleted ? 'Completed review' : 'Draft'}
                </p>
              </div>
            </div>
            {!review.reviewCompleted && (
              <button
                onClick={() => onStartReview(review.date)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Continue Review
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            {review.mood ? (
              <>
                <p className="text-3xl">{MOOD_EMOJI[review.mood]}</p>
                <p className="text-sm text-gray-500 mt-1">{MOOD_LABELS[review.mood]}</p>
              </>
            ) : (
              <>
                <p className="text-3xl text-gray-300">—</p>
                <p className="text-sm text-gray-500 mt-1">No mood</p>
              </>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {review.habitsCompletionRate !== undefined
                ? `${Math.round(review.habitsCompletionRate * 100)}%`
                : '—'}
            </p>
            <p className="text-sm text-gray-500 mt-1">Habits</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {review.tasksCompleted ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Tasks</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {review.wordCount ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Words</p>
          </div>
        </div>

        {/* Journal preview */}
        {review.journalPreview && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Journal Preview</h3>
            <p className="text-gray-600">{review.journalPreview}</p>
          </div>
        )}

        {/* Vault link */}
        {review.vaultUrl && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-sm text-blue-700">
              This review is saved in your vault.{' '}
              <a
                href={review.vaultUrl}
                className="font-medium underline hover:text-blue-800"
              >
                View in Vault
              </a>
            </p>
          </div>
        )}

        {/* Action to view/continue */}
        <div className="flex justify-center">
          <button
            onClick={() => onStartReview(review.date)}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {review.reviewCompleted ? 'View Full Review' : 'Continue Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
