import { useState, useCallback, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useDailyReview, useSaveReview, useCompleteReview } from '../hooks';
import { ProgressIndicator } from './ProgressIndicator';
import { StepNavigation } from './StepNavigation';
import { HabitsReview } from '../steps/HabitsReview';
import { GoalsReview } from '../steps/GoalsReview';
import { JournalEditor } from '../steps/JournalEditor';
import { TasksReview } from '../steps/TasksReview';
import { ClassesReview } from '../steps/ClassesReview';
import { TomorrowPreview } from '../steps/TomorrowPreview';
import { ReviewComplete } from '../steps/ReviewComplete';
import { LoadingSpinner } from './LoadingSpinner';
import type { ReviewMood, TaskReflection, ClassReflection } from '@jd-agent/types';
import { ClockIcon } from '@heroicons/react/24/outline';

interface Step {
  id: number;
  title: string;
  icon: string;
  conditional?: boolean;
}

const ALL_STEPS: Step[] = [
  { id: 1, title: 'Habits', icon: '🔄' },
  { id: 2, title: 'Goals', icon: '🎯' },
  { id: 3, title: 'Journal', icon: '📝' },
  { id: 4, title: 'Tasks', icon: '✅' },
  { id: 5, title: 'Classes', icon: '📚', conditional: true },
  { id: 6, title: 'Tomorrow', icon: '📅' },
  { id: 7, title: 'Complete', icon: '🏁' },
];

interface Props {
  date: string;
  onViewHistory: () => void;
  onComplete: () => void;
}

export function ReviewWorkflow({ date, onViewHistory, onComplete }: Props) {
  const { data, isLoading, isError } = useDailyReview(date);
  const saveReview = useSaveReview();
  const completeReview = useCompleteReview();

  // Local state for review data
  const [currentStep, setCurrentStep] = useState(1);
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState<ReviewMood | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [tasksReviewed, setTasksReviewed] = useState<TaskReflection[]>([]);
  const [classesReviewed, setClassesReviewed] = useState<ClassReflection[]>([]);
  const [startTime] = useState(Date.now());

  // Sync local state with server data on load
  useEffect(() => {
    if (data?.review) {
      setCurrentStep(data.review.currentStep || 1);
      setJournalText(data.review.journalText || '');
      setMood(data.review.mood);
      setTags(data.review.tags || []);
      setTasksReviewed(data.review.tasksReviewed || []);
      setClassesReviewed(data.review.classesReviewed || []);
    }
  }, [data?.review]);

  // Determine if student mode (has classes)
  const isStudentMode = (data?.classNotes?.length || 0) > 0;

  // Filter steps based on student mode
  const activeSteps = useMemo(
    () => ALL_STEPS.filter((s) => !s.conditional || isStudentMode),
    [isStudentMode]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(async () => {
    if (!data?.review?.id) return;

    await saveReview.mutateAsync({
      id: data.review.id,
      journalText,
      mood,
      tags,
      tasksReviewed,
      classesReviewed,
      currentStep,
    });
  }, [data?.review?.id, journalText, mood, tags, tasksReviewed, classesReviewed, currentStep, saveReview]);

  // Auto-save on step change and periodically
  useEffect(() => {
    const interval = setInterval(handleAutoSave, 30000);
    return () => clearInterval(interval);
  }, [handleAutoSave]);

  // Save when step changes
  useEffect(() => {
    handleAutoSave();
  }, [currentStep]);

  const handleNext = useCallback(() => {
    const currentIndex = activeSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex < activeSteps.length - 1) {
      setCurrentStep(activeSteps[currentIndex + 1].id);
    }
  }, [currentStep, activeSteps]);

  const handlePrevious = useCallback(() => {
    const currentIndex = activeSteps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(activeSteps[currentIndex - 1].id);
    }
  }, [currentStep, activeSteps]);

  const handleStepClick = useCallback((stepId: number) => {
    setCurrentStep(stepId);
  }, []);

  const handleComplete = useCallback(async () => {
    if (!data?.review?.id || !mood) return;

    const duration = Math.floor((Date.now() - startTime) / 1000);

    await completeReview.mutateAsync({
      id: data.review.id,
      journalText,
      mood,
      tags,
      reviewDurationSeconds: duration,
    });

    onComplete();
  }, [data?.review?.id, journalText, mood, tags, startTime, completeReview, onComplete]);

  const handleTaskReflection = useCallback((taskId: string, taskTitle: string, note: string) => {
    setTasksReviewed((prev) => {
      const existing = prev.find((t) => t.taskId === taskId);
      if (existing) {
        return prev.map((t) =>
          t.taskId === taskId ? { ...t, reflectionNote: note } : t
        );
      }
      return [...prev, { taskId, taskTitle, reflectionNote: note }];
    });
  }, []);

  const handleClassReflection = useCallback((classId: string, className: string, note: string) => {
    setClassesReviewed((prev) => {
      const existing = prev.find((c) => c.classId === classId);
      if (existing) {
        return prev.map((c) =>
          c.classId === classId ? { ...c, reflectionNote: note } : c
        );
      }
      return [...prev, { classId, className, reflectionNote: note }];
    });
  }, []);

  const formattedDate = useMemo(() => {
    try {
      return format(parseISO(date), 'EEEE, MMMM d, yyyy');
    } catch {
      return date;
    }
  }, [date]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load review data</p>
          <button
            onClick={onViewHistory}
            className="text-blue-500 hover:underline"
          >
            Go to History
          </button>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <HabitsReview habits={data?.habits || []} date={date} />;
      case 2:
        return <GoalsReview goals={data?.goals || []} />;
      case 3:
        return (
          <JournalEditor
            value={journalText}
            onChange={setJournalText}
          />
        );
      case 4:
        return (
          <TasksReview
            tasks={data?.completedTasks || []}
            reflections={tasksReviewed}
            onReflection={handleTaskReflection}
          />
        );
      case 5:
        return (
          <ClassesReview
            classes={data?.classNotes || []}
            reflections={classesReviewed}
            onReflection={handleClassReflection}
          />
        );
      case 6:
        return <TomorrowPreview preview={data?.tomorrowPreview} />;
      case 7:
        return (
          <ReviewComplete
            mood={mood}
            onMoodChange={setMood}
            tags={tags}
            onTagsChange={setTags}
            onComplete={handleComplete}
            isCompleting={completeReview.isPending}
            isValid={!!mood}
            habitsCompleted={data?.habits?.filter((h) => h.completedToday && h.isDueToday).length || 0}
            habitsTotal={data?.habits?.filter((h) => h.isDueToday).length || 0}
            tasksCompleted={data?.completedTasks?.length || 0}
            wordCount={journalText.trim().split(/\s+/).filter(Boolean).length}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === activeSteps[activeSteps.length - 1].id;
  const isFirstStep = currentStep === activeSteps[0].id;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Daily Review</h1>
            <p className="text-sm text-gray-500">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-4">
            {saveReview.isPending && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                Saving...
              </span>
            )}
            <button
              onClick={onViewHistory}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              View History
            </button>
          </div>
        </div>
        <ProgressIndicator
          steps={activeSteps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">{renderStep()}</div>
      </main>

      {/* Navigation footer */}
      <footer className="bg-white border-t px-6 py-4 shadow-sm">
        <StepNavigation
          canGoPrevious={!isFirstStep}
          canGoNext={!isLastStep}
          onPrevious={handlePrevious}
          onNext={handleNext}
          isLastStep={isLastStep}
        />
      </footer>
    </div>
  );
}
