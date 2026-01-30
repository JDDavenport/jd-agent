/**
 * JD Agent - Read Help API Routes
 *
 * Personal Book Learning Assistant API:
 * - Upload and manage books (PDF)
 * - Generate chapter summaries
 * - AI chat/tutoring about book content
 * - Quiz generation and flashcards
 * - Full-text search across library
 * - Highlights and reading progress
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { readHelpService } from '../../services/read-help-service';
import { videosRouter } from './videos';

const readHelpRouter = new Hono();

// Mount videos sub-router
readHelpRouter.route('/videos', videosRouter);

// ============================================
// Book Management
// ============================================

/**
 * POST /api/read-help/books
 * Upload a new book (PDF)
 */
readHelpRouter.post('/books', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const author = formData.get('author') as string | null;
    const tagsRaw = formData.get('tags') as string | null;

    if (!file) {
      return c.json(
        { success: false, error: { code: 'NO_FILE', message: 'No file provided' } },
        400
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return c.json(
        { success: false, error: { code: 'INVALID_TYPE', message: 'Only PDF files are supported' } },
        400
      );
    }

    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()) : undefined;

    const book = await readHelpService.uploadBook(file, file.name, {
      title: title || undefined,
      author: author || undefined,
      tags,
    });

    return c.json({ success: true, data: book }, 201);
  } catch (error) {
    console.error('[Read Help API] Error uploading book:', error);
    const message = error instanceof Error ? error.message : String(error);

    // Handle duplicate book error
    if (message.includes('already been uploaded')) {
      return c.json(
        { success: false, error: { code: 'DUPLICATE', message } },
        409
      );
    }

    return c.json(
      { success: false, error: { code: 'UPLOAD_ERROR', message } },
      500
    );
  }
});

/**
 * GET /api/read-help/books
 * List all books
 */
readHelpRouter.get('/books', async (c) => {
  try {
    const archived = c.req.query('archived');
    const search = c.req.query('search');

    const books = await readHelpService.listBooks({
      archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
      search: search || undefined,
    });

    return c.json({ success: true, data: books });
  } catch (error) {
    console.error('[Read Help API] Error listing books:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/books/:id
 * Get book details
 */
readHelpRouter.get('/books/:id', async (c) => {
  try {
    const bookId = c.req.param('id');
    const book = await readHelpService.getBook(bookId);

    if (!book) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Book not found' } },
        404
      );
    }

    return c.json({ success: true, data: book });
  } catch (error) {
    console.error('[Read Help API] Error getting book:', error);
    return c.json(
      { success: false, error: { code: 'GET_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/books/:id/status
 * Get book processing status
 */
readHelpRouter.get('/books/:id/status', async (c) => {
  try {
    const bookId = c.req.param('id');
    const status = await readHelpService.getBookStatus(bookId);

    return c.json({ success: true, data: status });
  } catch (error) {
    console.error('[Read Help API] Error getting book status:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'STATUS_ERROR', message } },
      500
    );
  }
});

/**
 * PATCH /api/read-help/books/:id
 * Update book metadata
 */
const updateBookSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  isArchived: z.boolean().optional(),
});

readHelpRouter.patch('/books/:id', zValidator('json', updateBookSchema), async (c) => {
  try {
    const bookId = c.req.param('id');
    const updates = c.req.valid('json');

    const book = await readHelpService.updateBook(bookId, updates);
    return c.json({ success: true, data: book });
  } catch (error) {
    console.error('[Read Help API] Error updating book:', error);
    return c.json(
      { success: false, error: { code: 'UPDATE_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * POST /api/read-help/books/:id/reprocess
 * Re-process chapters for a book using improved detection
 */
readHelpRouter.post('/books/:id/reprocess', async (c) => {
  try {
    const bookId = c.req.param('id');
    const result = await readHelpService.reprocessChapters(bookId);

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[Read Help API] Error re-processing book:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'REPROCESS_ERROR', message } },
      500
    );
  }
});

/**
 * DELETE /api/read-help/books/:id
 * Delete a book and all related data
 */
readHelpRouter.delete('/books/:id', async (c) => {
  try {
    const bookId = c.req.param('id');
    await readHelpService.deleteBook(bookId);

    return c.json({ success: true, message: 'Book deleted' });
  } catch (error) {
    console.error('[Read Help API] Error deleting book:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'DELETE_ERROR', message } },
      500
    );
  }
});

// ============================================
// Chapters
// ============================================

/**
 * GET /api/read-help/books/:id/chapters
 * List chapters for a book
 */
readHelpRouter.get('/books/:id/chapters', async (c) => {
  try {
    const bookId = c.req.param('id');
    const chapters = await readHelpService.getChapters(bookId);

    return c.json({ success: true, data: chapters });
  } catch (error) {
    console.error('[Read Help API] Error listing chapters:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/chapters/:id
 * Get chapter details
 */
readHelpRouter.get('/chapters/:id', async (c) => {
  try {
    const chapterId = c.req.param('id');
    const chapter = await readHelpService.getChapter(chapterId);

    if (!chapter) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Chapter not found' } },
        404
      );
    }

    return c.json({ success: true, data: chapter });
  } catch (error) {
    console.error('[Read Help API] Error getting chapter:', error);
    return c.json(
      { success: false, error: { code: 'GET_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Summaries
// ============================================

/**
 * GET /api/read-help/chapters/:id/summary/:length
 * Get or generate chapter summary
 */
readHelpRouter.get('/chapters/:id/summary/:length', async (c) => {
  try {
    const chapterId = c.req.param('id');
    const length = c.req.param('length') as 'short' | 'medium' | 'long';

    if (!['short', 'medium', 'long'].includes(length)) {
      return c.json(
        { success: false, error: { code: 'INVALID_LENGTH', message: 'Length must be short, medium, or long' } },
        400
      );
    }

    const summary = await readHelpService.getChapterSummary(chapterId, length);

    return c.json({ success: true, data: { summary, length } });
  } catch (error) {
    console.error('[Read Help API] Error getting summary:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'SUMMARY_ERROR', message } },
      500
    );
  }
});

/**
 * POST /api/read-help/chapters/:id/summary
 * Regenerate chapter summary
 */
const regenerateSummarySchema = z.object({
  length: z.enum(['short', 'medium', 'long']),
});

readHelpRouter.post('/chapters/:id/summary', zValidator('json', regenerateSummarySchema), async (c) => {
  try {
    const chapterId = c.req.param('id');
    const { length } = c.req.valid('json');

    const summary = await readHelpService.regenerateSummary(chapterId, length);

    return c.json({ success: true, data: { summary, length } });
  } catch (error) {
    console.error('[Read Help API] Error regenerating summary:', error);
    return c.json(
      { success: false, error: { code: 'REGENERATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Search
// ============================================

/**
 * GET /api/read-help/search
 * Search across books
 */
readHelpRouter.get('/search', async (c) => {
  try {
    const query = c.req.query('q');
    const bookId = c.req.query('book_id');
    const limit = parseInt(c.req.query('limit') || '20', 10);

    if (!query) {
      return c.json(
        { success: false, error: { code: 'NO_QUERY', message: 'Search query is required' } },
        400
      );
    }

    const results = await readHelpService.search(query, { bookId, limit });

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('[Read Help API] Error searching:', error);
    return c.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// AI Chat / Tutoring
// ============================================

/**
 * POST /api/read-help/chat
 * Chat about book content
 */
const chatSchema = z.object({
  bookId: z.string().uuid(),
  message: z.string().min(1),
  chapterId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

readHelpRouter.post('/chat', zValidator('json', chatSchema), async (c) => {
  try {
    const { bookId, message, chapterId, conversationId } = c.req.valid('json');

    const result = await readHelpService.chat(bookId, message, { chapterId, conversationId });

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[Read Help API] Error in chat:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'CHAT_ERROR', message } },
      500
    );
  }
});

// ============================================
// Quizzes
// ============================================

/**
 * POST /api/read-help/chapters/:id/quiz
 * Generate a quiz for a chapter
 */
const generateQuizSchema = z.object({
  questionCount: z.number().min(1).max(20).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

readHelpRouter.post('/chapters/:id/quiz', zValidator('json', generateQuizSchema), async (c) => {
  try {
    const chapterId = c.req.param('id');
    const { questionCount, difficulty } = c.req.valid('json');

    const quiz = await readHelpService.generateQuiz(chapterId, { questionCount, difficulty });

    return c.json({ success: true, data: quiz });
  } catch (error) {
    console.error('[Read Help API] Error generating quiz:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'QUIZ_ERROR', message } },
      500
    );
  }
});

/**
 * POST /api/read-help/quizzes/:id/submit
 * Submit quiz answers
 */
const submitQuizSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    })
  ),
});

readHelpRouter.post('/quizzes/:id/submit', zValidator('json', submitQuizSchema), async (c) => {
  try {
    const quizId = c.req.param('id');
    const { answers } = c.req.valid('json');

    const results = await readHelpService.submitQuiz(quizId, answers);

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('[Read Help API] Error submitting quiz:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'SUBMIT_ERROR', message } },
      500
    );
  }
});

// ============================================
// Key Concepts
// ============================================

/**
 * GET /api/read-help/chapters/:id/concepts
 * Get key concepts from a chapter
 */
readHelpRouter.get('/chapters/:id/concepts', async (c) => {
  try {
    const chapterId = c.req.param('id');
    const concepts = await readHelpService.getKeyConcepts(chapterId);

    return c.json({ success: true, data: concepts });
  } catch (error) {
    console.error('[Read Help API] Error getting concepts:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'CONCEPTS_ERROR', message } },
      500
    );
  }
});

// ============================================
// Highlights
// ============================================

/**
 * POST /api/read-help/highlights
 * Create a highlight
 */
const createHighlightSchema = z.object({
  bookId: z.string().uuid(),
  chapterId: z.string().uuid().optional(),
  pageNumber: z.number().optional(),
  highlightedText: z.string().min(1),
  note: z.string().optional(),
  color: z.enum(['yellow', 'green', 'blue', 'pink', 'purple']).optional(),
  tags: z.array(z.string()).optional(),
});

readHelpRouter.post('/highlights', zValidator('json', createHighlightSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const result = await readHelpService.createHighlight(data.bookId, {
      chapterId: data.chapterId,
      pageNumber: data.pageNumber,
      highlightedText: data.highlightedText,
      note: data.note,
      color: data.color,
      tags: data.tags,
    });

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    console.error('[Read Help API] Error creating highlight:', error);
    return c.json(
      { success: false, error: { code: 'CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/books/:id/highlights
 * Get highlights for a book
 */
readHelpRouter.get('/books/:id/highlights', async (c) => {
  try {
    const bookId = c.req.param('id');
    const highlights = await readHelpService.getHighlights(bookId);

    return c.json({ success: true, data: highlights });
  } catch (error) {
    console.error('[Read Help API] Error getting highlights:', error);
    return c.json(
      { success: false, error: { code: 'GET_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * DELETE /api/read-help/highlights/:id
 * Delete a highlight
 */
readHelpRouter.delete('/highlights/:id', async (c) => {
  try {
    const highlightId = c.req.param('id');
    await readHelpService.deleteHighlight(highlightId);

    return c.json({ success: true, message: 'Highlight deleted' });
  } catch (error) {
    console.error('[Read Help API] Error deleting highlight:', error);
    return c.json(
      { success: false, error: { code: 'DELETE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Reading Progress
// ============================================

/**
 * GET /api/read-help/books/:id/progress
 * Get reading progress for a book
 */
readHelpRouter.get('/books/:id/progress', async (c) => {
  try {
    const bookId = c.req.param('id');
    const progress = await readHelpService.getProgress(bookId);

    if (!progress) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Progress not found' } },
        404
      );
    }

    return c.json({ success: true, data: progress });
  } catch (error) {
    console.error('[Read Help API] Error getting progress:', error);
    return c.json(
      { success: false, error: { code: 'PROGRESS_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * PUT /api/read-help/books/:id/progress
 * Update reading progress
 */
const updateProgressSchema = z.object({
  currentPage: z.number().min(1).optional(),
  minutesRead: z.number().min(0).optional(),
});

readHelpRouter.put('/books/:id/progress', zValidator('json', updateProgressSchema), async (c) => {
  try {
    const bookId = c.req.param('id');
    const data = c.req.valid('json');

    await readHelpService.updateProgress(bookId, data);

    return c.json({ success: true, message: 'Progress updated' });
  } catch (error) {
    console.error('[Read Help API] Error updating progress:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'UPDATE_ERROR', message } },
      500
    );
  }
});

// ============================================
// Flashcards
// ============================================

/**
 * POST /api/read-help/chapters/:id/flashcards
 * Generate flashcards from a chapter
 */
const generateFlashcardsSchema = z.object({
  count: z.number().min(1).max(50).optional(),
});

readHelpRouter.post('/chapters/:id/flashcards', zValidator('json', generateFlashcardsSchema), async (c) => {
  try {
    const chapterId = c.req.param('id');
    const { count } = c.req.valid('json');

    const flashcards = await readHelpService.generateFlashcards(chapterId, count);

    return c.json({ success: true, data: flashcards });
  } catch (error) {
    console.error('[Read Help API] Error generating flashcards:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'FLASHCARD_ERROR', message } },
      500
    );
  }
});

/**
 * GET /api/read-help/flashcards/due
 * Get flashcards due for review
 */
readHelpRouter.get('/flashcards/due', async (c) => {
  try {
    const bookId = c.req.query('book_id');
    const limit = parseInt(c.req.query('limit') || '20', 10);

    const flashcards = await readHelpService.getDueFlashcards(bookId, limit);

    return c.json({ success: true, data: flashcards });
  } catch (error) {
    console.error('[Read Help API] Error getting due flashcards:', error);
    return c.json(
      { success: false, error: { code: 'FLASHCARD_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * POST /api/read-help/flashcards/:id/review
 * Review a flashcard
 */
const reviewFlashcardSchema = z.object({
  quality: z.number().min(0).max(5), // SM-2 quality rating
});

readHelpRouter.post('/flashcards/:id/review', zValidator('json', reviewFlashcardSchema), async (c) => {
  try {
    const cardId = c.req.param('id');
    const { quality } = c.req.valid('json');

    await readHelpService.reviewFlashcard(cardId, quality as 0 | 1 | 2 | 3 | 4 | 5);

    return c.json({ success: true, message: 'Review recorded' });
  } catch (error) {
    console.error('[Read Help API] Error reviewing flashcard:', error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404
      );
    }

    return c.json(
      { success: false, error: { code: 'REVIEW_ERROR', message } },
      500
    );
  }
});

// ============================================
// Image Serving
// ============================================

/**
 * GET /api/read-help/books/:bookId/images/:imagePath
 * Serve extracted images (charts, diagrams, figures)
 */
readHelpRouter.get('/books/:bookId/images/*', async (c) => {
  try {
    const bookId = c.req.param('bookId');
    const imagePath = c.req.path.split('/images/')[1];

    // Get book to find storage directory
    const book = await readHelpService.getBook(bookId);
    if (!book) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Book not found' } }, 404);
    }

    // Construct full image path
    const fs = await import('fs');
    const path = await import('path');
    const bookDir = path.dirname(book.filePath);
    const fullImagePath = path.join(bookDir, 'images', imagePath);

    // Check if file exists
    if (!fs.existsSync(fullImagePath)) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } }, 404);
    }

    // Read and serve image
    const imageBuffer = fs.readFileSync(fullImagePath);
    const ext = path.extname(fullImagePath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('[Read Help API] Error serving image:', error);
    return c.json({ success: false, error: { code: 'SERVE_ERROR', message: String(error) } }, 500);
  }
});

export default readHelpRouter;
