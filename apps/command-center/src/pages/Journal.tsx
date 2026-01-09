import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, isToday } from 'date-fns';
import { useDailyReview, useSaveReviewDraft, useCompleteReview, useToggleHabitCompletion, useReviewHistory } from '../hooks/useJournal';
import { MOOD_CONFIG, type ReviewMood, type HabitReviewData, type GoalsByDomain, type TaskReviewData, type TomorrowPreviewData, type TaskReflection } from '../api/journal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

const STEPS = [
  { id: 1, name: 'Habits', icon: '🔄', description: 'Review daily habits' },
  { id: 2, name: 'Goals', icon: '🎯', description: 'Review goal progress' },
  { id: 3, name: 'Journal', icon: '✍️', description: 'Write your thoughts' },
  { id: 4, name: 'Tasks', icon: '✅', description: 'Review completed tasks' },
  { id: 5, name: 'Classes', icon: '📚', description: 'Review class notes' },
  { id: 6, name: 'Tomorrow', icon: '📅', description: 'Preview tomorrow' },
  { id: 7, name: 'Complete', icon: '🎉', description: 'Finish your review' },
];

function Journal() {
  const [currentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [currentStep, setCurrentStep] = useState(1);
  const [journalText, setJournalText] = useState('');
  const [mood, setMood] = useState<ReviewMood | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [taskReflections, setTaskReflections] = useState<Map<string, string>>(new Map());
  const [startTime] = useState(() => Date.now());
  const [showHistory, setShowHistory] = useState(false);

  const { data: reviewData, isLoading } = useDailyReview(currentDate);
  const saveDraft = useSaveReviewDraft();
  const completeReview = useCompleteReview();
  const toggleHabit = useToggleHabitCompletion();

  // Initialize from existing review
  useEffect(() => {
    if (reviewData?.review) {
      setCurrentStep(reviewData.review.currentStep || 1);
      setJournalText(reviewData.review.journalText || '');
      setMood(reviewData.review.mood);
      setTags(reviewData.review.tags || []);
    }
  }, [reviewData?.review]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!reviewData?.review?.id) return;

    const interval = setInterval(() => {
      handleSaveDraft();
    }, 30000);

    return () => clearInterval(interval);
  }, [reviewData?.review?.id, journalText, mood, tags, currentStep]);

  const handleSaveDraft = useCallback(() => {
    if (!reviewData?.review?.id) return;

    const tasksReviewed: TaskReflection[] = reviewData.completedTasks.map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      completedAt: t.completedAt,
      projectName: t.projectName,
      reflectionNote: taskReflections.get(t.id),
    }));

    saveDraft.mutate({
      id: reviewData.review.id,
      journalText,
      mood,
      tags,
      currentStep,
      tasksReviewed,
    });
  }, [reviewData, journalText, mood, tags, currentStep, taskReflections, saveDraft]);

  const handleComplete = useCallback(() => {
    if (!reviewData?.review?.id || !mood || !journalText) return;

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    completeReview.mutate({
      id: reviewData.review.id,
      journalText,
      mood,
      tags,
      reviewDurationSeconds: durationSeconds,
    });
  }, [reviewData, journalText, mood, tags, startTime, completeReview]);

  const handleToggleHabit = useCallback((habitId: string) => {
    toggleHabit.mutate({ habitId, date: currentDate });
  }, [toggleHabit, currentDate]);

  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(tags.filter(t => t !== tag));
  }, [tags]);

  const nextStep = useCallback(() => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
      handleSaveDraft();
    }
  }, [currentStep, handleSaveDraft]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Skip classes step if no class notes
  const hasClasses = reviewData?.classNotes && reviewData.classNotes.length > 0;
  const effectiveSteps = useMemo(() => {
    if (hasClasses) return STEPS;
    return STEPS.filter(s => s.id !== 5);
  }, [hasClasses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (showHistory) {
    return <HistoryView onBack={() => setShowHistory(false)} />;
  }

  if (reviewData?.review?.reviewCompleted) {
    return <CompletedView review={reviewData.review} onViewHistory={() => setShowHistory(true)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Daily Review
          </h1>
          <p className="text-text-muted mt-1">
            {format(new Date(currentDate), 'EEEE, MMMM d, yyyy')}
            {isToday(new Date(currentDate)) && (
              <span className="ml-2 px-2 py-0.5 bg-accent/20 text-accent text-xs rounded">Today</span>
            )}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowHistory(true)}>
          View History
        </Button>
      </div>

      {/* Progress Bar */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-text-muted">Step {currentStep} of {effectiveSteps.length}</span>
          <span className="text-sm text-accent">{Math.round((currentStep / effectiveSteps.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / effectiveSteps.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-4">
          {effectiveSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex flex-col items-center gap-1 transition-all ${
                step.id === currentStep
                  ? 'text-accent scale-110'
                  : step.id < currentStep
                  ? 'text-success'
                  : 'text-text-muted'
              }`}
            >
              <span className="text-xl">{step.icon}</span>
              <span className="text-xs hidden sm:block">{step.name}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 1 && reviewData && (
          <HabitsStep habits={reviewData.habits} onToggle={handleToggleHabit} isToggling={toggleHabit.isPending} />
        )}
        {currentStep === 2 && reviewData && (
          <GoalsStep goals={reviewData.goals} />
        )}
        {currentStep === 3 && (
          <JournalStep journalText={journalText} onChange={setJournalText} />
        )}
        {currentStep === 4 && reviewData && (
          <TasksStep
            tasks={reviewData.completedTasks}
            reflections={taskReflections}
            onReflectionChange={(id, note) => {
              const newReflections = new Map(taskReflections);
              newReflections.set(id, note);
              setTaskReflections(newReflections);
            }}
          />
        )}
        {currentStep === 5 && hasClasses && reviewData && (
          <ClassesStep classes={reviewData.classNotes} />
        )}
        {currentStep === 6 && reviewData && (
          <TomorrowStep preview={reviewData.tomorrowPreview} />
        )}
        {currentStep === 7 && (
          <CompleteStep
            mood={mood}
            onMoodChange={setMood}
            tags={tags}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onComplete={handleComplete}
            isCompleting={completeReview.isPending}
            canComplete={!!mood && !!journalText}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-dark-border">
        <Button variant="secondary" onClick={prevStep} disabled={currentStep === 1}>
          ← Previous
        </Button>
        <Button variant="secondary" onClick={handleSaveDraft} disabled={saveDraft.isPending}>
          {saveDraft.isPending ? 'Saving...' : 'Save Draft'}
        </Button>
        {currentStep < 7 ? (
          <Button onClick={nextStep}>
            Next →
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

// Step 1: Habits Review
function HabitsStep({ habits, onToggle, isToggling }: { habits: HabitReviewData[]; onToggle: (id: string) => void; isToggling: boolean }) {
  const dueHabits = habits.filter(h => h.isDueToday);
  const completedCount = dueHabits.filter(h => h.completedToday).length;
  const completionRate = dueHabits.length > 0 ? Math.round((completedCount / dueHabits.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>🔄</span> Habits Review
        </h2>
        <span className="text-lg font-bold text-accent">{completedCount}/{dueHabits.length} ({completionRate}%)</span>
      </div>

      {dueHabits.length === 0 ? (
        <Card className="text-center py-8 text-text-muted">
          No habits scheduled for today
        </Card>
      ) : (
        <div className="space-y-2">
          {dueHabits.map(habit => (
            <Card key={habit.id} className="flex items-center gap-4">
              <button
                onClick={() => onToggle(habit.id)}
                disabled={isToggling}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  habit.completedToday
                    ? 'bg-success border-success text-white'
                    : 'border-dark-border hover:border-accent'
                }`}
              >
                {habit.completedToday && '✓'}
              </button>
              <div className="flex-1">
                <h3 className={`font-medium ${habit.completedToday ? 'line-through text-text-muted' : ''}`}>
                  {habit.title}
                </h3>
                {habit.goalTitle && (
                  <p className="text-sm text-accent">→ {habit.goalTitle}</p>
                )}
              </div>
              <div className="text-right">
                {habit.currentStreak > 0 && (
                  <div className="flex items-center gap-1 text-accent">
                    <span>🔥</span>
                    <span className="font-bold">{habit.currentStreak}</span>
                  </div>
                )}
                <div className={`text-xs px-2 py-0.5 rounded ${
                  habit.streakStatus === 'active' ? 'bg-success/20 text-success' :
                  habit.streakStatus === 'at_risk' ? 'bg-warning/20 text-warning' :
                  'bg-dark-bg text-text-muted'
                }`}>
                  {habit.streakStatus}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 2: Goals Review
function GoalsStep({ goals }: { goals: GoalsByDomain[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>🎯</span> Goals Review
      </h2>

      {goals.length === 0 ? (
        <Card className="text-center py-8 text-text-muted">
          No active goals to review
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map(area => (
            <Card key={area.domain}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>{area.icon}</span>
                <span style={{ color: area.color }}>{area.domain}</span>
                <span className="text-sm text-text-muted">({area.goals.length})</span>
              </h3>
              <div className="space-y-3">
                {area.goals.map(goal => (
                  <div key={goal.id} className="p-3 bg-dark-bg rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{goal.title}</span>
                      <span className="text-accent font-bold">{goal.progressPercentage}%</span>
                    </div>
                    <div className="h-2 bg-dark-card rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${goal.progressPercentage}%`, backgroundColor: area.color }}
                      />
                    </div>
                    {goal.motivation && (
                      <p className="text-xs text-text-muted mt-2">{goal.motivation}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 3: Journal Entry
function JournalStep({ journalText, onChange }: { journalText: string; onChange: (text: string) => void }) {
  const wordCount = journalText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>✍️</span> Journal Entry
        </h2>
        <span className="text-sm text-text-muted">{wordCount} words</span>
      </div>

      <Card>
        <p className="text-text-muted mb-4">
          Reflect on your day. What went well? What could improve? What are you grateful for?
        </p>
        <textarea
          value={journalText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Start writing your thoughts..."
          className="w-full min-h-[300px] bg-dark-bg border border-dark-border rounded-lg px-4 py-3 focus:border-accent focus:outline-none resize-none"
        />
      </Card>
    </div>
  );
}

// Step 4: Tasks Review
function TasksStep({ tasks, reflections, onReflectionChange }: {
  tasks: TaskReviewData[];
  reflections: Map<string, string>;
  onReflectionChange: (id: string, note: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>✅</span> Tasks Completed
        <span className="text-sm text-text-muted">({tasks.length})</span>
      </h2>

      {tasks.length === 0 ? (
        <Card className="text-center py-8 text-text-muted">
          No tasks completed today
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <Card key={task.id}>
              <div className="flex items-start gap-3">
                <span className="text-success mt-1">✓</span>
                <div className="flex-1">
                  <h3 className="font-medium">{task.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-text-muted mt-1">
                    {task.projectName && <span>{task.projectName}</span>}
                    <span>{format(new Date(task.completedAt), 'h:mm a')}</span>
                  </div>
                  <input
                    type="text"
                    value={reflections.get(task.id) || ''}
                    onChange={(e) => onReflectionChange(task.id, e.target.value)}
                    placeholder="Add a reflection note (optional)..."
                    className="w-full mt-2 bg-dark-bg border border-dark-border rounded px-3 py-1 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 5: Classes Review
function ClassesStep({ classes }: { classes: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>📚</span> Class Notes
        <span className="text-sm text-text-muted">({classes.length})</span>
      </h2>

      <div className="space-y-3">
        {classes.map(cls => (
          <Card key={cls.id}>
            <h3 className="font-semibold">{cls.className}</h3>
            <p className="text-sm text-text-muted mt-1">{cls.pageTitle}</p>
            {cls.keyTakeaways && cls.keyTakeaways.length > 0 && (
              <ul className="mt-2 space-y-1">
                {cls.keyTakeaways.map((takeaway: string, i: number) => (
                  <li key={i} className="text-sm text-text-muted flex items-start gap-2">
                    <span>•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// Step 6: Tomorrow Preview
function TomorrowStep({ preview }: { preview: TomorrowPreviewData }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>📅</span> Tomorrow Preview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Events */}
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>📆</span> Events ({preview.events.length})
          </h3>
          {preview.events.length === 0 ? (
            <p className="text-text-muted text-sm">No events scheduled</p>
          ) : (
            <div className="space-y-2">
              {preview.events.map(event => (
                <div key={event.id} className="p-2 bg-dark-bg rounded text-sm">
                  <div className="font-medium">{event.title}</div>
                  <div className="text-text-muted">
                    {format(new Date(event.startTime), 'h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tasks */}
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>📋</span> Tasks ({preview.tasks.length})
          </h3>
          {preview.tasks.length === 0 ? (
            <p className="text-text-muted text-sm">No tasks scheduled</p>
          ) : (
            <div className="space-y-2">
              {preview.tasks.slice(0, 5).map(task => (
                <div key={task.id} className="p-2 bg-dark-bg rounded text-sm">
                  <div className="font-medium">{task.title}</div>
                  {task.projectName && (
                    <div className="text-text-muted">{task.projectName}</div>
                  )}
                </div>
              ))}
              {preview.tasks.length > 5 && (
                <p className="text-text-muted text-xs">+{preview.tasks.length - 5} more</p>
              )}
            </div>
          )}
        </Card>

        {/* Habits */}
        <Card>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>🔄</span> Habits ({preview.habits.length})
          </h3>
          {preview.habits.length === 0 ? (
            <p className="text-text-muted text-sm">No habits scheduled</p>
          ) : (
            <div className="space-y-2">
              {preview.habits.map(habit => (
                <div key={habit.id} className="p-2 bg-dark-bg rounded text-sm flex items-center justify-between">
                  <span>{habit.title}</span>
                  {habit.currentStreak > 0 && (
                    <span className="text-accent">🔥{habit.currentStreak}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Step 7: Complete Review
function CompleteStep({
  mood,
  onMoodChange,
  tags,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onComplete,
  isCompleting,
  canComplete,
}: {
  mood?: ReviewMood;
  onMoodChange: (mood: ReviewMood) => void;
  tags: string[];
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onComplete: () => void;
  isCompleting: boolean;
  canComplete: boolean;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <span>🎉</span> Complete Your Review
      </h2>

      {/* Mood Selection */}
      <Card>
        <h3 className="font-semibold mb-4">How was your day?</h3>
        <div className="flex gap-3">
          {(Object.entries(MOOD_CONFIG) as [ReviewMood, typeof MOOD_CONFIG[ReviewMood]][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => onMoodChange(key)}
              className={`flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-lg border-2 transition-all ${
                mood === key
                  ? 'border-accent bg-accent/10'
                  : 'border-dark-border hover:border-accent/50'
              }`}
            >
              <span className="text-3xl">{config.emoji}</span>
              <span className="text-sm">{config.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Tags */}
      <Card>
        <h3 className="font-semibold mb-4">Tags</h3>
        <div className="flex gap-2 mb-3 flex-wrap">
          {tags.map(tag => (
            <span
              key={tag}
              className="px-3 py-1 bg-dark-bg rounded-full text-sm flex items-center gap-2"
            >
              {tag}
              <button onClick={() => onRemoveTag(tag)} className="text-text-muted hover:text-text">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => onTagInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddTag()}
            placeholder="Add a tag..."
            className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2 focus:border-accent focus:outline-none"
          />
          <Button variant="secondary" onClick={onAddTag}>Add</Button>
        </div>
      </Card>

      {/* Complete Button */}
      <div className="text-center pt-4">
        {!canComplete && (
          <p className="text-warning text-sm mb-4">
            Please select a mood and write a journal entry to complete your review.
          </p>
        )}
        <Button
          onClick={onComplete}
          disabled={!canComplete || isCompleting}
          className="px-12 py-3 text-lg"
        >
          {isCompleting ? 'Completing...' : '✨ Complete Review'}
        </Button>
      </div>
    </div>
  );
}

// Completed View
function CompletedView({ review, onViewHistory }: { review: any; onViewHistory: () => void }) {
  const moodConfig = review.mood ? MOOD_CONFIG[review.mood as ReviewMood] : null;

  return (
    <div className="max-w-2xl mx-auto text-center space-y-6 py-12">
      <div className="text-6xl mb-4">🎉</div>
      <h1 className="text-3xl font-bold">Review Complete!</h1>
      <p className="text-text-muted">
        Great job reflecting on your day. Your review has been saved.
      </p>

      {moodConfig && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-dark-card rounded-lg">
          <span className="text-2xl">{moodConfig.emoji}</span>
          <span>You felt <strong>{moodConfig.label}</strong> today</span>
        </div>
      )}

      {review.habitsCompletedCount !== undefined && review.habitsTotalCount !== undefined && (
        <Card className="text-left">
          <h3 className="font-semibold mb-2">Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-muted">Habits Completed:</span>
              <span className="ml-2 font-bold">{review.habitsCompletedCount}/{review.habitsTotalCount}</span>
            </div>
            <div>
              <span className="text-text-muted">Word Count:</span>
              <span className="ml-2 font-bold">{review.wordCount || 0}</span>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-center gap-4 pt-4">
        <Button variant="secondary" onClick={onViewHistory}>
          View History
        </Button>
        {review.vaultPageId && (
          <Button onClick={() => window.location.href = `/vault/${review.vaultPageId}`}>
            View in Vault
          </Button>
        )}
      </div>
    </div>
  );
}

// History View
function HistoryView({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(1);
  const { data: history, isLoading } = useReviewHistory(page);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Review History
          </h1>
          <p className="text-text-muted mt-1">Browse your past daily reviews</p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          ← Back to Today
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !history || history.reviews.length === 0 ? (
        <Card className="text-center py-12 text-text-muted">
          No reviews yet. Complete your first daily review!
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {history.reviews.map(review => {
              const moodConfig = review.mood ? MOOD_CONFIG[review.mood] : null;
              return (
                <Card key={review.id} className="hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {format(new Date(review.date), 'EEEE, MMMM d, yyyy')}
                      </h3>
                      {review.journalPreview && (
                        <p className="text-sm text-text-muted mt-1 line-clamp-2">
                          {review.journalPreview}...
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {moodConfig && (
                        <span className="text-2xl">{moodConfig.emoji}</span>
                      )}
                      {review.habitsCompletionRate !== undefined && (
                        <span className="text-sm text-accent">{review.habitsCompletionRate}%</span>
                      )}
                      {!review.reviewCompleted && (
                        <span className="text-xs px-2 py-1 bg-warning/20 text-warning rounded">Draft</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {history.hasMore && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => setPage(page + 1)}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Journal;
