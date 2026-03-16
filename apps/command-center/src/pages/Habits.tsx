import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useHabits,
  useTodaysHabits,
  useCreateHabit,
  useCompleteHabit,
  useDeleteHabit,
  useTasksForHabit,
  useHabitCompletions,
} from '../hooks/useGoals';
import { useTopStreaks, useHabitsDashboard } from '../hooks/useProgress';
import { LIFE_AREAS, type LifeArea, type Habit, type CreateHabitInput, type HabitFrequency } from '../types/goals';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';

function Habits() {
  const [selectedArea, setSelectedArea] = useState<LifeArea | undefined>();
  const [selectedHabitId, setSelectedHabitId] = useState<string | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'today' | 'all'>('today');

  const { data: allHabits, isLoading: habitsLoading } = useHabits({ lifeArea: selectedArea, isActive: true });
  const { data: todaysHabits, isLoading: todayLoading } = useTodaysHabits();
  const { data: streaks } = useTopStreaks(5);
  const { data: dashboard } = useHabitsDashboard();

  const habits = viewMode === 'today' ? todaysHabits : allHabits;
  const isLoading = viewMode === 'today' ? todayLoading : habitsLoading;

  const completeHabit = useCompleteHabit();

  const completedCount = todaysHabits?.filter(h => h.completedToday).length || 0;
  const totalCount = todaysHabits?.length || 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div data-testid="habits-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="habits-title" className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Habits
          </h1>
          <p className="text-text-muted mt-1">Build consistency with daily habits</p>
        </div>
        <Button data-testid="habits-create-button" onClick={() => setShowCreateModal(true)}>+ New Habit</Button>
      </div>

      {/* Today's Progress */}
      <Card data-testid="habits-progress-card" className="bg-gradient-to-r from-accent/10 to-accent-light/10 border-accent/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Today's Progress</h2>
            <p data-testid="habits-progress-count" className="text-3xl font-bold mt-1">
              {completedCount} / {totalCount}
              <span className="text-lg text-text-muted ml-2">habits completed</span>
            </p>
          </div>
          <div className="text-right">
            <div data-testid="habits-completion-rate" className="text-4xl font-bold text-accent">{completionRate}%</div>
            <p className="text-sm text-text-muted">completion rate</p>
          </div>
        </div>
        {/* Progress Bar */}
        <div data-testid="habits-progress-bar" className="mt-4 h-3 bg-dark-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </Card>

      {/* Top Streaks */}
      {streaks && streaks.length > 0 && (
        <Card data-testid="habits-streaks-card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>🔥</span> Top Streaks
          </h3>
          <div data-testid="habits-streaks-list" className="flex gap-4 overflow-x-auto pb-2">
            {streaks.map((s, index) => (
              <div
                key={s.habitId}
                data-testid={`habit-streak-${index}`}
                className="flex-shrink-0 p-3 bg-dark-bg rounded-lg text-center min-w-[120px]"
              >
                <div className="text-2xl mb-1">{s.lifeArea ? LIFE_AREAS[s.lifeArea]?.icon : '🔄'}</div>
                <div className="text-xl font-bold text-accent">{s.currentStreak}</div>
                <div className="text-xs text-text-muted">day streak</div>
                <div className="text-sm mt-1 truncate">{s.habitTitle}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* View Toggle & Filters */}
      <div data-testid="habits-view-toggle" className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            data-testid="habits-view-today"
            onClick={() => setViewMode('today')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'today' ? 'bg-accent text-white' : 'bg-dark-card hover:bg-dark-card-hover'
            }`}
          >
            Today
          </button>
          <button
            data-testid="habits-view-all"
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'all' ? 'bg-accent text-white' : 'bg-dark-card hover:bg-dark-card-hover'
            }`}
          >
            All Habits
          </button>
        </div>

        {viewMode === 'all' && (
          <div data-testid="habits-area-filter" className="flex gap-2 flex-wrap">
            <button
              data-testid="habits-area-all"
              onClick={() => setSelectedArea(undefined)}
              className={`px-3 py-1 rounded-full text-sm ${
                !selectedArea ? 'bg-accent text-white' : 'bg-dark-card text-text-muted'
              }`}
            >
              All
            </button>
            {Object.values(LIFE_AREAS).map(area => (
              <button
                key={area.key}
                data-testid={`habits-area-${area.key}`}
                onClick={() => setSelectedArea(area.key)}
                className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                  selectedArea === area.key ? 'bg-accent text-white' : 'bg-dark-card text-text-muted'
                }`}
              >
                {area.icon} {area.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Habits List */}
        <div data-testid="habits-list" className="lg:col-span-2 space-y-3">
          {!habits || habits.length === 0 ? (
            <EmptyState
              icon="🔄"
              title={viewMode === 'today' ? "No habits for today" : "No habits yet"}
              description="Create habits to build consistency"
              action={<Button data-testid="habits-empty-create" onClick={() => setShowCreateModal(true)}>Create Habit</Button>}
            />
          ) : (
            habits.map((habit, index) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                index={index}
                isSelected={habit.id === selectedHabitId}
                onClick={() => setSelectedHabitId(habit.id === selectedHabitId ? undefined : habit.id)}
                onComplete={() => completeHabit.mutate({ id: habit.id })}
                isCompleting={completeHabit.isPending}
              />
            ))
          )}
        </div>

        {/* Habit Detail Panel */}
        <div className="space-y-4">
          {selectedHabitId ? (
            <HabitDetailPanel habitId={selectedHabitId} onClose={() => setSelectedHabitId(undefined)} />
          ) : (
            <Card>
              <h3 className="font-semibold mb-3">By Life Area</h3>
              {dashboard?.byArea && Array.isArray(dashboard.byArea) && (
                <div className="space-y-2">
                  {dashboard.byArea.map((areaData: any) => (
                    <div key={areaData.area} className="flex items-center justify-between p-2 bg-dark-bg rounded-lg">
                      <span className="flex items-center gap-2">
                        <span>{areaData.icon}</span>
                        <span className="text-sm">{areaData.name}</span>
                      </span>
                      <span className="text-sm">
                        <span className="text-accent font-semibold">{areaData.activeHabits}</span>
                        <span className="text-text-muted"> habits</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && <CreateHabitModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}

// Habit Card Component
function HabitCard({
  habit,
  index,
  isSelected,
  onClick,
  onComplete,
  isCompleting,
}: {
  habit: Habit;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const area = habit.lifeArea ? LIFE_AREAS[habit.lifeArea] : { icon: '🔄', name: 'General', color: '#6B7280' };

  return (
    <Card
      data-testid={`habit-card-${index}`}
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-accent' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {/* Complete Button */}
        <button
          data-testid={`habit-complete-${index}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!habit.completedToday) onComplete();
          }}
          disabled={habit.completedToday || isCompleting}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            habit.completedToday
              ? 'bg-success border-success text-white'
              : 'border-dark-border hover:border-accent'
          }`}
        >
          {habit.completedToday && '✓'}
        </button>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span>{area.icon}</span>
            <h3 className={`font-semibold ${habit.completedToday ? 'line-through text-text-muted' : ''}`}>
              {habit.title}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-sm text-text-muted mt-1">
            <span>{habit.frequency}</span>
            {habit.timeOfDay && habit.timeOfDay !== 'anytime' && (
              <span className="capitalize">{habit.timeOfDay}</span>
            )}
            {habit.goalTitle && (
              <span className="text-accent">→ {habit.goalTitle}</span>
            )}
          </div>
        </div>

        {/* Streak */}
        <div className="text-right">
          {habit.currentStreak > 0 && (
            <div className="flex items-center gap-1 text-accent">
              <span>🔥</span>
              <span className="font-bold">{habit.currentStreak}</span>
            </div>
          )}
          <div className="text-xs text-text-muted">
            Best: {habit.longestStreak}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Habit Detail Panel
function HabitDetailPanel({ habitId, onClose }: { habitId: string; onClose: () => void }) {
  const { data: habits } = useHabits();
  const habit = habits?.find(h => h.id === habitId);
  const { data: linkedTasks } = useTasksForHabit(habitId);
  const { data: completions } = useHabitCompletions(habitId);

  const deleteHabit = useDeleteHabit();

  if (!habit) return null;

  const area = habit.lifeArea ? LIFE_AREAS[habit.lifeArea] : { icon: '🔄', name: 'General', color: '#6B7280' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${area.color}20` }}
            >
              {area.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">{habit.title}</h2>
              <p className="text-sm text-text-muted">{area.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">✕</button>
        </div>

        {habit.description && (
          <p className="text-text-muted mb-4">{habit.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-3 bg-dark-bg rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{habit.currentStreak}</div>
            <div className="text-xs text-text-muted">Current Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{habit.longestStreak}</div>
            <div className="text-xs text-text-muted">Best Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{completions?.length || 0}</div>
            <div className="text-xs text-text-muted">Total Done</div>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Frequency</span>
            <span className="capitalize">{habit.frequency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Time of Day</span>
            <span className="capitalize">{habit.timeOfDay || 'Anytime'}</span>
          </div>
          {habit.goalTitle && (
            <div className="flex justify-between">
              <span className="text-text-muted">Linked Goal</span>
              <span className="text-accent">{habit.goalTitle}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure you want to delete this habit?')) {
                deleteHabit.mutate(habitId);
                onClose();
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Card>

      {/* Linked Tasks */}
      <Card>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span>✅</span> Linked Tasks
          <Link to="http://localhost:5174" className="text-xs text-accent hover:underline ml-auto">
            Open Tasks →
          </Link>
        </h3>
        {!linkedTasks || linkedTasks.length === 0 ? (
          <p className="text-text-muted text-sm">No linked tasks</p>
        ) : (
          <div className="space-y-2">
            {linkedTasks.map(t => (
              <div key={t.taskId} className="flex items-center justify-between p-2 bg-dark-bg rounded-lg text-sm">
                <span>{t.taskTitle}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  t.taskStatus === 'done' ? 'bg-success/20 text-success' : 'bg-dark-card'
                }`}>
                  {t.taskStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Completions */}
      <Card>
        <h3 className="font-semibold mb-3">Recent Completions</h3>
        {!completions || completions.length === 0 ? (
          <p className="text-text-muted text-sm">No completions yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {completions.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-dark-bg rounded-lg text-sm">
                <span>{new Date(c.completedAt).toLocaleDateString()}</span>
                {c.quality && (
                  <span className="text-accent">{'⭐'.repeat(c.quality)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Create Habit Modal
function CreateHabitModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<CreateHabitInput>({
    title: '',
    lifeArea: 'personal',
    frequency: 'daily',
    timeOfDay: 'morning',
  });

  const createHabit = useCreateHabit();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    createHabit.mutate(formData, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div data-testid="modal-create-habit" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl max-w-lg w-full p-6 animate-slide-up">
        <h2 data-testid="modal-create-habit-title" className="text-xl font-bold mb-4">Create New Habit</h2>

        <form data-testid="habit-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Title</label>
            <input
              type="text"
              data-testid="habit-input-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
              placeholder="e.g., Morning meditation"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Life Area</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(LIFE_AREAS).map(area => (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => setFormData({ ...formData, lifeArea: area.key })}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    formData.lifeArea === area.key
                      ? 'border-accent bg-accent/10'
                      : 'border-dark-border hover:border-accent/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{area.icon}</div>
                  <div className="text-xs">{area.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Frequency</label>
              <select
                data-testid="habit-select-frequency"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as HabitFrequency })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="specific_days">Specific Days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">Time of Day</label>
              <select
                data-testid="habit-select-time"
                value={formData.timeOfDay}
                onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value as any })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="anytime">Anytime</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Description (optional)</label>
            <textarea
              data-testid="habit-input-description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
              placeholder="Add details about this habit..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button data-testid="habit-submit" type="submit" disabled={createHabit.isPending || !formData.title.trim()}>
              {createHabit.isPending ? 'Creating...' : 'Create Habit'}
            </Button>
            <Button data-testid="habit-cancel" type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Habits;
