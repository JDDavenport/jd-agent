import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import type { Task, Book, Chapter, Flashcard, SummaryLength } from '../types';

// MBA Course contexts to filter for school tasks
// Note: Include both with and without space since Canvas uses "MBA 664" format
const SCHOOL_CONTEXTS = [
  'mba560', 'mba 560', 'mba580', 'mba 580', 'mba654', 'mba 654', 
  'mba664', 'mba 664', 'mba677', 'mba 677', 'mba693r', 'mba 693r',
  'school', 'preclass', 'class', 'homework', 'assignment', 'reading', 'quiz',
  'canvas', 'entrepreneurial', 'innovation', 'venture capital', 'private equity',
  'analytics', 'strategy', 'career'
];

// ============================================
// Tasks Hooks
// ============================================

export function useSchoolTasks() {
  return useQuery({
    queryKey: ['tasks', 'school'],
    queryFn: async () => {
      const tasks = await api.getTasks();
      // Filter for school-related tasks
      return tasks.filter((task) => {
        const context = task.context?.toLowerCase() || '';
        const labels = task.taskLabels || [];
        const source = task.source;
        
        // Include if:
        // 1. Context matches school patterns
        // 2. Source is 'canvas'
        // 3. Has preclass/school labels
        return (
          source === 'canvas' ||
          SCHOOL_CONTEXTS.some(sc => context.includes(sc.toLowerCase())) ||
          labels.some(label => 
            label.toLowerCase().includes('school') || 
            label.toLowerCase().includes('preclass') ||
            label.toLowerCase().includes('mba')
          )
        );
      });
    },
  });
}

export function useTodayTasks() {
  return useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: api.getTodayTasks,
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) =>
      api.updateTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ============================================
// Books Hooks
// ============================================

export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    queryFn: api.getBooks,
  });
}

export function useBook(bookId: string) {
  return useQuery({
    queryKey: ['books', bookId],
    queryFn: () => api.getBook(bookId),
    enabled: !!bookId,
  });
}

export function useChapters(bookId: string) {
  return useQuery({
    queryKey: ['chapters', bookId],
    queryFn: () => api.getChapters(bookId),
    enabled: !!bookId,
  });
}

export function useChapter(chapterId: string) {
  return useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => api.getChapter(chapterId),
    enabled: !!chapterId,
  });
}

// ============================================
// Summary Hooks
// ============================================

export function useSummary(chapterId: string, length: SummaryLength) {
  return useQuery({
    queryKey: ['summary', chapterId, length],
    queryFn: () => api.getChapterSummary(chapterId, length),
    enabled: !!chapterId,
    staleTime: 1000 * 60 * 30, // 30 minutes - summaries don't change often
  });
}

export function useRegenerateSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, length }: { chapterId: string; length: SummaryLength }) =>
      api.regenerateSummary(chapterId, length),
    onSuccess: (_, { chapterId, length }) => {
      queryClient.invalidateQueries({ queryKey: ['summary', chapterId, length] });
    },
  });
}

// ============================================
// Key Concepts Hook
// ============================================

export function useKeyConcepts(chapterId: string) {
  return useQuery({
    queryKey: ['concepts', chapterId],
    queryFn: () => api.getKeyConcepts(chapterId),
    enabled: !!chapterId,
  });
}

// ============================================
// Chat Hook
// ============================================

export function useChat() {
  return useMutation({
    mutationFn: ({
      bookId,
      message,
      chapterId,
      conversationId,
    }: {
      bookId: string;
      message: string;
      chapterId?: string;
      conversationId?: string;
    }) => api.chatAboutBook(bookId, message, { chapterId, conversationId }),
  });
}

// ============================================
// Flashcards Hooks
// ============================================

export function useDueFlashcards(bookId?: string) {
  return useQuery({
    queryKey: ['flashcards', 'due', bookId],
    queryFn: () => api.getDueFlashcards(bookId),
  });
}

export function useGenerateFlashcards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, count }: { chapterId: string; count?: number }) =>
      api.generateFlashcards(chapterId, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
  });
}

export function useReviewFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, quality }: { cardId: string; quality: 0 | 1 | 2 | 3 | 4 | 5 }) =>
      api.reviewFlashcard(cardId, quality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
  });
}

// ============================================
// Quiz Hooks
// ============================================

export function useGenerateQuiz() {
  return useMutation({
    mutationFn: ({
      chapterId,
      questionCount,
      difficulty,
    }: {
      chapterId: string;
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
    }) => api.generateQuiz(chapterId, { questionCount, difficulty }),
  });
}

export function useSubmitQuiz() {
  return useMutation({
    mutationFn: ({
      quizId,
      answers,
    }: {
      quizId: string;
      answers: Array<{ questionId: string; answer: string }>;
    }) => api.submitQuiz(quizId, answers),
  });
}

// ============================================
// Progress Hooks
// ============================================

export function useReadingProgress(bookId: string) {
  return useQuery({
    queryKey: ['progress', bookId],
    queryFn: () => api.getReadingProgress(bookId),
    enabled: !!bookId,
  });
}

export function useUpdateReadingProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookId,
      currentPage,
      minutesRead,
    }: {
      bookId: string;
      currentPage?: number;
      minutesRead?: number;
    }) => api.updateReadingProgress(bookId, { currentPage, minutesRead }),
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: ['progress', bookId] });
    },
  });
}

// ============================================
// Calendar Hooks
// ============================================

export function useCalendarEvents() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: api.getCalendarEvents,
  });
}

export function useTodayEvents() {
  return useQuery({
    queryKey: ['calendar', 'today'],
    queryFn: api.getTodayEvents,
  });
}

// ============================================
// Search Hook
// ============================================

export function useSearch(query: string, bookId?: string) {
  return useQuery({
    queryKey: ['search', query, bookId],
    queryFn: () => api.searchBooks(query, { bookId }),
    enabled: query.length >= 2,
  });
}

// ============================================
// Course Materials Hooks (Canvas)
// ============================================

export function useCourseMaterials(courseId?: string) {
  return useQuery({
    queryKey: ['courseMaterials', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      return await api.getCourseMaterials(courseId);
    },
    enabled: !!courseId,
    retry: false,
  });
}

export function useMaterialsByCanvasCourseId(canvasCourseId?: string) {
  return useQuery({
    queryKey: ['courseMaterials', 'canvas', canvasCourseId],
    queryFn: async () => {
      if (!canvasCourseId) return [];
      return await api.getMaterialsByCanvasCourseId(canvasCourseId);
    },
    enabled: !!canvasCourseId,
    retry: false,
  });
}

// ============================================
// Video Hooks
// ============================================

export function useVideos(canvasCourseId?: string) {
  return useQuery({
    queryKey: ['videos', canvasCourseId],
    queryFn: async () => {
      try {
        return await api.getVideos({ canvasCourseId, archived: false });
      } catch {
        // Videos table may not exist - return empty array
        return [];
      }
    },
    retry: false, // Don't retry on failure
  });
}

export function useVideo(videoId: string) {
  return useQuery({
    queryKey: ['video', videoId],
    queryFn: () => api.getVideo(videoId),
    enabled: !!videoId,
  });
}

export function useVideoSummary(videoId: string, length: 'short' | 'medium' | 'long') {
  return useQuery({
    queryKey: ['videoSummary', videoId, length],
    queryFn: () => api.getVideoSummary(videoId, length),
    enabled: !!videoId,
    staleTime: 1000 * 60 * 30, // 30 minutes - summaries don't change often
  });
}

export function useAddVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      url,
      canvasCourseId,
      tags,
    }: {
      url: string;
      canvasCourseId?: string;
      tags?: string[];
    }) => api.addVideo(url, { canvasCourseId, tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

export function useReprocessVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => api.reprocessVideo(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: ['video', videoId] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// ============================================
// Lecture Hooks
// ============================================

export function useLectures(courseId: string) {
  return useQuery({
    queryKey: ['lectures', courseId],
    queryFn: () => api.getLectures(courseId),
    enabled: !!courseId,
    retry: false,
  });
}

export function useLecture(courseId: string, lectureId: string) {
  return useQuery({
    queryKey: ['lecture', courseId, lectureId],
    queryFn: () => api.getLecture(courseId, lectureId),
    enabled: !!courseId && !!lectureId,
  });
}

// ============================================
// Remarkable Notes Hooks
// ============================================

export function useRemarkableNotes(courseId: string) {
  return useQuery({
    queryKey: ['remarkable', courseId],
    queryFn: () => api.getRemarkableNotes(courseId),
    enabled: !!courseId,
    retry: false,
  });
}

// ============================================
// Tasks Hooks (additional)
// ============================================

export function useReopenTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reopenTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
