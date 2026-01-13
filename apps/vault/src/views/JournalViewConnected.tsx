import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  CheckCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useDailyReview, useSaveReviewDraft, useCompleteReview, useToggleHabit } from '../hooks/useJournal';
import type { ReviewMood, SaveReviewInput, CompleteReviewInput } from '../lib/types';

const MOOD_OPTIONS = [
  { value: 'great' as const, emoji: '😄', label: 'Great' },
  { value: 'good' as const, emoji: '😊', label: 'Good' },
  { value: 'okay' as const, emoji: '😐', label: 'Okay' },
  { value: 'difficult' as const, emoji: '😕', label: 'Difficult' },
  { value: 'terrible' as const, emoji: '😢', label: 'Terrible' },
];

export function JournalViewConnected() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateString = format(currentDate, 'yyyy-MM-dd');

  // Fetch daily review data
  const { data: reviewData, isLoading, error } = useDailyReview(dateString);
  const saveReviewDraft = useSaveReviewDraft();
  const completeReview = useCompleteReview();
  const toggleHabit = useToggleHabit();

  // Local state for editing
  const [journalText, setJournalText] = useState('');
  const [intentions, setIntentions] = useState<string[]>(['', '', '']);
  const [reflections, setReflections] = useState({
    wentWell: '',
    couldImprove: '',
    tomorrowFocus: '',
  });
  const [mood, setMood] = useState<ReviewMood | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Track start time for duration calculation
  const startTimeRef = useRef<Date>(new Date());

  // Auto-save timer
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update local state when review data loads
  useEffect(() => {
    if (reviewData?.review) {
      setJournalText(reviewData.review.journalText || '');
      setMood(reviewData.review.mood);
      // Parse intentions from journal text if stored there
    }
  }, [reviewData?.review]);

  // Auto-save functionality
  const debouncedSave = useCallback(() => {
    if (!reviewData?.review?.id) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const input: SaveReviewInput = {
        id: reviewData.review!.id,
        journalText,
        mood,
        tags: [],
      };

      try {
        await saveReviewDraft.mutateAsync(input);
      } catch (err) {
        console.error('Failed to auto-save:', err);
      }
    }, 2000); // 2 second debounce
  }, [reviewData?.review?.id, journalText, mood, saveReviewDraft]);

  // Trigger auto-save when content changes
  useEffect(() => {
    if (journalText || mood) {
      debouncedSave();
    }
  }, [journalText, mood, debouncedSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    setCurrentDate(newDate);
    startTimeRef.current = new Date(); // Reset timer for new day
  };

  const handleToggleHabit = async (habitId: string) => {
    try {
      await toggleHabit.mutateAsync({ habitId, date: dateString });
    } catch (err) {
      console.error('Failed to toggle habit:', err);
    }
  };

  const handleComplete = async () => {
    if (!reviewData?.review?.id || !journalText || !mood) return;

    setIsSaving(true);
    try {
      const durationSeconds = Math.round((new Date().getTime() - startTimeRef.current.getTime()) / 1000);
      const input: CompleteReviewInput = {
        id: reviewData.review.id,
        journalText,
        mood,
        tags: [],
        reviewDurationSeconds: durationSeconds,
      };
      await completeReview.mutateAsync(input);
    } catch (err) {
      console.error('Failed to complete review:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-500">Failed to load journal data</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const completedTasks = reviewData?.completedTasks || [];
  const habits = reviewData?.habits || [];
  const goals = reviewData?.goals || [];
  const isCompleted = reviewData?.review?.reviewCompleted;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateDay('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-purple-500" />
              <h1 className="text-xl font-bold text-gray-900">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h1>
              {isToday(currentDate) && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                  Today
                </span>
              )}
              {isCompleted && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded flex items-center gap-1">
                  <CheckCircleIcon className="w-3 h-3" />
                  Completed
                </span>
              )}
            </div>
            <button
              onClick={() => navigateDay('next')}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={isToday(currentDate)}
            >
              <ChevronRightIcon
                className={`w-5 h-5 ${isToday(currentDate) ? 'text-gray-300' : 'text-gray-600'}`}
              />
            </button>
          </div>
          {!isCompleted && (
            <button
              onClick={handleComplete}
              disabled={!journalText || !mood || isSaving}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Complete Review
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-8">
        {/* Habits Section */}
        {habits.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-xl">🎯</span> Daily Habits
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {habits.map((habit) => (
                <button
                  key={habit.id}
                  onClick={() => handleToggleHabit(habit.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                    habit.isCompletedToday
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{habit.emoji || '✓'}</span>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{habit.name}</div>
                    <div className="text-xs text-gray-500">
                      {habit.currentStreak} day streak
                    </div>
                  </div>
                  {habit.isCompletedToday && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Morning Intentions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-xl">🌅</span> Morning Intentions
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            What are your top 3 priorities for today?
          </p>
          <div className="space-y-2">
            {intentions.map((intention, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={intention}
                  onChange={(e) => {
                    const newIntentions = [...intentions];
                    newIntentions[i] = e.target.value;
                    setIntentions(newIntentions);
                  }}
                  placeholder={`Priority ${i + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Notes & Thoughts */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-xl">💭</span> Notes & Thoughts
          </h2>
          <textarea
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            placeholder="Capture your thoughts, ideas, and observations..."
            className="w-full min-h-[150px] px-4 py-3 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
          />
          <p className="mt-2 text-xs text-gray-400">
            Auto-saves every 2 seconds
          </p>
        </section>

        {/* Tasks Completed Today */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
            Tasks Completed Today
            <span className="text-sm font-normal text-gray-500">
              ({completedTasks.length})
            </span>
          </h2>
          {completedTasks.length > 0 ? (
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{task.title}</div>
                    <div className="text-xs text-gray-500">
                      {task.projectName && <span>{task.projectName} • </span>}
                      {format(parseISO(task.completedAt), 'h:mm a')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <p>No tasks completed yet today</p>
            </div>
          )}
        </section>

        {/* Goals Progress */}
        {goals.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-xl">🎯</span> Active Goals
            </h2>
            <div className="space-y-3">
              {goals.slice(0, 5).map((goal) => (
                <div key={goal.id} className="px-4 py-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">{goal.title}</span>
                    <span className="text-sm text-purple-600">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evening Reflection */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-xl">🌙</span> Evening Reflection
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What went well today?
              </label>
              <textarea
                value={reflections.wentWell}
                onChange={(e) =>
                  setReflections({ ...reflections, wentWell: e.target.value })
                }
                placeholder="Celebrate your wins..."
                className="w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What could improve?
              </label>
              <textarea
                value={reflections.couldImprove}
                onChange={(e) =>
                  setReflections({ ...reflections, couldImprove: e.target.value })
                }
                placeholder="Learn from today..."
                className="w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tomorrow's focus
              </label>
              <textarea
                value={reflections.tomorrowFocus}
                onChange={(e) =>
                  setReflections({ ...reflections, tomorrowFocus: e.target.value })
                }
                placeholder="Set yourself up for success..."
                className="w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </section>

        {/* Mood */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How was your day?</h2>
          <div className="flex gap-3">
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setMood(option.value)}
                className={`flex-1 flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  mood === option.value
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-sm text-gray-600">{option.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
