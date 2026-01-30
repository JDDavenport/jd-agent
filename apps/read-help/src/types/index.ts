export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  filePath: string;
  fileSizeBytes: number | null;
  fileHash: string | null;
  pageCount: number | null;
  coverImagePath: string | null;
  status: 'processing' | 'ready' | 'error';
  processingError: string | null;
  processingProgress: number | null;
  totalWordCount: number | null;
  language: string | null;
  tags: string[] | null;
  notes: string | null;
  rating: number | null;
  isArchived: boolean;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterNumber: number;
  title: string | null;
  startPage: number | null;
  endPage: number | null;
  content: string;
  wordCount: number | null;
  summaryShort: string | null;
  summaryMedium: string | null;
  summaryLong: string | null;
  summaryGeneratedAt: string | null;
  keyConcepts: KeyConcept[] | null;
  keyQuotes: KeyQuote[] | null;
  frameworks: Framework[] | null;
  images: Array<{ path: string; pageNumber: number; caption?: string; type: string }> | null;
  createdAt: string;
}

export interface KeyConcept {
  term: string;
  definition: string;
  pageNumbers: number[];
}

export interface KeyQuote {
  quote: string;
  pageNumber: number;
  context: string;
}

export interface Framework {
  name: string;
  description: string;
  pageNumbers: number[];
}

export interface SearchResult {
  bookId: string;
  bookTitle: string;
  chapterId: string | null;
  chapterTitle: string | null;
  pageNumber: number | null;
  content: string;
  highlightedContent: string;
  score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{ page: number; text: string }>;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  pageRef?: number;
}

export interface Quiz {
  quizId: string;
  questions: QuizQuestion[];
}

export interface QuizResult {
  questionId: string;
  correct: boolean;
  explanation: string;
}

export interface Highlight {
  id: string;
  chapterId: string | null;
  pageNumber: number | null;
  highlightedText: string;
  note: string | null;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  tags: string[] | null;
  createdAt: string;
}

export interface ReadingProgress {
  currentPage: number;
  percentComplete: number;
  pagesRead: number;
  totalReadingTimeMinutes: number;
  lastReadAt: string | null;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  bookId: string;
}

export type SummaryLength = 'short' | 'medium' | 'long';

// Time-based reading modes
export type ReadingMode = 'full' | '30min' | '15min';
