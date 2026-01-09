import { clsx } from 'clsx';
import type { ReviewMood } from '@jd-agent/types';
import { MOOD_CONFIG } from '@jd-agent/types';

interface Props {
  value?: ReviewMood;
  onChange: (mood: ReviewMood) => void;
}

const MOODS: ReviewMood[] = ['great', 'good', 'okay', 'difficult', 'terrible'];

export function MoodSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">How was your day?</label>
      <div className="flex gap-3">
        {MOODS.map((mood) => {
          const config = MOOD_CONFIG[mood];
          const isSelected = value === mood;

          return (
            <button
              key={mood}
              onClick={() => onChange(mood)}
              className={clsx(
                'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <span className="text-2xl">{config.emoji}</span>
              <span
                className={clsx(
                  'text-xs font-medium',
                  isSelected ? 'text-blue-600' : 'text-gray-600'
                )}
              >
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
