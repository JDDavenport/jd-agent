import type {
  Task,
  Book,
  Chapter,
  Flashcard,
  ReadingProgress,
  CalendarEvent,
  SummaryLength,
  Video,
} from './types';

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data as T;
}

// ============================================
// Tasks API
// ============================================

export async function getTasks(filters?: {
  status?: string;
  context?: string;
  source?: string;
  label?: string;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  params.set('limit', '500'); // Get enough tasks
  if (filters?.status) params.set('status', filters.status);
  if (filters?.context) params.set('context', filters.context);
  if (filters?.source) params.set('source', filters.source);
  if (filters?.label) params.set('label', filters.label);

  return fetchApi<Task[]>(`${API_BASE}/tasks?${params}`);
}

export async function getTodayTasks(): Promise<Task[]> {
  return fetchApi<Task[]>(`${API_BASE}/tasks/today`);
}

export async function completeTask(taskId: string): Promise<Task> {
  return fetchApi<Task>(`${API_BASE}/tasks/${taskId}/complete`, { method: 'POST' });
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  return fetchApi<Task>(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ============================================
// Read Help API (Books & Chapters)
// ============================================

export async function getBooks(): Promise<Book[]> {
  return fetchApi<Book[]>(`${API_BASE}/read-help/books`);
}

export async function getBook(bookId: string): Promise<Book> {
  return fetchApi<Book>(`${API_BASE}/read-help/books/${bookId}`);
}

export async function getChapters(bookId: string): Promise<Chapter[]> {
  return fetchApi<Chapter[]>(`${API_BASE}/read-help/books/${bookId}/chapters`);
}

export async function getChapter(chapterId: string): Promise<Chapter> {
  return fetchApi<Chapter>(`${API_BASE}/read-help/chapters/${chapterId}`);
}

export async function getChapterSummary(
  chapterId: string,
  length: SummaryLength
): Promise<{ summary: string; length: SummaryLength }> {
  return fetchApi(`${API_BASE}/read-help/chapters/${chapterId}/summary/${length}`);
}

export async function regenerateSummary(
  chapterId: string,
  length: SummaryLength
): Promise<{ summary: string; length: SummaryLength }> {
  return fetchApi(`${API_BASE}/read-help/chapters/${chapterId}/summary`, {
    method: 'POST',
    body: JSON.stringify({ length }),
  });
}

export async function getKeyConcepts(chapterId: string): Promise<Array<{
  term: string;
  definition: string;
  pageNumbers: number[];
}>> {
  return fetchApi(`${API_BASE}/read-help/chapters/${chapterId}/concepts`);
}

// ============================================
// Chat API
// ============================================

export async function chatAboutBook(
  bookId: string,
  message: string,
  options?: { chapterId?: string; conversationId?: string }
): Promise<{
  response: string;
  conversationId: string;
  citations: Array<{ page: number; text: string }>;
}> {
  return fetchApi(`${API_BASE}/read-help/chat`, {
    method: 'POST',
    body: JSON.stringify({
      bookId,
      message,
      chapterId: options?.chapterId,
      conversationId: options?.conversationId,
    }),
  });
}

// ============================================
// Flashcards API
// ============================================

export async function generateFlashcards(
  chapterId: string,
  count?: number
): Promise<Flashcard[]> {
  return fetchApi<Flashcard[]>(`${API_BASE}/read-help/chapters/${chapterId}/flashcards`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}

export async function getDueFlashcards(
  bookId?: string,
  limit?: number
): Promise<Flashcard[]> {
  const params = new URLSearchParams();
  if (bookId) params.set('book_id', bookId);
  if (limit) params.set('limit', String(limit));

  const url = params.toString()
    ? `${API_BASE}/read-help/flashcards/due?${params}`
    : `${API_BASE}/read-help/flashcards/due`;
  return fetchApi<Flashcard[]>(url);
}

export async function reviewFlashcard(
  cardId: string,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): Promise<void> {
  await fetchApi(`${API_BASE}/read-help/flashcards/${cardId}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}

// ============================================
// Quiz API
// ============================================

export async function generateQuiz(
  chapterId: string,
  options?: { questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard' }
): Promise<{ quizId: string; questions: Array<{
  id: string;
  type: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}> }> {
  return fetchApi(`${API_BASE}/read-help/chapters/${chapterId}/quiz`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function submitQuiz(
  quizId: string,
  answers: Array<{ questionId: string; answer: string }>
): Promise<{ score: number; results: Array<{ questionId: string; correct: boolean; explanation: string }> }> {
  return fetchApi(`${API_BASE}/read-help/quizzes/${quizId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

// ============================================
// Progress API
// ============================================

export async function getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
  try {
    return await fetchApi<ReadingProgress>(`${API_BASE}/read-help/books/${bookId}/progress`);
  } catch {
    return null;
  }
}

export async function updateReadingProgress(
  bookId: string,
  data: { currentPage?: number; minutesRead?: number }
): Promise<void> {
  await fetchApi(`${API_BASE}/read-help/books/${bookId}/progress`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================
// Calendar API
// ============================================

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  return fetchApi<CalendarEvent[]>(`${API_BASE}/calendar`);
}

export async function getTodayEvents(): Promise<CalendarEvent[]> {
  return fetchApi<CalendarEvent[]>(`${API_BASE}/calendar/today`);
}

// ============================================
// Search API
// ============================================

export async function searchBooks(
  query: string,
  options?: { bookId?: string; limit?: number }
): Promise<Array<{
  bookId: string;
  bookTitle: string;
  chapterId: string | null;
  chapterTitle: string | null;
  pageNumber: number | null;
  content: string;
  highlightedContent: string;
  score: number;
}>> {
  const params = new URLSearchParams({ q: query });
  if (options?.bookId) params.set('book_id', options.bookId);
  if (options?.limit) params.set('limit', String(options.limit));

  return fetchApi(`${API_BASE}/read-help/search?${params}`);
}

// ============================================
// Video API
// ============================================

export async function getVideos(filters?: {
  canvasCourseId?: string;
  status?: string;
  archived?: boolean;
}): Promise<Video[]> {
  const params = new URLSearchParams();
  if (filters?.canvasCourseId) params.set('canvas_course_id', filters.canvasCourseId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.archived !== undefined) params.set('archived', String(filters.archived));

  const url = params.toString()
    ? `${API_BASE}/read-help/videos?${params}`
    : `${API_BASE}/read-help/videos`;
  return fetchApi<Video[]>(url);
}

export async function getVideo(videoId: string): Promise<Video> {
  return fetchApi<Video>(`${API_BASE}/read-help/videos/${videoId}`);
}

export async function getVideoSummary(
  videoId: string,
  length: SummaryLength
): Promise<{ summary: string; length: SummaryLength; cached: boolean }> {
  return fetchApi(`${API_BASE}/read-help/videos/${videoId}/summary/${length}`);
}

export async function addVideo(
  url: string,
  options?: {
    canvasCourseId?: string;
    canvasModuleItemId?: string;
    canvasModuleName?: string;
    tags?: string[];
  }
): Promise<Video> {
  return fetchApi<Video>(`${API_BASE}/read-help/videos`, {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
  });
}

export async function reprocessVideo(videoId: string): Promise<Video> {
  return fetchApi<Video>(`${API_BASE}/read-help/videos/${videoId}/reprocess`, {
    method: 'POST',
  });
}

export async function updateVideo(
  videoId: string,
  updates: {
    tags?: string[];
    notes?: string;
    rating?: number;
    isArchived?: boolean;
    watchProgress?: number;
  }
): Promise<Video> {
  return fetchApi<Video>(`${API_BASE}/read-help/videos/${videoId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
