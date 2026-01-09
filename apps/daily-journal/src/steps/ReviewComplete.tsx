import { useState } from 'react';
import { clsx } from 'clsx';
import type { ReviewMood } from '@jd-agent/types';
import { MoodSelector } from '../components/MoodSelector';
import {
  CheckCircleIcon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Props {
  mood?: ReviewMood;
  onMoodChange: (mood: ReviewMood) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  onComplete: () => void;
  isCompleting: boolean;
  isValid: boolean;
  habitsCompleted: number;
  habitsTotal: number;
  tasksCompleted: number;
  wordCount: number;
}

const SUGGESTED_TAGS = [
  'productive',
  'creative',
  'learning',
  'challenging',
  'relaxing',
  'social',
  'focused',
  'stressful',
];

export function ReviewComplete({
  mood,
  onMoodChange,
  tags,
  onTagsChange,
  onComplete,
  isCompleting,
  isValid,
  habitsCompleted,
  habitsTotal,
  tasksCompleted,
  wordCount,
}: Props) {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onTagsChange([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleSuggestedTag = (tag: string) => {
    if (!tags.includes(tag)) {
      onTagsChange([...tags, tag]);
    }
  };

  const habitsRate = habitsTotal > 0
    ? Math.round((habitsCompleted / habitsTotal) * 100)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Complete Review</h2>
        <p className="text-sm text-gray-500 mt-1">
          Finalize your daily review and save to vault
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-medium text-gray-900 mb-4">Review Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{habitsRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              Habits ({habitsCompleted}/{habitsTotal})
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{tasksCompleted}</p>
            <p className="text-xs text-gray-500 mt-1">Tasks Completed</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{wordCount}</p>
            <p className="text-xs text-gray-500 mt-1">Words Written</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">
              {mood ? '✓' : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Mood Selected</p>
          </div>
        </div>
      </div>

      {/* Mood selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <MoodSelector value={mood} onChange={onMoodChange} />
      </div>

      {/* Tags */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TagIcon className="w-5 h-5 text-gray-400" />
          <h3 className="font-medium text-gray-900">Tags (optional)</h3>
        </div>

        {/* Selected tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-blue-900"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add a tag..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAddTag}
            disabled={!tagInput.trim()}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {/* Suggested tags */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Suggested:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
              <button
                key={tag}
                onClick={() => handleSuggestedTag(tag)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Complete button */}
      <button
        onClick={onComplete}
        disabled={!isValid || isCompleting}
        className={clsx(
          'w-full py-4 rounded-lg font-medium text-lg transition-all flex items-center justify-center gap-2',
          isValid && !isCompleting
            ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        )}
      >
        {isCompleting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving to Vault...
          </>
        ) : (
          <>
            <CheckCircleIcon className="w-6 h-6" />
            Complete Review
          </>
        )}
      </button>

      {!isValid && (
        <p className="text-center text-sm text-gray-500 mt-3">
          Please select your mood to complete the review
        </p>
      )}
    </div>
  );
}
