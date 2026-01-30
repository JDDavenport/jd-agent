import type {
  Book,
  Chapter,
  SearchResult,
  Quiz,
  QuizResult,
  Highlight,
  ReadingProgress,
  Flashcard,
  KeyConcept,
  SummaryLength,
} from './types';

const API_BASE = '/api/read-help';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
// Books
// ============================================

export async function uploadBook(
  file: File,
  metadata?: { title?: string; author?: string; tags?: string[] }
): Promise<Book> {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata?.title) formData.append('title', metadata.title);
  if (metadata?.author) formData.append('author', metadata.author);
  if (metadata?.tags) formData.append('tags', metadata.tags.join(','));

  return fetchApi<Book>(`${API_BASE}/books`, {
    method: 'POST',
    body: formData,
  });
}

export async function listBooks(options?: {
  archived?: boolean;
  search?: string;
}): Promise<Book[]> {
  const params = new URLSearchParams();
  if (options?.archived !== undefined) params.set('archived', String(options.archived));
  if (options?.search) params.set('search', options.search);

  const url = params.toString() ? `${API_BASE}/books?${params}` : `${API_BASE}/books`;
  return fetchApi<Book[]>(url);
}

export async function getBook(bookId: string): Promise<Book> {
  return fetchApi<Book>(`${API_BASE}/books/${bookId}`);
}

export async function getBookStatus(bookId: string): Promise<{
  status: string;
  progress: number;
  error?: string;
}> {
  return fetchApi(`${API_BASE}/books/${bookId}/status`);
}

export async function updateBook(
  bookId: string,
  updates: Partial<{
    title: string;
    author: string;
    tags: string[];
    notes: string;
    rating: number;
    isArchived: boolean;
  }>
): Promise<Book> {
  return fetchApi<Book>(`${API_BASE}/books/${bookId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteBook(bookId: string): Promise<void> {
  await fetchApi(`${API_BASE}/books/${bookId}`, { method: 'DELETE' });
}

// ============================================
// Chapters
// ============================================

export async function getChapters(bookId: string): Promise<Chapter[]> {
  return fetchApi<Chapter[]>(`${API_BASE}/books/${bookId}/chapters`);
}

export async function getChapter(chapterId: string): Promise<Chapter> {
  return fetchApi<Chapter>(`${API_BASE}/chapters/${chapterId}`);
}

// ============================================
// Summaries
// ============================================

export async function getChapterSummary(
  chapterId: string,
  length: SummaryLength
): Promise<{ summary: string; length: SummaryLength }> {
  return fetchApi(`${API_BASE}/chapters/${chapterId}/summary/${length}`);
}

export async function regenerateSummary(
  chapterId: string,
  length: SummaryLength
): Promise<{ summary: string; length: SummaryLength }> {
  return fetchApi(`${API_BASE}/chapters/${chapterId}/summary`, {
    method: 'POST',
    body: JSON.stringify({ length }),
  });
}

// ============================================
// Search
// ============================================

export async function search(
  query: string,
  options?: { bookId?: string; limit?: number }
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (options?.bookId) params.set('book_id', options.bookId);
  if (options?.limit) params.set('limit', String(options.limit));

  return fetchApi<SearchResult[]>(`${API_BASE}/search?${params}`);
}

// ============================================
// Chat
// ============================================

export async function chat(
  bookId: string,
  message: string,
  options?: { chapterId?: string; conversationId?: string }
): Promise<{
  response: string;
  conversationId: string;
  citations: Array<{ page: number; text: string }>;
}> {
  return fetchApi(`${API_BASE}/chat`, {
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
// Quizzes
// ============================================

export async function generateQuiz(
  chapterId: string,
  options?: { questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard' }
): Promise<Quiz> {
  return fetchApi<Quiz>(`${API_BASE}/chapters/${chapterId}/quiz`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function submitQuiz(
  quizId: string,
  answers: Array<{ questionId: string; answer: string }>
): Promise<{ score: number; results: QuizResult[] }> {
  return fetchApi(`${API_BASE}/quizzes/${quizId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

// ============================================
// Key Concepts
// ============================================

export async function getKeyConcepts(chapterId: string): Promise<KeyConcept[]> {
  return fetchApi<KeyConcept[]>(`${API_BASE}/chapters/${chapterId}/concepts`);
}

// ============================================
// Highlights
// ============================================

export async function createHighlight(
  bookId: string,
  data: {
    chapterId?: string;
    pageNumber?: number;
    highlightedText: string;
    note?: string;
    color?: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
    tags?: string[];
  }
): Promise<{ id: string }> {
  return fetchApi(`${API_BASE}/highlights`, {
    method: 'POST',
    body: JSON.stringify({ bookId, ...data }),
  });
}

export async function getHighlights(bookId: string): Promise<Highlight[]> {
  return fetchApi<Highlight[]>(`${API_BASE}/books/${bookId}/highlights`);
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  await fetchApi(`${API_BASE}/highlights/${highlightId}`, { method: 'DELETE' });
}

// ============================================
// Progress
// ============================================

export async function getProgress(bookId: string): Promise<ReadingProgress | null> {
  try {
    return await fetchApi<ReadingProgress>(`${API_BASE}/books/${bookId}/progress`);
  } catch {
    return null;
  }
}

export async function updateProgress(
  bookId: string,
  data: { currentPage?: number; minutesRead?: number }
): Promise<void> {
  await fetchApi(`${API_BASE}/books/${bookId}/progress`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================
// Flashcards
// ============================================

export async function generateFlashcards(
  chapterId: string,
  count?: number
): Promise<Flashcard[]> {
  return fetchApi<Flashcard[]>(`${API_BASE}/chapters/${chapterId}/flashcards`, {
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

  const url = params.toString() ? `${API_BASE}/flashcards/due?${params}` : `${API_BASE}/flashcards/due`;
  return fetchApi<Flashcard[]>(url);
}

export async function reviewFlashcard(
  cardId: string,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): Promise<void> {
  await fetchApi(`${API_BASE}/flashcards/${cardId}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}
