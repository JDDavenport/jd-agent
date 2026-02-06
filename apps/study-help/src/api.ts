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

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

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
// Course Materials API (Canvas)
// ============================================

export interface CourseMaterial {
  id: string;
  courseId: string;
  fileName: string;
  displayName: string | null;
  fileType: string;
  materialType: string | null;
  moduleName: string | null;
  canvasUrl: string | null;
  downloadUrl: string | null;
  readStatus: string;
  readProgress: number;
  aiSummary: string | null;
}

export async function getCourseMaterials(courseId: string): Promise<CourseMaterial[]> {
  try {
    // The by-course endpoint returns materials grouped by module name
    const grouped = await fetchApi<Record<string, CourseMaterial[]>>(`${API_BASE}/canvas-materials/by-course/${courseId}`);
    // Flatten into array
    return Object.values(grouped).flat();
  } catch {
    return [];
  }
}

export async function getMaterialsByCanvasCourseId(canvasCourseId: string): Promise<CourseMaterial[]> {
  try {
    // First get the class UUID from canvas course ID
    const classesResponse = await fetch(`${API_BASE}/classes/with-canvas-ids`);
    const classesData = await classesResponse.json();
    
    if (!classesData.success) return [];
    
    const cls = classesData.data?.find((c: any) => c.canvasCourseId === canvasCourseId);
    if (!cls) return [];
    
    return getCourseMaterials(cls.id);
  } catch {
    return [];
  }
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

// ============================================
// Lectures API
// ============================================

import type { Lecture, LectureDetail } from './types/lecture';

export async function getLectures(courseId: string): Promise<Lecture[]> {
  return fetchApi<Lecture[]>(`${API_BASE}/lectures/${courseId}`);
}

export async function getLecture(courseId: string, lectureId: string): Promise<LectureDetail> {
  return fetchApi<LectureDetail>(`${API_BASE}/lectures/${courseId}/${lectureId}`);
}

export function getLectureAudioUrl(courseId: string, lectureId: string): string {
  return `${API_BASE}/lectures/${courseId}/${lectureId}/audio`;
}

// ============================================
// Course AI Chat API (Legacy)
// ============================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  sources: string[];
  model: string;
}

export async function sendCourseChat(
  courseId: string,
  message: string,
  history?: ChatMessage[]
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>(`${API_BASE}/courses/${courseId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
}

// ============================================
// Class GPT API (Study Help Chat)
// ============================================

export interface ClassGPTCitation {
  name: string;
  url: string | null;
  type: string;
  snippet?: string;
}

export interface ClassGPTMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ClassGPTCitation[];
  createdAt: string;
}

export interface ClassGPTSource {
  name: string;
  url: string | null;
  type: string;
}

export interface ClassGPTResponse {
  response: string;
  citations: ClassGPTCitation[];
  sources: ClassGPTSource[];
  model: string;
}

export async function sendClassGPTMessage(
  canvasCourseId: string,
  message: string,
  courseName?: string,
): Promise<ClassGPTResponse> {
  return fetchApi<ClassGPTResponse>(`${API_BASE}/study-help/chat`, {
    method: 'POST',
    body: JSON.stringify({ canvasCourseId, message, courseName }),
  });
}

export async function streamClassGPTMessage(
  canvasCourseId: string,
  message: string,
  courseName?: string,
  onDelta: (text: string) => void = () => {},
  onDone: (citations: ClassGPTCitation[], sources: ClassGPTSource[]) => void = () => {},
  onError: (error: string) => void = () => {},
): Promise<void> {
  const response = await fetch(`${API_BASE}/study-help/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvasCourseId, message, courseName, stream: true }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || 'Chat request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'delta') {
            onDelta(parsed.text);
          } else if (parsed.type === 'done') {
            onDone(parsed.citations || [], parsed.sources || []);
          } else if (parsed.type === 'error') {
            onError(parsed.message);
          }
        } catch {
          // Ignore parse errors for partial SSE data
        }
      }
    }
  }
}

export async function getClassGPTHistory(
  canvasCourseId: string,
): Promise<{ messages: ClassGPTMessage[] }> {
  return fetchApi<{ messages: ClassGPTMessage[] }>(
    `${API_BASE}/study-help/chat/history/${canvasCourseId}`
  );
}

export async function clearClassGPTHistory(
  canvasCourseId: string,
): Promise<void> {
  await fetchApi(`${API_BASE}/study-help/chat/history/${canvasCourseId}`, {
    method: 'DELETE',
  });
}

export async function getClassGPTSources(
  canvasCourseId: string,
): Promise<{ sources: ClassGPTSource[]; totalSources: number }> {
  return fetchApi<{ sources: ClassGPTSource[]; totalSources: number }>(
    `${API_BASE}/study-help/chat/sources/${canvasCourseId}`
  );
}

// ============================================
// Remarkable Notes API
// ============================================

export interface RemarkableNote {
  id: string;
  name: string;
  pages: number;
  preview: string;
  ocrText: string;
}

export async function getRemarkableNotes(courseId: string): Promise<RemarkableNote[]> {
  return fetchApi<RemarkableNote[]>(`${API_BASE}/courses/${courseId}/remarkable`);
}

export function getRemarkablePdfUrl(courseId: string, noteId: string): string {
  return `${API_BASE}/courses/${courseId}/remarkable/${noteId}/pdf`;
}

// ============================================
// Tasks API (additional functions)
// ============================================

export async function reopenTask(taskId: string): Promise<Task> {
  return fetchApi<Task>(`${API_BASE}/tasks/${taskId}/reopen`, { method: 'POST' });
}
