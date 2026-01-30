/**
 * ClassView - View combined class notes (Plaud + Remarkable + typed)
 *
 * Shows:
 * - Class info header with semester
 * - List of class days with content status
 * - Combined content preview
 * - Ability to combine pending notes
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AcademicCapIcon,
  MicrophoneIcon,
  PencilIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { useClass, useCombineClassNotes, useCombineAllClassNotes } from '../hooks/useClasses';
import type { ClassDay } from '../lib/types';

interface ClassViewProps {
  classCode: string;
  onNavigateToPage?: (pageId: string) => void;
  onBack?: () => void;
}

export function ClassView({ classCode, onNavigateToPage, onBack }: ClassViewProps) {
  const { data, isLoading, error } = useClass(classCode);
  const combineNotes = useCombineClassNotes();
  const combineAll = useCombineAllClassNotes();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Loading class notes...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ExclamationCircleIcon className="w-8 h-8 mx-auto text-red-400" />
          <p className="mt-2 text-sm text-gray-500">Failed to load class</p>
          <p className="text-xs text-gray-400">{error?.message}</p>
        </div>
      </div>
    );
  }

  const { class: classInfo, classDays, totalDays, combinedCount, pendingCombine } = data;

  const handleCombineDay = async (date: string) => {
    try {
      const result = await combineNotes.mutateAsync({ code: classCode, date });
      if (result.vaultPageId && onNavigateToPage) {
        onNavigateToPage(result.vaultPageId);
      }
    } catch (err) {
      console.error('Failed to combine notes:', err);
    }
  };

  const handleCombineAll = async () => {
    try {
      await combineAll.mutateAsync();
    } catch (err) {
      console.error('Failed to combine all notes:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-[#191919]">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-[#191919] border-b border-gray-200 dark:border-gray-800 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-500 rotate-180" />
              </button>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                  <AcademicCapIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {classInfo.code}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {classInfo.name} • {classInfo.semester}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <BookOpenIcon className="w-4 h-4" />
              <span>{totalDays} class days</span>
            </div>
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircleIcon className="w-4 h-4" />
              <span>{combinedCount} combined</span>
            </div>
            {pendingCombine > 0 && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <ExclamationCircleIcon className="w-4 h-4" />
                <span>{pendingCombine} pending</span>
              </div>
            )}
            {pendingCombine > 0 && (
              <button
                onClick={handleCombineAll}
                disabled={combineAll.isPending}
                className="ml-auto px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 disabled:opacity-50 transition-colors"
              >
                {combineAll.isPending ? 'Combining...' : 'Combine All'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Class days list */}
      <div className="max-w-3xl mx-auto px-6 py-4">
        {classDays.length === 0 ? (
          <div className="text-center py-12">
            <BookOpenIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No class notes yet
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Notes will appear here when Plaud recordings or Remarkable notes are synced.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {classDays.map((day) => (
              <ClassDayCard
                key={day.date}
                day={day}
                isExpanded={expandedDay === day.date}
                onToggle={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                onCombine={() => handleCombineDay(day.date)}
                onNavigateToPage={onNavigateToPage}
                isCombining={
                  combineNotes.isPending &&
                  combineNotes.variables?.code === classCode &&
                  combineNotes.variables?.date === day.date
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ClassDayCardProps {
  day: ClassDay;
  isExpanded: boolean;
  onToggle: () => void;
  onCombine: () => void;
  onNavigateToPage?: (pageId: string) => void;
  isCombining: boolean;
}

function ClassDayCard({
  day,
  isExpanded,
  onToggle,
  onCombine,
  onNavigateToPage,
  isCombining,
}: ClassDayCardProps) {
  const formattedDate = format(parseISO(day.date), 'EEEE, MMMM d, yyyy');
  const shortDate = format(parseISO(day.date), 'MMM d');

  const hasBothSources = day.hasPlaudRecording && day.hasRemarkableNotes;
  const canCombine = hasBothSources && !day.isCombined;

  return (
    <div
      className={clsx(
        'border rounded-lg transition-colors',
        day.isCombined
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
          : canCombine
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {shortDate}
            </span>
            {day.isCombined && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full">
                Combined
              </span>
            )}
            {canCombine && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
                Ready to combine
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
        </div>

        {/* Source indicators */}
        <div className="flex items-center gap-2">
          <SourceIndicator
            icon={MicrophoneIcon}
            label="Plaud"
            active={day.hasPlaudRecording}
            color="red"
          />
          <SourceIndicator
            icon={PencilIcon}
            label="Remarkable"
            active={day.hasRemarkableNotes}
            color="blue"
          />
          <SourceIndicator
            icon={DocumentTextIcon}
            label="Typed"
            active={day.hasTypedNotes}
            color="green"
          />
        </div>

        <ChevronRightIcon
          className={clsx(
            'w-5 h-5 text-gray-400 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mt-4">
            {day.vaultPageId && (
              <button
                onClick={() => onNavigateToPage?.(day.vaultPageId!)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <DocumentTextIcon className="w-4 h-4" />
                View Notes
              </button>
            )}
            {canCombine && (
              <button
                onClick={onCombine}
                disabled={isCombining}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {isCombining ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Combining...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="w-4 h-4" />
                    Combine Notes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SourceIndicatorProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  color: 'red' | 'blue' | 'green';
}

function SourceIndicator({ icon: Icon, label, active, color }: SourceIndicatorProps) {
  const colorClasses = {
    red: active
      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
    blue: active
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
    green: active
      ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        colorClasses[color]
      )}
      title={label}
    >
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}
