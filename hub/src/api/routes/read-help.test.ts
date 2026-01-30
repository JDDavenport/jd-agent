import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';

// Mock the service
vi.mock('../../services/read-help-service', () => ({
  readHelpService: {
    uploadBook: vi.fn(),
    listBooks: vi.fn(),
    getBook: vi.fn(),
    getBookStatus: vi.fn(),
    updateBook: vi.fn(),
    deleteBook: vi.fn(),
    getChapters: vi.fn(),
    getChapter: vi.fn(),
    getChapterSummary: vi.fn(),
    regenerateSummary: vi.fn(),
    search: vi.fn(),
    chat: vi.fn(),
    generateQuiz: vi.fn(),
    submitQuiz: vi.fn(),
    getKeyConcepts: vi.fn(),
    createHighlight: vi.fn(),
    getHighlights: vi.fn(),
    deleteHighlight: vi.fn(),
    getProgress: vi.fn(),
    updateProgress: vi.fn(),
    generateFlashcards: vi.fn(),
    getDueFlashcards: vi.fn(),
    reviewFlashcard: vi.fn(),
  },
}));

import readHelpRouter from './read-help';
import { readHelpService } from '../../services/read-help-service';

describe('Read Help API Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/read-help', readHelpRouter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Books API', () => {
    describe('GET /api/read-help/books', () => {
      it('should return list of books', async () => {
        const mockBooks = [
          { id: '1', title: 'Book 1', status: 'ready' },
          { id: '2', title: 'Book 2', status: 'processing' },
        ];
        vi.mocked(readHelpService.listBooks).mockResolvedValue(mockBooks as any);

        const res = await app.request('/api/read-help/books');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toEqual(mockBooks);
      });

      it('should filter by archived status', async () => {
        vi.mocked(readHelpService.listBooks).mockResolvedValue([]);

        await app.request('/api/read-help/books?archived=true');

        expect(readHelpService.listBooks).toHaveBeenCalledWith({
          archived: true,
          search: undefined,
        });
      });

      it('should filter by search term', async () => {
        vi.mocked(readHelpService.listBooks).mockResolvedValue([]);

        await app.request('/api/read-help/books?search=test');

        expect(readHelpService.listBooks).toHaveBeenCalledWith({
          archived: undefined,
          search: 'test',
        });
      });
    });

    describe('GET /api/read-help/books/:id', () => {
      it('should return book details', async () => {
        const mockBook = { id: '1', title: 'Test Book', status: 'ready' };
        vi.mocked(readHelpService.getBook).mockResolvedValue(mockBook as any);

        const res = await app.request('/api/read-help/books/1');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toEqual(mockBook);
      });

      it('should return 404 for non-existent book', async () => {
        vi.mocked(readHelpService.getBook).mockResolvedValue(null);

        const res = await app.request('/api/read-help/books/non-existent');
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('NOT_FOUND');
      });
    });

    describe('GET /api/read-help/books/:id/status', () => {
      it('should return processing status', async () => {
        vi.mocked(readHelpService.getBookStatus).mockResolvedValue({
          status: 'processing',
          progress: 50,
        });

        const res = await app.request('/api/read-help/books/1/status');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.status).toBe('processing');
        expect(json.data.progress).toBe(50);
      });
    });

    describe('PATCH /api/read-help/books/:id', () => {
      it('should update book metadata', async () => {
        const updatedBook = { id: '1', title: 'Updated Title' };
        vi.mocked(readHelpService.updateBook).mockResolvedValue(updatedBook as any);

        const res = await app.request('/api/read-help/books/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Title' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.title).toBe('Updated Title');
      });

      it('should validate rating range', async () => {
        const res = await app.request('/api/read-help/books/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: 10 }), // Invalid rating
        });

        expect(res.status).toBe(400);
      });
    });

    describe('DELETE /api/read-help/books/:id', () => {
      it('should delete a book', async () => {
        vi.mocked(readHelpService.deleteBook).mockResolvedValue();

        const res = await app.request('/api/read-help/books/1', {
          method: 'DELETE',
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
      });

      it('should return 404 for non-existent book', async () => {
        vi.mocked(readHelpService.deleteBook).mockRejectedValue(
          new Error('Book not found')
        );

        const res = await app.request('/api/read-help/books/non-existent', {
          method: 'DELETE',
        });
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.error.code).toBe('NOT_FOUND');
      });
    });
  });

  describe('Chapters API', () => {
    describe('GET /api/read-help/books/:id/chapters', () => {
      it('should return list of chapters', async () => {
        const mockChapters = [
          { id: '1', chapterNumber: 1, title: 'Introduction' },
          { id: '2', chapterNumber: 2, title: 'Methods' },
        ];
        vi.mocked(readHelpService.getChapters).mockResolvedValue(mockChapters as any);

        const res = await app.request('/api/read-help/books/book-1/chapters');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toHaveLength(2);
      });
    });

    describe('GET /api/read-help/chapters/:id', () => {
      it('should return chapter details', async () => {
        const mockChapter = { id: '1', title: 'Introduction', content: 'Test content' };
        vi.mocked(readHelpService.getChapter).mockResolvedValue(mockChapter as any);

        const res = await app.request('/api/read-help/chapters/1');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.title).toBe('Introduction');
      });
    });
  });

  describe('Summaries API', () => {
    describe('GET /api/read-help/chapters/:id/summary/:length', () => {
      it('should return short summary', async () => {
        vi.mocked(readHelpService.getChapterSummary).mockResolvedValue('Short summary');

        const res = await app.request('/api/read-help/chapters/1/summary/short');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.summary).toBe('Short summary');
        expect(json.data.length).toBe('short');
      });

      it('should return medium summary', async () => {
        vi.mocked(readHelpService.getChapterSummary).mockResolvedValue('Medium summary');

        const res = await app.request('/api/read-help/chapters/1/summary/medium');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.length).toBe('medium');
      });

      it('should return long summary', async () => {
        vi.mocked(readHelpService.getChapterSummary).mockResolvedValue('Long summary');

        const res = await app.request('/api/read-help/chapters/1/summary/long');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.length).toBe('long');
      });

      it('should reject invalid length parameter', async () => {
        const res = await app.request('/api/read-help/chapters/1/summary/invalid');
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error.code).toBe('INVALID_LENGTH');
      });
    });

    describe('POST /api/read-help/chapters/:id/summary', () => {
      it('should regenerate summary', async () => {
        vi.mocked(readHelpService.regenerateSummary).mockResolvedValue('New summary');

        const res = await app.request('/api/read-help/chapters/1/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ length: 'medium' }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.summary).toBe('New summary');
      });
    });
  });

  describe('Search API', () => {
    describe('GET /api/read-help/search', () => {
      it('should return search results', async () => {
        const mockResults = [
          { bookId: '1', bookTitle: 'Book 1', content: 'matching content' },
        ];
        vi.mocked(readHelpService.search).mockResolvedValue(mockResults as any);

        const res = await app.request('/api/read-help/search?q=test');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toHaveLength(1);
      });

      it('should require query parameter', async () => {
        const res = await app.request('/api/read-help/search');
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error.code).toBe('NO_QUERY');
      });

      it('should filter by book_id', async () => {
        vi.mocked(readHelpService.search).mockResolvedValue([]);

        await app.request('/api/read-help/search?q=test&book_id=book-1');

        expect(readHelpService.search).toHaveBeenCalledWith('test', {
          bookId: 'book-1',
          limit: 20,
        });
      });
    });
  });

  describe('Chat API', () => {
    describe('POST /api/read-help/chat', () => {
      it('should return chat response', async () => {
        vi.mocked(readHelpService.chat).mockResolvedValue({
          response: 'AI response',
          conversationId: 'conv-1',
          citations: [],
        });

        const res = await app.request('/api/read-help/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: '123e4567-e89b-12d3-a456-426614174000',
            message: 'What is this about?',
          }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.response).toBe('AI response');
      });

      it('should validate required fields', async () => {
        const res = await app.request('/api/read-help/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hello' }), // Missing bookId
        });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('Quiz API', () => {
    describe('POST /api/read-help/chapters/:id/quiz', () => {
      it('should generate quiz', async () => {
        vi.mocked(readHelpService.generateQuiz).mockResolvedValue({
          quizId: 'quiz-1',
          questions: [
            { id: 'q1', type: 'multiple_choice', question: 'Test?', correctAnswer: 'A' },
          ],
        } as any);

        const res = await app.request('/api/read-help/chapters/1/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.quizId).toBe('quiz-1');
      });

      it('should accept question count and difficulty', async () => {
        vi.mocked(readHelpService.generateQuiz).mockResolvedValue({
          quizId: 'quiz-1',
          questions: [],
        } as any);

        await app.request('/api/read-help/chapters/1/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionCount: 10, difficulty: 'hard' }),
        });

        expect(readHelpService.generateQuiz).toHaveBeenCalledWith('1', {
          questionCount: 10,
          difficulty: 'hard',
        });
      });
    });

    describe('POST /api/read-help/quizzes/:id/submit', () => {
      it('should submit and score quiz', async () => {
        vi.mocked(readHelpService.submitQuiz).mockResolvedValue({
          score: 80,
          results: [{ questionId: 'q1', correct: true, explanation: 'Correct!' }],
        });

        const res = await app.request('/api/read-help/quizzes/quiz-1/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: [{ questionId: 'q1', answer: 'A' }],
          }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.score).toBe(80);
      });
    });
  });

  describe('Highlights API', () => {
    describe('POST /api/read-help/highlights', () => {
      it('should create highlight', async () => {
        vi.mocked(readHelpService.createHighlight).mockResolvedValue({ id: 'hl-1' });

        const res = await app.request('/api/read-help/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: '123e4567-e89b-12d3-a456-426614174000',
            highlightedText: 'Important text',
            color: 'yellow',
          }),
        });
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(json.data.id).toBe('hl-1');
      });
    });

    describe('GET /api/read-help/books/:id/highlights', () => {
      it('should return highlights', async () => {
        vi.mocked(readHelpService.getHighlights).mockResolvedValue([
          { id: 'hl-1', highlightedText: 'Test', color: 'yellow' },
        ] as any);

        const res = await app.request('/api/read-help/books/1/highlights');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data).toHaveLength(1);
      });
    });

    describe('DELETE /api/read-help/highlights/:id', () => {
      it('should delete highlight', async () => {
        vi.mocked(readHelpService.deleteHighlight).mockResolvedValue();

        const res = await app.request('/api/read-help/highlights/hl-1', {
          method: 'DELETE',
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
      });
    });
  });

  describe('Progress API', () => {
    describe('GET /api/read-help/books/:id/progress', () => {
      it('should return reading progress', async () => {
        vi.mocked(readHelpService.getProgress).mockResolvedValue({
          currentPage: 50,
          percentComplete: 50,
          pagesRead: 50,
          totalReadingTimeMinutes: 120,
          lastReadAt: '2024-01-01T00:00:00Z',
        });

        const res = await app.request('/api/read-help/books/1/progress');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.percentComplete).toBe(50);
      });

      it('should return 404 when no progress exists', async () => {
        vi.mocked(readHelpService.getProgress).mockResolvedValue(null);

        const res = await app.request('/api/read-help/books/1/progress');
        const json = await res.json();

        expect(res.status).toBe(404);
      });
    });

    describe('PUT /api/read-help/books/:id/progress', () => {
      it('should update progress', async () => {
        vi.mocked(readHelpService.updateProgress).mockResolvedValue();

        const res = await app.request('/api/read-help/books/1/progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPage: 75, minutesRead: 30 }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
      });
    });
  });

  describe('Flashcards API', () => {
    describe('POST /api/read-help/chapters/:id/flashcards', () => {
      it('should generate flashcards', async () => {
        vi.mocked(readHelpService.generateFlashcards).mockResolvedValue([
          { id: 'fc-1', front: 'Q', back: 'A' },
        ] as any);

        const res = await app.request('/api/read-help/chapters/1/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 10 }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data).toHaveLength(1);
      });
    });

    describe('GET /api/read-help/flashcards/due', () => {
      it('should return due flashcards', async () => {
        vi.mocked(readHelpService.getDueFlashcards).mockResolvedValue([
          { id: 'fc-1', front: 'Q', back: 'A', bookId: '1' },
        ]);

        const res = await app.request('/api/read-help/flashcards/due');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data).toHaveLength(1);
      });
    });

    describe('POST /api/read-help/flashcards/:id/review', () => {
      it('should accept valid quality ratings', async () => {
        vi.mocked(readHelpService.reviewFlashcard).mockResolvedValue();

        for (const quality of [0, 1, 2, 3, 4, 5]) {
          const res = await app.request('/api/read-help/flashcards/fc-1/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quality }),
          });

          expect(res.status).toBe(200);
        }
      });

      it('should reject invalid quality ratings', async () => {
        const res = await app.request('/api/read-help/flashcards/fc-1/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quality: 10 }),
        });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('Key Concepts API', () => {
    describe('GET /api/read-help/chapters/:id/concepts', () => {
      it('should return key concepts', async () => {
        vi.mocked(readHelpService.getKeyConcepts).mockResolvedValue([
          { term: 'Concept', definition: 'Definition', pageNumbers: [1, 5] },
        ]);

        const res = await app.request('/api/read-help/chapters/1/concepts');
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data).toHaveLength(1);
        expect(json.data[0].term).toBe('Concept');
      });
    });
  });
});
