// Life Areas
export type LifeArea = 'spiritual' | 'personal' | 'fitness' | 'family' | 'professional' | 'school';

export interface LifeAreaInfo {
  key: LifeArea;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const LIFE_AREAS: Record<LifeArea, LifeAreaInfo> = {
  spiritual: { key: 'spiritual', name: 'Spiritual', icon: '🙏', color: '#8B5CF6', description: 'Faith, meditation, purpose' },
  personal: { key: 'personal', name: 'Personal', icon: '🧠', color: '#3B82F6', description: 'Self-improvement, hobbies' },
  fitness: { key: 'fitness', name: 'Fitness', icon: '💪', color: '#10B981', description: 'Health, exercise, nutrition' },
  family: { key: 'family', name: 'Family', icon: '👨‍👩‍👧‍👦', color: '#F59E0B', description: 'Relationships, community' },
  professional: { key: 'professional', name: 'Professional', icon: '💼', color: '#6366F1', description: 'Career, business, income' },
  school: { key: 'school', name: 'School', icon: '🎓', color: '#EC4899', description: 'Education, certifications' },
};

// Goals
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type GoalType = 'achievement' | 'maintenance' | 'growth';
export type MetricType = 'boolean' | 'numeric' | 'percentage' | 'milestone';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  lifeArea: LifeArea;
  status: GoalStatus;
  goalType: GoalType;
  metricType: MetricType;
  targetValue?: number;
  currentValue?: number;
  progressPercentage: number;
  healthScore: number;
  motivation?: string;
  vision?: string;
  startDate?: string;
  targetDate?: string;
  completedAt?: Date;
  vaultEntryId?: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  milestones?: Milestone[];
  habits?: Habit[];
  reflections?: Reflection[];
  linkedTasks?: LinkedTask[];
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  lifeArea: LifeArea;
  goalType: GoalType;
  metricType: MetricType;
  targetValue?: number;
  motivation?: string;
  vision?: string;
  startDate?: string;
  targetDate?: string;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  lifeArea?: LifeArea;
  goalType?: GoalType;
  targetValue?: number;
  currentValue?: number;
  progressPercentage?: number;
  motivation?: string;
  vision?: string;
  targetDate?: string;
}

// Milestones
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  status: MilestoneStatus;
  orderIndex: number;
  targetDate?: string;
  completedAt?: Date;
  evidence?: string;
  createdAt: Date;
}

export interface CreateMilestoneInput {
  goalId: string;
  title: string;
  description?: string;
  targetDate?: string;
  orderIndex?: number;
}

// Habits
export type HabitFrequency = 'daily' | 'weekly' | 'specific_days';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  lifeArea?: LifeArea | null;
  frequency: HabitFrequency;
  specificDays?: string[];
  timeOfDay: TimeOfDay;
  currentStreak: number;
  longestStreak: number;
  isActive: boolean;
  goalId?: string;
  goalTitle?: string;
  lastCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Today's status
  completedToday?: boolean;
  todayCompletion?: HabitCompletion;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedAt: Date;
  quality?: number;
  durationMinutes?: number;
  notes?: string;
}

export interface CreateHabitInput {
  title: string;
  description?: string;
  lifeArea: LifeArea;
  frequency: HabitFrequency;
  specificDays?: string[];
  timeOfDay?: TimeOfDay;
  goalId?: string;
}

export interface CompleteHabitInput {
  quality?: number;
  durationMinutes?: number;
  notes?: string;
}

// Reflections
export type ReflectionType = 'progress' | 'obstacle' | 'win' | 'adjustment';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface Reflection {
  id: string;
  goalId: string;
  goalTitle?: string;
  content: string;
  reflectionType: ReflectionType;
  sentiment?: Sentiment;
  createdAt: Date;
}

export interface CreateReflectionInput {
  content: string;
  reflectionType: ReflectionType;
}

// Linked items
export interface LinkedTask {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  linkType: 'action' | 'milestone' | 'checkin';
  milestoneId?: string;
  milestoneTitle?: string;
}

export interface LinkedVaultEntry {
  id: string;
  title: string;
  contentType: string;
  createdAt: Date;
}

// Progress Dashboard
export interface ProgressOverview {
  goals: {
    total: number;
    active: number;
    completed: number;
    averageProgress: number;
    averageHealth: number;
  };
  habits: {
    total: number;
    active: number;
    completedToday: number;
    totalDueToday: number;
    completionRate: number;
  };
  alerts: Array<{
    goalId: string;
    goalTitle: string;
    lifeArea: LifeArea;
    healthScore: number;
    issue: string;
  }>;
  upcoming: Array<{
    milestoneId: string;
    milestoneTitle: string;
    goalTitle: string;
    targetDate: string;
    daysUntil: number;
  }>;
  topStreaks: Array<{
    habitId: string;
    habitTitle: string;
    currentStreak: number;
    lifeArea: LifeArea;
  }>;
}

export interface LifeAreaProgress {
  area: LifeAreaInfo;
  goals: {
    total: number;
    active: number;
    averageProgress: number;
  };
  habits: {
    total: number;
    completedToday: number;
  };
  recentReflections: Reflection[];
}

export interface GoalHealthReport {
  goalId: string;
  healthScore: number;
  breakdown: {
    progressScore: number;
    habitsScore: number;
    milestonesScore: number;
    activityScore: number;
  };
  suggestions: string[];
}

// Filters
export interface GoalFilters {
  status?: GoalStatus;
  lifeArea?: LifeArea;
}

export interface HabitFilters {
  lifeArea?: LifeArea;
  isActive?: boolean;
  goalId?: string;
}
