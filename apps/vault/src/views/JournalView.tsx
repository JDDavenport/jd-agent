import { useState, useMemo } from 'react';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface JournalEntry {
  id: string;
  date: string;
  morningIntentions?: string[];
  notes?: string;
  reflections?: {
    wentWell?: string;
    couldImprove?: string;
    tomorrowFocus?: string;
  };
  mood?: 'great' | 'good' | 'okay' | 'bad';
}

interface CompletedTask {
  id: string;
  title: string;
  completedAt: string;
  project?: string;
  context: string;
}

interface JournalViewProps {
  entry?: JournalEntry;
  completedTasks?: CompletedTask[];
  onSave?: (entry: Partial<JournalEntry>) => void;
  onNavigate?: (date: Date) => void;
}

const MOOD_OPTIONS = [
  { value: 'great', emoji: '😄', label: 'Great' },
  { value: 'good', emoji: '😊', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'bad', emoji: '😔', label: 'Bad' },
] as const;

export function JournalView({
  entry,
  completedTasks = [],
  onSave,
  onNavigate,
}: JournalViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notes, setNotes] = useState(entry?.notes || '');
  const [intentions, setIntentions] = useState<string[]>(
    entry?.morningIntentions || ['', '', '']
  );
  const [reflections, setReflections] = useState({
    wentWell: entry?.reflections?.wentWell || '',
    couldImprove: entry?.reflections?.couldImprove || '',
    tomorrowFocus: entry?.reflections?.tomorrowFocus || '',
  });
  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'bad' | undefined>(
    entry?.mood
  );

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    setCurrentDate(newDate);
    onNavigate?.(newDate);
  };

  const todaysTasks = useMemo(() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return completedTasks.filter((task) => {
      const taskDate = format(parseISO(task.completedAt), 'yyyy-MM-dd');
      return taskDate === dateStr;
    });
  }, [completedTasks, currentDate]);

  const updateIntention = (index: number, value: string) => {
    const newIntentions = [...intentions];
    newIntentions[index] = value;
    setIntentions(newIntentions);
  };

  const handleSave = () => {
    onSave?.({
      date: format(currentDate, 'yyyy-MM-dd'),
      morningIntentions: intentions.filter(Boolean),
      notes,
      reflections,
      mood,
    });
  };

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
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-8">
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
                  onChange={(e) => updateIntention(i, e.target.value)}
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Capture your thoughts, ideas, and observations..."
            className="w-full min-h-[150px] px-4 py-3 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
          />
          <p className="mt-2 text-xs text-gray-400">
            Tip: Use [[Page Name]] to link to other vault entries
          </p>
        </section>

        {/* Tasks Completed Today */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
            Tasks Completed Today
            <span className="text-sm font-normal text-gray-500">
              ({todaysTasks.length})
            </span>
          </h2>
          {todaysTasks.length > 0 ? (
            <div className="space-y-2">
              {todaysTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{task.title}</div>
                    <div className="text-xs text-gray-500">
                      {task.project && <span>{task.project} • </span>}
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
