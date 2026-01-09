import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGoals,
  useGoalsByLifeArea,
  useGoalsNeedingAttention,
  useCreateGoal,
  usePauseGoal,
  useResumeGoal,
  useCompleteGoal,
  useTasksForGoal,
  useVaultEntriesForGoal,
  useExportGoalJourney,
  useMilestones,
  useCompleteMilestone,
  useCreateMilestone,
  useReflections,
  useCreateReflection,
  useHabits,
  useCreateHabit,
  useCompleteHabit,
  useLinkTaskToGoal,
} from '../hooks/useGoals';
import { LIFE_AREAS, type LifeArea, type GoalStatus, type Goal, type CreateGoalInput, type ReflectionType, type HabitFrequency, type TimeOfDay } from '../types/goals';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';

function Goals() {
  const [selectedArea, setSelectedArea] = useState<LifeArea | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<GoalStatus | undefined>('active');
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: goals, isLoading: goalsLoading } = useGoals({ lifeArea: selectedArea, status: selectedStatus });
  const { data: areaStats } = useGoalsByLifeArea();
  const { data: alertGoals } = useGoalsNeedingAttention();

  const selectedGoal = goals?.find(g => g.id === selectedGoalId);

  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Goals
          </h1>
          <p className="text-text-muted mt-1">Track your goals across all life areas</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>+ New Goal</Button>
      </div>

      {/* Alerts */}
      {alertGoals && alertGoals.length > 0 && (
        <Card className="border-warning/50 bg-warning/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-warning text-lg">⚠️</span>
            <h3 className="font-semibold text-warning">Goals Needing Attention</h3>
          </div>
          <div className="space-y-2">
            {alertGoals.slice(0, 3).map(goal => (
              <div
                key={goal.id}
                className="flex items-center justify-between p-2 rounded bg-dark-bg cursor-pointer hover:bg-dark-card-hover"
                onClick={() => setSelectedGoalId(goal.id)}
              >
                <span className="flex items-center gap-2">
                  <span>{LIFE_AREAS[goal.lifeArea].icon}</span>
                  <span>{goal.title}</span>
                </span>
                <span className="text-sm text-warning">Health: {goal.healthScore}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Life Area Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedArea(undefined)}
          className={`px-4 py-2 rounded-lg transition-all ${
            !selectedArea ? 'bg-accent text-white' : 'bg-dark-card hover:bg-dark-card-hover text-text-muted'
          }`}
        >
          All Areas
        </button>
        {Object.values(LIFE_AREAS).map(area => (
          <button
            key={area.key}
            onClick={() => setSelectedArea(area.key)}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              selectedArea === area.key
                ? 'text-white'
                : 'bg-dark-card hover:bg-dark-card-hover text-text-muted'
            }`}
            style={selectedArea === area.key ? { backgroundColor: area.color } : {}}
          >
            <span>{area.icon}</span>
            <span>{area.name}</span>
            {areaStats?.areas?.[area.key] && (
              <span className="text-xs opacity-75">({areaStats.areas[area.key].active})</span>
            )}
          </button>
        ))}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {(['active', 'paused', 'completed', 'abandoned'] as GoalStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status === selectedStatus ? undefined : status)}
            className={`px-3 py-1 rounded-full text-sm transition-all ${
              selectedStatus === status
                ? 'bg-accent text-white'
                : 'bg-dark-card hover:bg-dark-card-hover text-text-muted'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goals List */}
        <div className="lg:col-span-2 space-y-4">
          {!goals || goals.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No goals yet"
              description="Create your first goal to start tracking your progress"
              action={<Button onClick={() => setShowCreateModal(true)}>Create Goal</Button>}
            />
          ) : (
            goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isSelected={goal.id === selectedGoalId}
                onClick={() => setSelectedGoalId(goal.id === selectedGoalId ? undefined : goal.id)}
              />
            ))
          )}
        </div>

        {/* Goal Detail Panel */}
        <div className="space-y-4">
          {selectedGoal ? (
            <GoalDetailPanel goalId={selectedGoal.id} onClose={() => setSelectedGoalId(undefined)} />
          ) : (
            <Card className="text-center py-8">
              <p className="text-text-muted">Select a goal to see details</p>
            </Card>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && <CreateGoalModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}

// Goal Card Component
function GoalCard({ goal, isSelected, onClick }: { goal: Goal; isSelected: boolean; onClick: () => void }) {
  const area = LIFE_AREAS[goal.lifeArea];

  return (
    <Card
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-accent' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: `${area.color}20` }}
          >
            {area.icon}
          </div>
          <div>
            <h3 className="font-semibold">{goal.title}</h3>
            <p className="text-sm text-text-muted">{area.name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{goal.progressPercentage}%</div>
          <div className={`text-xs ${goal.healthScore >= 70 ? 'text-success' : goal.healthScore >= 40 ? 'text-warning' : 'text-error'}`}>
            Health: {goal.healthScore}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2 bg-dark-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${goal.progressPercentage}%`, backgroundColor: area.color }}
        />
      </div>

      {/* Meta */}
      <div className="mt-3 flex items-center justify-between text-sm text-text-muted">
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          goal.status === 'active' ? 'bg-success/20 text-success' :
          goal.status === 'paused' ? 'bg-warning/20 text-warning' :
          goal.status === 'completed' ? 'bg-accent/20 text-accent' : 'bg-dark-bg'
        }`}>
          {goal.status}
        </span>
        {goal.targetDate && (
          <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
        )}
      </div>
    </Card>
  );
}

// Goal Detail Panel
function GoalDetailPanel({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const [showReflectionForm, setShowReflectionForm] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [reflectionContent, setReflectionContent] = useState('');
  const [reflectionType, setReflectionType] = useState<ReflectionType>('progress');
  const [habitTitle, setHabitTitle] = useState('');
  const [habitFrequency, setHabitFrequency] = useState<HabitFrequency>('daily');
  const [habitTimeOfDay, setHabitTimeOfDay] = useState<TimeOfDay>('morning');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [taskTitle, setTaskTitle] = useState('');

  const { data: goals } = useGoals();
  const goal = goals?.find(g => g.id === goalId);
  const { data: milestones } = useMilestones(goalId);
  const { data: linkedTasks } = useTasksForGoal(goalId);
  const { data: vaultEntries } = useVaultEntriesForGoal(goalId);
  const { data: reflections } = useReflections(goalId);
  const { data: allHabits } = useHabits({ goalId });

  const pauseGoal = usePauseGoal();
  const resumeGoal = useResumeGoal();
  const completeGoal = useCompleteGoal();
  const exportJourney = useExportGoalJourney();
  const completeMilestone = useCompleteMilestone();
  const createMilestone = useCreateMilestone();
  const createReflection = useCreateReflection();
  const createHabit = useCreateHabit();
  const completeHabit = useCompleteHabit();
  const linkTask = useLinkTaskToGoal();

  if (!goal) return null;

  const area = LIFE_AREAS[goal.lifeArea];
  const goalHabits = allHabits?.filter(h => h.goalId === goalId) || [];

  const handleCreateReflection = () => {
    if (!reflectionContent.trim()) return;
    createReflection.mutate({
      goalId,
      data: { content: reflectionContent, reflectionType },
    }, {
      onSuccess: () => {
        setReflectionContent('');
        setShowReflectionForm(false);
      },
    });
  };

  const handleCreateHabit = () => {
    if (!habitTitle.trim()) return;
    createHabit.mutate({
      title: habitTitle,
      lifeArea: goal.lifeArea,
      frequency: habitFrequency,
      timeOfDay: habitTimeOfDay,
      goalId: goalId,
    }, {
      onSuccess: () => {
        setHabitTitle('');
        setShowHabitForm(false);
      },
    });
  };

  const handleCreateMilestone = () => {
    if (!milestoneTitle.trim()) return;
    createMilestone.mutate({
      goalId,
      title: milestoneTitle,
      targetDate: milestoneDate || undefined,
    }, {
      onSuccess: () => {
        setMilestoneTitle('');
        setMilestoneDate('');
        setShowMilestoneForm(false);
      },
    });
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      // Create task via API and link it to the goal
      const response = await fetch('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          status: 'inbox',
          sourceType: 'goal',
          sourceId: goalId,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        // Link the task to the goal
        linkTask.mutate({ taskId: data.id, goalId });
        setTaskTitle('');
        setShowTaskForm(false);
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

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
              <h2 className="text-xl font-bold">{goal.title}</h2>
              <p className="text-sm text-text-muted">{area.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">✕</button>
        </div>

        {goal.description && (
          <p className="text-text-muted mb-4">{goal.description}</p>
        )}

        {goal.motivation && (
          <div className="mb-4 p-3 bg-dark-bg rounded-lg">
            <span className="text-xs text-text-muted">Motivation</span>
            <p className="text-sm">{goal.motivation}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {goal.status === 'active' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => pauseGoal.mutate(goalId)}>
                Pause
              </Button>
              <Button size="sm" onClick={() => completeGoal.mutate(goalId)}>
                Complete
              </Button>
            </>
          )}
          {goal.status === 'paused' && (
            <Button size="sm" onClick={() => resumeGoal.mutate(goalId)}>
              Resume
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportJourney.mutate(goalId)}
            disabled={exportJourney.isPending}
          >
            {exportJourney.isPending ? 'Exporting...' : 'Export to Vault'}
          </Button>
        </div>
      </Card>

      {/* Milestones */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span>🏁</span> Milestones
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setShowMilestoneForm(!showMilestoneForm)}>
            + Add
          </Button>
        </div>

        {showMilestoneForm && (
          <div className="mb-4 p-3 bg-dark-bg rounded-lg space-y-3">
            <input
              type="text"
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              placeholder="Milestone title..."
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              autoFocus
            />
            <input
              type="date"
              value={milestoneDate}
              onChange={(e) => setMilestoneDate(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateMilestone} disabled={createMilestone.isPending}>
                Add Milestone
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowMilestoneForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!milestones || milestones.length === 0 ? (
          <p className="text-text-muted text-sm">No milestones yet</p>
        ) : (
          <div className="space-y-2">
            {milestones.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2 bg-dark-bg rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className={m.status === 'completed' ? 'text-success' : 'text-text-muted'}>
                    {m.status === 'completed' ? '✓' : m.status === 'in_progress' ? '◐' : '○'}
                  </span>
                  <div>
                    <span className={m.status === 'completed' ? 'line-through text-text-muted' : ''}>
                      {m.title}
                    </span>
                    {m.targetDate && (
                      <div className="text-xs text-text-muted">
                        Due: {new Date(m.targetDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                {m.status !== 'completed' && m.status !== 'skipped' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeMilestone.mutate({ id: m.id });
                    }}
                  >
                    Complete
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Habits */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span>🔄</span> Habits
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setShowHabitForm(!showHabitForm)}>
            + Add
          </Button>
        </div>

        {showHabitForm && (
          <div className="mb-4 p-3 bg-dark-bg rounded-lg space-y-3">
            <input
              type="text"
              value={habitTitle}
              onChange={(e) => setHabitTitle(e.target.value)}
              placeholder="Habit title..."
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={habitFrequency}
                onChange={(e) => setHabitFrequency(e.target.value as HabitFrequency)}
                className="bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="specific_days">Specific Days</option>
              </select>
              <select
                value={habitTimeOfDay}
                onChange={(e) => setHabitTimeOfDay(e.target.value as TimeOfDay)}
                className="bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="anytime">Anytime</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateHabit} disabled={createHabit.isPending}>
                Add Habit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowHabitForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {goalHabits.length === 0 ? (
          <p className="text-text-muted text-sm">No habits linked to this goal</p>
        ) : (
          <div className="space-y-2">
            {goalHabits.map(h => (
              <div
                key={h.id}
                className="flex items-center justify-between p-2 bg-dark-bg rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => !h.completedToday && completeHabit.mutate({ id: h.id })}
                    disabled={h.completedToday}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                      h.completedToday ? 'bg-success border-success text-white' : 'border-dark-border hover:border-accent'
                    }`}
                  >
                    {h.completedToday && '✓'}
                  </button>
                  <div>
                    <span className={h.completedToday ? 'line-through text-text-muted' : ''}>{h.title}</span>
                    <div className="text-xs text-text-muted">{h.frequency} • {h.timeOfDay}</div>
                  </div>
                </div>
                {h.currentStreak > 0 && (
                  <span className="text-accent text-sm">🔥 {h.currentStreak}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Linked Tasks */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span>✅</span> Linked Tasks
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTaskForm(!showTaskForm)}>
              + Add
            </Button>
            <a
              href="http://localhost:5174"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Open Tasks →
            </a>
          </div>
        </div>

        {showTaskForm && (
          <div className="mb-4 p-3 bg-dark-bg rounded-lg space-y-3">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateTask}>
                Add Task
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowTaskForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!linkedTasks || linkedTasks.length === 0 ? (
          <p className="text-text-muted text-sm">No linked tasks</p>
        ) : (
          <div className="space-y-2">
            {linkedTasks.slice(0, 5).map(t => (
              <div key={t.taskId} className="flex items-center justify-between p-2 bg-dark-bg rounded-lg text-sm">
                <span className={t.taskStatus === 'done' ? 'line-through text-text-muted' : ''}>
                  {t.taskTitle}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  t.taskStatus === 'done' ? 'bg-success/20 text-success' :
                  t.taskStatus === 'today' ? 'bg-accent/20 text-accent' : 'bg-dark-card'
                }`}>
                  {t.taskStatus}
                </span>
              </div>
            ))}
            {linkedTasks.length > 5 && (
              <p className="text-xs text-text-muted text-center">+{linkedTasks.length - 5} more</p>
            )}
          </div>
        )}
      </Card>

      {/* Vault Entries */}
      <Card>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span>📚</span> Vault Entries
          <Link to="http://localhost:5175" className="text-xs text-accent hover:underline ml-auto">
            Open Vault →
          </Link>
        </h3>
        {!vaultEntries || vaultEntries.length === 0 ? (
          <p className="text-text-muted text-sm">No vault entries</p>
        ) : (
          <div className="space-y-2">
            {vaultEntries.map(e => (
              <div key={e.id} className="p-2 bg-dark-bg rounded-lg text-sm">
                <span>{e.title}</span>
                <span className="text-xs text-text-muted ml-2">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reflections */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <span>📝</span> Reflections
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setShowReflectionForm(!showReflectionForm)}>
            + Add
          </Button>
        </div>

        {showReflectionForm && (
          <div className="mb-4 p-3 bg-dark-bg rounded-lg space-y-3">
            <select
              value={reflectionType}
              onChange={(e) => setReflectionType(e.target.value as ReflectionType)}
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm"
            >
              <option value="progress">📈 Progress Update</option>
              <option value="win">🏆 Win</option>
              <option value="obstacle">🚧 Obstacle</option>
              <option value="adjustment">🔄 Adjustment</option>
            </select>
            <textarea
              value={reflectionContent}
              onChange={(e) => setReflectionContent(e.target.value)}
              placeholder="Write your reflection..."
              className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 text-sm min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateReflection} disabled={createReflection.isPending}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowReflectionForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!reflections || reflections.length === 0 ? (
          <p className="text-text-muted text-sm">No reflections yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {reflections.slice(0, 5).map(r => (
              <div key={r.id} className="p-2 bg-dark-bg rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span>
                    {r.reflectionType === 'win' ? '🏆' :
                     r.reflectionType === 'obstacle' ? '🚧' :
                     r.reflectionType === 'adjustment' ? '🔄' : '📈'}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-text-muted">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Create Goal Modal
function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<CreateGoalInput>({
    title: '',
    lifeArea: 'personal',
    goalType: 'achievement',
    metricType: 'milestone',
  });

  const createGoal = useCreateGoal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    createGoal.mutate(formData, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card border border-dark-border rounded-xl max-w-lg w-full p-6 animate-slide-up">
        <h2 className="text-xl font-bold mb-4">Create New Goal</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
              placeholder="What do you want to achieve?"
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

          <div>
            <label className="block text-sm text-text-muted mb-1">Description (optional)</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 min-h-[80px]"
              placeholder="Describe your goal..."
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Motivation (optional)</label>
            <textarea
              value={formData.motivation || ''}
              onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
              placeholder="Why is this goal important to you?"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Target Date (optional)</label>
            <input
              type="date"
              value={formData.targetDate || ''}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={createGoal.isPending || !formData.title.trim()}>
              {createGoal.isPending ? 'Creating...' : 'Create Goal'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Goals;
