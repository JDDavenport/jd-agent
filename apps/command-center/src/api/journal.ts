import apiClient from './client';

export interface DailyReview {
  id: string;
  date: string;
  journalText?: string;
  wordCount?: number;
  tasksReviewed: TaskReflection[];
  classesReviewed: ClassReflection[];
  habitsCompletedCount?: number;
  habitsTotalCount?: number;
  goalsReviewedCount?: number;
  tomorrowEventsCount?: number;
  tomorrowTasksCount?: number;
  tags: string[];
  mood?: ReviewMood;
  currentStep: number;
  reviewCompleted: boolean;
  reviewDurationSeconds?: number;
  vaultPageId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ReviewMood = 'great' | 'good' | 'okay' | 'difficult' | 'terrible';

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
  lifeArea?: string;
  timeOfDay?: string;
  goalId?: string;
  goalTitle?: string;
}

export interface GoalsByDomain {
  domain: string;
  icon: string;
  color: string;
  goals: GoalReviewData[];
}

export interface GoalReviewData {
  id: string;
  title: string;
  description?: string;
  progressPercentage: number;
  status: string;
  targetDate?: string;
  motivation?: string;
  associatedHabits: string[];
}

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

export interface ClassReviewData {
  id: string;
  className: string;
  pageId: string;
  pageTitle: string;
  summaryContent?: string;
  keyTakeaways: string[];
  reflectionNote?: string;
}

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
  timeOfDay?: string;
  currentStreak: number;
}

export interface DailyReviewResponse {
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

export interface ReviewHistoryItem {
  id: string;
  date: string;
  createdAt: string;
  journalPreview?: string;
  wordCount?: number;
  mood?: ReviewMood;
  habitsCompletionRate?: number;
  tasksCompleted?: number;
  reviewCompleted: boolean;
  vaultUrl?: string;
}

export interface ReviewHistoryResponse {
  reviews: ReviewHistoryItem[];
  total: number;
  hasMore: boolean;
}

// API Functions
export const getDailyReview = async (date?: string): Promise<DailyReviewResponse> => {
  const params = date ? `?date=${date}` : '';
  return apiClient.get(`/journal/daily-review${params}`);
};

export const saveReviewDraft = async (input: SaveReviewInput): Promise<DailyReview> => {
  return apiClient.post('/journal/daily-review/save', input);
};

export const completeReview = async (input: CompleteReviewInput): Promise<{ review: DailyReview; vaultPageId: string; vaultUrl: string }> => {
  return apiClient.post('/journal/daily-review/complete', input);
};

export const getReviewHistory = async (page: number = 1, limit: number = 20): Promise<ReviewHistoryResponse> => {
  return apiClient.get(`/journal/daily-review/history?page=${page}&limit=${limit}`);
};

export const searchReviews = async (query: string): Promise<ReviewHistoryItem[]> => {
  return apiClient.get(`/journal/daily-review/search?q=${encodeURIComponent(query)}`);
};

export const toggleHabitCompletion = async (habitId: string, date?: string): Promise<HabitReviewData> => {
  const params = date ? `?date=${date}` : '';
  return apiClient.post(`/journal/habits/${habitId}/toggle${params}`, {});
};

export const MOOD_CONFIG: Record<ReviewMood, { emoji: string; label: string; color: string }> = {
  great: { emoji: '😄', label: 'Great', color: '#10B981' },
  good: { emoji: '🙂', label: 'Good', color: '#3B82F6' },
  okay: { emoji: '😐', label: 'Okay', color: '#F59E0B' },
  difficult: { emoji: '😔', label: 'Difficult', color: '#EF4444' },
  terrible: { emoji: '😢', label: 'Terrible', color: '#7F1D1D' },
};
