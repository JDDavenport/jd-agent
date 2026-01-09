// ============================================
// DAILY JOURNAL & REVIEW TYPES
// ============================================

// Mood options for daily review (5-level scale)
export type ReviewMood = 'great' | 'good' | 'okay' | 'difficult' | 'terrible';

// Life areas for grouping goals
export type LifeArea = 'spiritual' | 'personal' | 'fitness' | 'family' | 'professional' | 'school';

// ============================================
// CORE ENTITIES
// ============================================

export interface DailyReview {
  id: string;
  date: string; // YYYY-MM-DD format

  // Legacy fields
  tasksPlanned?: number;
  tasksCompleted?: number;
  tasksAdded?: number;
  inboxStart?: number;
  inboxEnd?: number;
  reflection?: string;

  // Journal entry (Step 3)
  journalText?: string;
  wordCount?: number;

  // Reviewed items (Step 4 & 5)
  tasksReviewed: TaskReflection[];
  classesReviewed: ClassReflection[];

  // Metrics
  habitsCompletedCount?: number;
  habitsTotalCount?: number;
  goalsReviewedCount?: number;
  tomorrowEventsCount?: number;
  tomorrowTasksCount?: number;

  // User metadata
  tags: string[];
  mood?: ReviewMood;

  // Progress tracking
  currentStep: number; // 1-7
  reviewCompleted: boolean;
  reviewDurationSeconds?: number;

  // Vault integration
  vaultPageId?: string;

  // Timestamps
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskReflection {
  taskId: string;
  taskTitle: string;
  completedAt?: string;
  projectName?: string;
  reflectionNote?: string;
}

export interface ClassReflection {
  classId: string;
  className: string;
  pageId?: string;
  reflectionNote?: string;
}

// ============================================
// STEP 1: HABITS REVIEW
// ============================================

export interface HabitReviewData {
  id: string;
  title: string;
  description?: string;
  completedToday: boolean;
  completedCount: number;
  targetPerDay: number;
  currentStreak: number;
  longestStreak: number;
  isDueToday: boolean;
  streakStatus: 'active' | 'at_risk' | 'broken';
  lifeArea?: LifeArea;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  goalId?: string;
  goalTitle?: string;
}

// ============================================
// STEP 2: GOALS REVIEW
// ============================================

export interface GoalsByDomain {
  domain: LifeArea;
  icon: string;
  color: string;
  goals: GoalReviewData[];
}

export interface GoalReviewData {
  id: string;
  title: string;
  description?: string;
  progressPercentage: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  targetDate?: string;
  motivation?: string;
  associatedHabits: string[]; // habit IDs
}

// ============================================
// STEP 4: TASKS REVIEW
// ============================================

export interface TaskReviewData {
  id: string;
  title: string;
  description?: string;
  completedAt: string;
  projectId?: string;
  projectName?: string;
  context?: string;
  reflectionNote?: string;
}

// ============================================
// STEP 5: CLASSES REVIEW
// ============================================

export interface ClassReviewData {
  id: string;
  className: string;
  pageId: string;
  pageTitle: string;
  summaryContent?: string;
  keyTakeaways: string[];
  reflectionNote?: string;
}

// ============================================
// STEP 6: TOMORROW PREVIEW
// ============================================

export interface TomorrowPreviewData {
  events: TomorrowEvent[];
  tasks: TomorrowTask[];
  habits: TomorrowHabit[];
}

export interface TomorrowEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  eventType?: string;
}

export interface TomorrowTask {
  id: string;
  title: string;
  dueDate?: string;
  priority: number;
  projectName?: string;
  context?: string;
}

export interface TomorrowHabit {
  id: string;
  title: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  currentStreak: number;
}

// ============================================
// API INPUTS
// ============================================

export interface GetDailyReviewResponse {
  review: DailyReview;
  habits: HabitReviewData[];
  goals: GoalsByDomain[];
  completedTasks: TaskReviewData[];
  classNotes: ClassReviewData[];
  tomorrowPreview: TomorrowPreviewData;
}

export interface SaveReviewInput {
  id: string;
  journalText?: string;
  mood?: ReviewMood;
  tags?: string[];
  tasksReviewed?: TaskReflection[];
  classesReviewed?: ClassReflection[];
  currentStep?: number;
}

export interface CompleteReviewInput {
  id: string;
  journalText: string;
  mood: ReviewMood;
  tags: string[];
  reviewDurationSeconds: number;
}

export interface CompleteReviewResponse {
  review: DailyReview;
  vaultPageId: string;
  vaultUrl: string;
}

export interface ReviewHistoryResponse {
  reviews: ReviewHistoryItem[];
  total: number;
  hasMore: boolean;
}

export interface ReviewHistoryItem {
  id: string;
  date: string;
  createdAt: string;
  journalPreview?: string; // First 200 chars
  wordCount?: number;
  mood?: ReviewMood;
  habitsCompletionRate?: number;
  tasksCompleted?: number;
  reviewCompleted: boolean;
  vaultUrl?: string;
}

export interface ReviewSearchResult {
  reviewId: string;
  date: string;
  matchingText: string;
  wordCount?: number;
  vaultUrl?: string;
}

// ============================================
// LIFE AREA CONSTANTS
// ============================================

export const LIFE_AREA_CONFIG: Record<LifeArea, { icon: string; color: string; label: string }> = {
  spiritual: { icon: '🙏', color: '#8B5CF6', label: 'Spiritual' },
  personal: { icon: '🧠', color: '#3B82F6', label: 'Personal' },
  fitness: { icon: '💪', color: '#10B981', label: 'Fitness' },
  family: { icon: '👨‍👩‍👧‍👦', color: '#F59E0B', label: 'Family' },
  professional: { icon: '💼', color: '#6366F1', label: 'Professional' },
  school: { icon: '🎓', color: '#EC4899', label: 'School' },
};

// ============================================
// MOOD CONSTANTS
// ============================================

export const MOOD_CONFIG: Record<ReviewMood, { emoji: string; label: string; color: string }> = {
  great: { emoji: '😄', label: 'Great', color: '#10B981' },
  good: { emoji: '🙂', label: 'Good', color: '#3B82F6' },
  okay: { emoji: '😐', label: 'Okay', color: '#F59E0B' },
  difficult: { emoji: '😔', label: 'Difficult', color: '#EF4444' },
  terrible: { emoji: '😢', label: 'Terrible', color: '#7F1D1D' },
};
