import { eq, and, desc, asc, sql, ilike, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  readHelpBooks,
  readHelpChapters,
  readHelpSearchIndex,
  readHelpConversations,
  readHelpHighlights,
  readHelpQuizzes,
  readHelpProgress,
  readHelpFlashcards,
} from '../db/schema';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================
// Types
// ============================================

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
  status: string;
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

export interface FlashcardReviewResult {
  quality: 0 | 1 | 2 | 3 | 4 | 5; // 0=complete blackout, 5=perfect response
}

// ============================================
// Storage Configuration
// ============================================

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'read-help');
const BOOKS_DIR = path.join(STORAGE_DIR, 'books');

// Ensure storage directories exist
if (!fs.existsSync(BOOKS_DIR)) {
  fs.mkdirSync(BOOKS_DIR, { recursive: true });
}

// ============================================
// Read Help Service
// ============================================

export class ReadHelpService {
  private openai: OpenAI;
  private openaiGPT: OpenAI;

  constructor() {
    // Use Ollama's OpenAI-compatible API for local LLM (chat, quick tasks)
    this.openai = new OpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // Ollama doesn't need a real key
    });

    // Use actual OpenAI for summaries (better instruction following)
    this.openaiGPT = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // ============================================
  // Book Management
  // ============================================

  /**
   * Upload and process a new book
   */
  async uploadBook(
    file: File | Buffer,
    filename: string,
    metadata?: { title?: string; author?: string; tags?: string[] }
  ): Promise<Book> {
    // Generate file hash for deduplication
    const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate
    const existing = await db
      .select()
      .from(readHelpBooks)
      .where(eq(readHelpBooks.fileHash, fileHash))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`This book has already been uploaded: ${existing[0].title}`);
    }

    // Create book record first (with processing status)
    const title = metadata?.title || filename.replace(/\.pdf$/i, '');
    const [book] = await db
      .insert(readHelpBooks)
      .values({
        title,
        author: metadata?.author || null,
        filePath: '', // Will update after saving file
        fileHash,
        fileSizeBytes: buffer.length,
        status: 'processing',
        processingProgress: 0,
        tags: metadata?.tags || null,
      })
      .returning();

    // Save file to storage
    const bookDir = path.join(BOOKS_DIR, book.id);
    fs.mkdirSync(bookDir, { recursive: true });
    const filePath = path.join(bookDir, 'original.pdf');
    fs.writeFileSync(filePath, buffer);

    // Update file path
    await db.update(readHelpBooks).set({ filePath }).where(eq(readHelpBooks.id, book.id));

    // Process the book asynchronously (in real implementation, this would be a job)
    this.processBook(book.id, buffer).catch(console.error);

    return this.formatBook({ ...book, filePath });
  }

  /**
   * Process a book: extract text, detect chapters, index for search
   * Supports both text-based and scanned (image) PDFs via OCR
   */
  private async processBook(bookId: string, buffer: Buffer): Promise<void> {
    try {
      // Update progress
      await this.updateBookProgress(bookId, 10, 'Extracting text...');

      // Extract text from PDF (pdf-parse v1.x uses default export)
      const pdfParseModule = await import('pdf-parse');
      // Handle both ESM and CJS export styles
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const pdfData = await pdfParse(buffer);

      const pageCount = pdfData.numpages;
      let fullText = pdfData.text;
      let wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;

      // Check if PDF is scanned/image-based (very low text content)
      const wordsPerPage = pageCount > 0 ? wordCount / pageCount : 0;
      const isScannedPdf = wordsPerPage < 10; // Less than 10 words per page suggests scanned PDF

      if (isScannedPdf && pageCount > 0) {
        console.log(`[ReadHelp] Detected scanned PDF (${wordsPerPage.toFixed(1)} words/page). Running OCR...`);
        await this.updateBookProgress(bookId, 15, 'Running OCR on scanned pages...');

        try {
          fullText = await this.extractTextWithOCR(bookId, buffer, pageCount);
          wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
          console.log(`[ReadHelp] OCR completed. Extracted ${wordCount} words.`);
        } catch (ocrError) {
          console.error(`[ReadHelp] OCR failed:`, ocrError);
          // Continue with whatever text we have
        }
      }

      // Extract images from PDF (charts, diagrams, figures)
      await this.updateBookProgress(bookId, 25, 'Extracting images...');
      const [book] = await db.select().from(readHelpBooks).where(eq(readHelpBooks.id, bookId)).limit(1);
      if (book) {
        await this.extractImagesFromPDF(bookId, book.filePath, pageCount);
      }

      await this.updateBookProgress(bookId, 30, 'Detecting chapters...');

      // Detect chapters (simple heuristic - can be improved)
      const chapters = await this.detectChapters(bookId, fullText, pageCount);

      await this.updateBookProgress(bookId, 60, 'Indexing for search...');

      // Index content for search
      await this.indexBookContent(bookId, chapters);

      await this.updateBookProgress(bookId, 90, 'Finalizing...');

      // Update book status to ready
      await db
        .update(readHelpBooks)
        .set({
          status: 'ready',
          processingProgress: 100,
          pageCount,
          totalWordCount: wordCount,
          updatedAt: new Date(),
        })
        .where(eq(readHelpBooks.id, bookId));

      // Create initial progress record
      await db.insert(readHelpProgress).values({
        bookId,
        currentPage: 1,
        percentComplete: 0,
        pagesRead: 0,
        chaptersCompleted: 0,
        totalReadingTimeMinutes: 0,
        sessionCount: 0,
        sessions: [],
      });
    } catch (error) {
      console.error(`Error processing book ${bookId}:`, error);
      await db
        .update(readHelpBooks)
        .set({
          status: 'error',
          processingError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(readHelpBooks.id, bookId));
    }
  }

  private async updateBookProgress(bookId: string, progress: number, _message?: string): Promise<void> {
    await db
      .update(readHelpBooks)
      .set({ processingProgress: progress, updatedAt: new Date() })
      .where(eq(readHelpBooks.id, bookId));
  }

  /**
   * Extract text from PDF file (for re-processing)
   */
  private async extractTextFromPDF(pdfPath: string): Promise<string> {
    const fs = await import('fs');
    const buffer = fs.readFileSync(pdfPath);

    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const pdfData = await pdfParse(buffer);

    return pdfData.text;
  }

  /**
   * Extract text from scanned PDF using OCR
   * Converts PDF pages to images, then runs Tesseract OCR on each
   */
  private async extractTextWithOCR(bookId: string, buffer: Buffer, pageCount: number): Promise<string> {
    const { pdf } = await import('pdf-to-img');
    const Tesseract = await import('tesseract.js');

    const allText: string[] = [];
    const batchSize = 10; // Process 10 pages at a time to manage memory

    // Convert Buffer to Uint8Array for pdf-to-img
    const pdfDocument = await pdf(buffer, { scale: 2.0 }); // Scale 2x for better OCR

    let pageNum = 0;
    for await (const pageImage of pdfDocument) {
      pageNum++;

      // Update progress (15% to 55% for OCR phase)
      const ocrProgress = 15 + Math.floor((pageNum / pageCount) * 40);
      await this.updateBookProgress(bookId, ocrProgress, `OCR page ${pageNum}/${pageCount}...`);

      try {
        // Run OCR on the page image
        const result = await Tesseract.recognize(pageImage, 'eng', {
          logger: () => {}, // Suppress verbose logging
        });

        if (result.data.text) {
          allText.push(`--- Page ${pageNum} ---\n${result.data.text}`);
        }
      } catch (pageError) {
        console.error(`[ReadHelp] OCR error on page ${pageNum}:`, pageError);
        // Continue with other pages
      }

      // Memory cleanup hint
      if (pageNum % batchSize === 0) {
        if (global.gc) global.gc();
      }
    }

    return allText.join('\n\n');
  }

  /**
   * Extract images (charts, diagrams, figures) from PDF
   * Stores them in the book's images directory
   */
  private async extractImagesFromPDF(bookId: string, pdfPath: string, pageCount: number): Promise<void> {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

      // Load PDF - convert Buffer to Uint8Array for pdfjs
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfData = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjs.getDocument({ data: pdfData });
      const pdfDoc = await loadingTask.promise;

      // Create images directory
      const bookDir = path.dirname(pdfPath);
      const imagesDir = path.join(bookDir, 'images');
      fs.mkdirSync(imagesDir, { recursive: true });

      console.log(`[ReadHelp] Extracting images from ${pageCount} pages...`);

      // Track images by page for associating with chapters later
      const imagesByPage: Map<number, Array<{ path: string; type: string }>> = new Map();

      // Extract images from each page
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const operatorList = await page.getOperatorList();

        let imageIndex = 0;

        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];

          // Check if this operation is an image (Do = inline image, paintImageXObject = XObject image)
          if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
            try {
              imageIndex++;

              // Get the image
              const imageName = operatorList.argsArray[i][0];
              const imageData = page.objs.get(imageName);

              if (imageData && imageData.width && imageData.height) {
                // Skip very small images (likely icons or decorative elements)
                if (imageData.width < 100 || imageData.height < 100) {
                  continue;
                }

                // Determine image type (likely charts/diagrams if large)
                const aspectRatio = imageData.width / imageData.height;
                let imageType = 'figure';
                if (aspectRatio > 1.2 && imageData.width > 300) {
                  imageType = 'chart';
                } else if (imageData.width > 400 && imageData.height > 400) {
                  imageType = 'diagram';
                }

                // Save image as PNG
                const imagePath = path.join(imagesDir, `page${pageNum}_img${imageIndex}.png`);
                const relativePath = `images/page${pageNum}_img${imageIndex}.png`;

                // Convert image data to PNG (this is a simplified version)
                // In production, you'd want to use canvas or sharp to properly convert
                console.log(`[ReadHelp] Found ${imageType} on page ${pageNum} (${imageData.width}x${imageData.height})`);

                // Track this image
                if (!imagesByPage.has(pageNum)) {
                  imagesByPage.set(pageNum, []);
                }
                imagesByPage.get(pageNum)!.push({
                  path: relativePath,
                  type: imageType
                });
              }
            } catch (imageError) {
              console.warn(`[ReadHelp] Could not extract image from page ${pageNum}:`, imageError);
            }
          }
        }
      }

      console.log(`[ReadHelp] Found ${Array.from(imagesByPage.values()).flat().length} images across ${imagesByPage.size} pages`);

      // Update chapters with image references
      // We'll do this after chapters are created, in the detectChapters method
      // For now, store the image data in a temp file for later association
      const imageMapPath = path.join(bookDir, 'images-map.json');
      const imageMapData = Object.fromEntries(imagesByPage);
      fs.writeFileSync(imageMapPath, JSON.stringify(imageMapData, null, 2));

    } catch (error) {
      console.error(`[ReadHelp] Image extraction failed:`, error);
      // Don't fail the whole process if image extraction fails
    }
  }

  /**
   * Detect chapters in the text using AI and heuristics
   * Enhanced to detect business school case packets
   */
  private async detectChapters(
    bookId: string,
    fullText: string,
    pageCount: number
  ): Promise<Chapter[]> {
    const lines = fullText.split('\n');

    // First, try to detect if this is a case packet
    const caseMatches = this.detectBusinessCases(lines);

    if (caseMatches.length >= 2) {
      // This appears to be a case packet - use case boundaries
      console.log(`[ReadHelp] Detected ${caseMatches.length} business cases in packet`);
      return this.createChaptersFromCases(bookId, lines, caseMatches, pageCount);
    }

    // Fall back to traditional chapter detection
    const chapterMatches = this.detectTraditionalChapters(lines);

    if (chapterMatches.length > 0) {
      return this.createChaptersFromMatches(bookId, lines, chapterMatches, pageCount);
    }

    // No chapters detected, create a single chapter for the whole book
    const [chapter] = await db
      .insert(readHelpChapters)
      .values({
        bookId,
        chapterNumber: 1,
        title: 'Full Book',
        startPage: 1,
        endPage: pageCount,
        content: fullText,
        wordCount: fullText.split(/\s+/).length,
      })
      .returning();

    return [this.formatChapter(chapter)];
  }

  /**
   * Detect business school cases (HBS, etc.) by case numbers and headers
   * IMPROVED VERSION: Detects actual case starts, filtering duplicates and noise
   * Handles two formats:
   *   Format 1: Case number on its own line (modern cases)
   *   Format 2: "Harvard Business School [case-number]" on same line (older cases)
   */
  private detectBusinessCases(lines: string[]): Array<{
    lineNum: number;
    caseNumber: string;
    title: string;
    publisher: string;
  }> {
    const cases: Array<{ lineNum: number; caseNumber: string; title: string; publisher: string }> = [];
    const seenCaseNumbers = new Set<string>();

    // Pattern for HBS case numbers: X-XXX-XXX or XX-XXX-XXX
    const caseNumberPattern = /\b(\d{1,2}-\d{2,3}-\d{1,3})\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this line contains a case number
      const match = caseNumberPattern.exec(line);
      if (!match) {
        continue;
      }

      const caseNumber = match[1];

      // Skip if we've already seen this case number (avoid duplicates from headers/footers)
      if (seenCaseNumbers.has(caseNumber)) {
        continue;
      }

      // Skip obvious false positives (phone numbers, etc.)
      if (caseNumber.startsWith('1-800') || caseNumber.startsWith('1-888')) {
        continue;
      }

      // Validate this is a case start by checking for HBS indicator
      let isValidCaseStart = false;

      // Format 1: "Harvard Business School X-XXX-XXX" on same line
      if (line.includes('Harvard Business School')) {
        isValidCaseStart = true;
      }
      // Format 2: Case number on its own line, with HBS header above
      else if (line === caseNumber) {
        for (let j = Math.max(0, i - 10); j < i; j++) {
          if (lines[j].includes('HARVARD BUSINESS SCHOOL') || lines[j].includes('Harvard Business School')) {
            isValidCaseStart = true;
            break;
          }
        }
        // Additional check: look for content below (not just a page footer)
        if (!isValidCaseStart) {
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (nextLine.length > 15 && !nextLine.startsWith('Only for') && !nextLine.startsWith('Copyright')) {
              isValidCaseStart = true;
              break;
            }
          }
        }
      }

      if (!isValidCaseStart) {
        continue;
      }

      // Look for the case title in lines after the case number
      let title = 'Untitled Case';
      const publisher = 'Harvard Business School';

      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const titleCandidate = lines[j].trim();

        // Skip empty lines, dates, author names, and metadata
        if (titleCandidate.length === 0 ||
            titleCandidate.length < 5 ||
            /^\d+$/.test(titleCandidate) || // Just numbers
            /^(Rev\.|REV:|Revised|;|Copyright|Only for|PKT\d+|Reprinted by)/.test(titleCandidate) || // Metadata
            titleCandidate.includes('SEPTEMBER') ||
            titleCandidate.includes('NOVEMBER') ||
            titleCandidate.includes('DECEMBER') ||
            titleCandidate.includes('JANUARY') ||
            titleCandidate.includes('FEBRUARY') ||
            titleCandidate.includes('MARCH') ||
            titleCandidate.includes('APRIL') ||
            titleCandidate.includes('MAY ') ||
            titleCandidate.includes('JUNE') ||
            titleCandidate.includes('JULY') ||
            titleCandidate.includes('AUGUST') ||
            titleCandidate.includes('OCTOBER') ||
            titleCandidate.includes('BYU in MBA')
        ) {
          continue;
        }

        // Skip lines that are all uppercase and short (likely author names)
        const isAllCaps = titleCandidate === titleCandidate.toUpperCase() &&
                         titleCandidate.length < 40 &&
                         !titleCandidate.includes(':');

        if (isAllCaps) {
          continue;
        }

        // Found a good title candidate
        if (titleCandidate.length >= 5 && titleCandidate.length <= 120) {
          title = titleCandidate;
          break;
        }
      }

      // Add this case
      seenCaseNumbers.add(caseNumber);
      cases.push({
        lineNum: i,
        caseNumber,
        title,
        publisher,
      });
    }

    console.log(`[ReadHelp] detectBusinessCases: Found ${cases.length} unique cases`);
    for (const c of cases) {
      console.log(`  - ${c.caseNumber}: ${c.title}`);
    }

    return cases;
  }

  /**
   * Traditional chapter detection for regular books
   */
  private detectTraditionalChapters(lines: string[]): Array<{ index: number; title: string; lineNum: number }> {
    const chapterPatterns = [
      /^(Chapter|CHAPTER)\s+(\d+|[A-Z]+)\s*[:\.\-]?\s*(.*)$/gim,
      /^(\d+)\s*[:\.\-]\s+(.+)$/gim,
      /^(Part|PART)\s+(\d+|[A-Z]+)\s*[:\.\-]?\s*(.*)$/gim,
    ];

    const chapterMatches: Array<{ index: number; title: string; lineNum: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      for (const pattern of chapterPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match && line.length < 100) {
          chapterMatches.push({
            index: i,
            title: line,
            lineNum: i,
          });
          break;
        }
      }
    }

    return chapterMatches;
  }

  /**
   * Create chapters from detected business cases
   */
  private async createChaptersFromCases(
    bookId: string,
    lines: string[],
    caseMatches: Array<{ lineNum: number; caseNumber: string; title: string; publisher: string }>,
    pageCount: number
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const linesPerPage = Math.ceil(lines.length / pageCount);

    // Load image map if it exists
    const [book] = await db.select().from(readHelpBooks).where(eq(readHelpBooks.id, bookId)).limit(1);
    const bookDir = book ? path.dirname(book.filePath) : null;
    let imagesMap: Record<string, Array<{ path: string; type: string }>> = {};
    if (bookDir) {
      const imageMapPath = path.join(bookDir, 'images-map.json');
      if (fs.existsSync(imageMapPath)) {
        imagesMap = JSON.parse(fs.readFileSync(imageMapPath, 'utf-8'));
      }
    }

    for (let i = 0; i < caseMatches.length; i++) {
      const currentCase = caseMatches[i];
      const nextCase = caseMatches[i + 1];

      // Get content between this case and the next
      const startLine = currentCase.lineNum;
      let endLine: number;

      if (nextCase) {
        // For the end boundary, look backward from the next case start to find where content actually ends
        // Skip blank lines and common footer/header markers
        endLine = nextCase.lineNum - 1;

        // Scan backward from next case to include all content of current case
        // Stop at blank lines that might separate cases
        for (let j = nextCase.lineNum - 1; j > currentCase.lineNum + 10; j--) {
          const line = lines[j].trim();

          // If we hit substantial content (not just page numbers, footers, etc), this is likely the real end
          if (line.length > 30 &&
              !line.match(/^Only for individual use/) &&
              !line.match(/^No posting, copying/) &&
              !line.match(/^\d+$/) && // Page numbers
              !line.match(/^[A-Z\s]+$/) // All caps (likely headers)
          ) {
            // Found substantial content - include everything up to here
            endLine = j;
            break;
          }
        }
      } else {
        // Last case - include everything to the end
        endLine = lines.length - 1;
      }

      const content = lines.slice(startLine, endLine + 1).join('\n');

      // Estimate page numbers
      const startPage = Math.max(1, Math.floor(startLine / linesPerPage) + 1);
      const endPage = Math.min(pageCount, Math.ceil(endLine / linesPerPage) + 1);

      // Format title with case number
      const chapterTitle = `${currentCase.title} (${currentCase.caseNumber})`;

      // Find images within this chapter's page range
      const chapterImages: Array<{ path: string; pageNumber: number; type: string }> = [];
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        const pageImages = imagesMap[pageNum.toString()];
        if (pageImages) {
          pageImages.forEach(img => {
            chapterImages.push({ ...img, pageNumber: pageNum });
          });
        }
      }

      const [chapter] = await db
        .insert(readHelpChapters)
        .values({
          bookId,
          chapterNumber: i + 1,
          title: chapterTitle,
          startPage,
          endPage,
          content,
          wordCount: content.split(/\s+/).length,
          images: chapterImages,
        })
        .returning();

      chapters.push(this.formatChapter(chapter));
    }

    return chapters;
  }

  /**
   * Create chapters from traditional chapter matches
   */
  private async createChaptersFromMatches(
    bookId: string,
    lines: string[],
    chapterMatches: Array<{ index: number; title: string; lineNum: number }>,
    pageCount: number
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const linesPerPage = Math.ceil(lines.length / pageCount);

    for (let i = 0; i < chapterMatches.length; i++) {
      const currentMatch = chapterMatches[i];
      const nextMatch = chapterMatches[i + 1];

      const startLine = currentMatch.lineNum;
      const endLine = nextMatch ? nextMatch.lineNum - 1 : lines.length - 1;
      const content = lines.slice(startLine, endLine + 1).join('\n');

      const startPage = Math.max(1, Math.floor(startLine / linesPerPage) + 1);
      const endPage = Math.min(pageCount, Math.ceil(endLine / linesPerPage) + 1);

      const [chapter] = await db
        .insert(readHelpChapters)
        .values({
          bookId,
          chapterNumber: i + 1,
          title: currentMatch.title,
          startPage,
          endPage,
          content,
          wordCount: content.split(/\s+/).length,
        })
        .returning();

      chapters.push(this.formatChapter(chapter));
    }

    return chapters;
  }

  /**
   * Index book content for full-text search
   */
  private async indexBookContent(bookId: string, chapters: Chapter[]): Promise<void> {
    const CHUNK_SIZE = 1000; // characters per chunk

    for (const chapter of chapters) {
      const content = chapter.content;
      const chunks = this.chunkText(content, CHUNK_SIZE);

      for (let i = 0; i < chunks.length; i++) {
        await db.insert(readHelpSearchIndex).values({
          bookId,
          chapterId: chapter.id,
          pageNumber: chapter.startPage,
          chunkIndex: i,
          content: chunks[i],
          searchVector: chunks[i].toLowerCase(), // Simple - in production use proper tsvector
        });
      }
    }
  }

  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let endIndex = currentIndex + chunkSize;

      // Try to end at a sentence boundary
      if (endIndex < text.length) {
        const nextPeriod = text.indexOf('.', endIndex);
        if (nextPeriod !== -1 && nextPeriod < endIndex + 200) {
          endIndex = nextPeriod + 1;
        }
      }

      chunks.push(text.slice(currentIndex, endIndex).trim());
      currentIndex = endIndex;
    }

    return chunks;
  }

  /**
   * Get all books
   */
  async listBooks(options?: { archived?: boolean; search?: string }): Promise<Book[]> {
    let query = db.select().from(readHelpBooks);

    if (options?.archived !== undefined) {
      query = query.where(eq(readHelpBooks.isArchived, options.archived)) as typeof query;
    }

    if (options?.search) {
      query = query.where(ilike(readHelpBooks.title, `%${options.search}%`)) as typeof query;
    }

    const books = await query.orderBy(desc(readHelpBooks.lastReadAt), desc(readHelpBooks.createdAt));
    return books.map((b) => this.formatBook(b));
  }

  /**
   * Re-process chapters for a book (useful after improving detection algorithms)
   */
  async reprocessChapters(bookId: string): Promise<{ success: boolean; chaptersDetected: number }> {
    // Get the book
    const [book] = await db
      .select()
      .from(readHelpBooks)
      .where(eq(readHelpBooks.id, bookId))
      .limit(1);

    if (!book) {
      throw new Error('Book not found');
    }

    console.log(`[ReadHelp] Re-processing chapters for book: ${book.title}`);

    // Delete existing chapters and search index
    await db.delete(readHelpSearchIndex).where(eq(readHelpSearchIndex.bookId, bookId));
    await db.delete(readHelpChapters).where(eq(readHelpChapters.bookId, bookId));

    // Re-extract text from PDF
    const pdfPath = book.filePath;
    const fullText = await this.extractTextFromPDF(pdfPath);

    // Re-detect chapters with new algorithm
    const chapters = await this.detectChapters(bookId, fullText, book.pageCount);

    // Re-index content
    await this.indexBookContent(bookId, chapters);

    console.log(`[ReadHelp] Re-processed ${chapters.length} chapters for book: ${book.title}`);

    return {
      success: true,
      chaptersDetected: chapters.length,
    };
  }

  /**
   * Get a book by ID
   */
  async getBook(bookId: string): Promise<Book | null> {
    const [book] = await db.select().from(readHelpBooks).where(eq(readHelpBooks.id, bookId)).limit(1);

    return book ? this.formatBook(book) : null;
  }

  /**
   * Get book processing status
   */
  async getBookStatus(bookId: string): Promise<{ status: string; progress: number; error?: string }> {
    const book = await this.getBook(bookId);
    if (!book) {
      throw new Error('Book not found');
    }
    return {
      status: book.status,
      progress: book.processingProgress || 0,
      error: book.processingError || undefined,
    };
  }

  /**
   * Delete a book and all related data
   */
  async deleteBook(bookId: string): Promise<void> {
    const book = await this.getBook(bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    // Delete from database (cascades to related tables)
    await db.delete(readHelpBooks).where(eq(readHelpBooks.id, bookId));

    // Delete files
    const bookDir = path.join(BOOKS_DIR, bookId);
    if (fs.existsSync(bookDir)) {
      fs.rmSync(bookDir, { recursive: true });
    }
  }

  /**
   * Update book metadata
   */
  async updateBook(
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
    const [book] = await db
      .update(readHelpBooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(readHelpBooks.id, bookId))
      .returning();

    return this.formatBook(book);
  }

  // ============================================
  // Chapter Management
  // ============================================

  /**
   * Get chapters for a book
   */
  async getChapters(bookId: string): Promise<Chapter[]> {
    const chapters = await db
      .select()
      .from(readHelpChapters)
      .where(eq(readHelpChapters.bookId, bookId))
      .orderBy(asc(readHelpChapters.chapterNumber));

    return chapters.map((c) => this.formatChapter(c));
  }

  /**
   * Get a specific chapter
   */
  async getChapter(chapterId: string): Promise<Chapter | null> {
    const [chapter] = await db
      .select()
      .from(readHelpChapters)
      .where(eq(readHelpChapters.id, chapterId))
      .limit(1);

    return chapter ? this.formatChapter(chapter) : null;
  }

  // ============================================
  // Summaries
  // ============================================

  /**
   * Generate or retrieve a chapter summary
   */
  async getChapterSummary(
    chapterId: string,
    length: 'short' | 'medium' | 'long'
  ): Promise<string> {
    const chapter = await this.getChapter(chapterId);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    // Check if summary already exists
    const existingSummary =
      length === 'short'
        ? chapter.summaryShort
        : length === 'medium'
        ? chapter.summaryMedium
        : chapter.summaryLong;

    if (existingSummary) {
      return existingSummary;
    }

    // Generate new summary
    const summary = await this.generateSummary(chapter.content, length);

    // Cache the summary
    const updateField =
      length === 'short'
        ? { summaryShort: summary }
        : length === 'medium'
        ? { summaryMedium: summary }
        : { summaryLong: summary };

    await db
      .update(readHelpChapters)
      .set({ ...updateField, summaryGeneratedAt: new Date() })
      .where(eq(readHelpChapters.id, chapterId));

    return summary;
  }

  /**
   * Generate a summary using AI
   * Optimized for time-based reading: medium = 15 min, long = 30 min
   */
  private async generateSummary(
    content: string,
    length: 'short' | 'medium' | 'long'
  ): Promise<string> {
    // Time-based word targets (reading speed: ~250 words/min)
    const wordTargets = {
      short: 150,      // Quick overview
      medium: 3500,    // 15-minute read
      long: 7000,      // 30-minute read
    };

    const prompts = {
      short: `Create a brief overview (150 words) of this business case. Focus on the main problem and key decision.`,
      medium: `Create a comprehensive 15-minute summary (3000-3500 words) of this business case.

Structure your summary as follows:

## Executive Summary
Brief overview of the case (2-3 paragraphs)

## Situation Analysis
- Company background and industry context
- Key players and stakeholders
- Market dynamics and competitive landscape
- Financial situation

## Core Problem/Challenge
- Primary issue or decision to be made
- Why this matters
- Constraints and considerations

## Key Facts & Data
- Important numbers, metrics, and trends
- Timeline of events
- Critical information from exhibits

## Strategic Options
- Available alternatives or paths forward
- Pros and cons of each option
- Risks and opportunities

## Key Frameworks & Concepts
- Relevant business frameworks used in the case
- Strategic tools applicable to analysis

Make it detailed enough for someone to understand the case without reading the full version, but appropriate for a 15-minute read.`,
      long: `Create an in-depth 30-minute summary (6500-7000 words) of this business case.

Structure your summary comprehensively:

## Executive Summary
Detailed overview of the case situation, key issues, and decision to be made (3-4 paragraphs)

## Company & Industry Background
- Company history and evolution
- Industry structure and dynamics
- Competitive landscape
- Market trends and forces
- Regulatory environment

## Situation Analysis
- Current business situation
- Financial performance and position
- Operational details
- Organizational structure
- Key stakeholders and their perspectives

## The Core Challenge
- Primary problem or strategic decision
- Root causes and contributing factors
- Why action is needed now
- What's at stake

## Detailed Analysis
- Key facts, data, and metrics
- Timeline of important events
- Exhibit data and what it reveals
- Customer insights
- Competitive positioning

## Strategic Options & Alternatives
- Available courses of action
- Detailed pros and cons for each
- Implementation considerations
- Risks and mitigation strategies
- Resource requirements

## Business Frameworks & Analysis Tools
- Relevant frameworks (Porter's 5 Forces, SWOT, etc.)
- How they apply to this situation
- Strategic insights they reveal

## Key Quotes & Perspectives
- Important statements from protagonists
- Different viewpoints on the situation

## Teaching Points
- Key lessons from the case
- Strategic principles illustrated

Make this thorough enough that an MBA student could discuss the case in depth after reading just this summary.`,
    };

    const prompt = prompts[length];
    const targetWords = wordTargets[length];

    // For longer summaries, use more content
    const maxContentLength = length === 'long' ? 20000 : length === 'medium' ? 15000 : 8000;
    const truncatedContent =
      content.length > maxContentLength ? content.slice(0, maxContentLength) + '\n\n[Content truncated for processing]' : content;

    // Try GPT-4 first (better at following instructions), fall back to local llama3.1:8b
    let response;
    try {
      response = await this.openaiGPT.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        max_tokens: length === 'long' ? 12000 : length === 'medium' ? 6000 : 500,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing and summarizing Harvard Business School cases. Create summaries that capture all essential information while being readable and well-structured. IMPORTANT: Follow the target word count precisely.',
          },
          {
            role: 'user',
            content: `${prompt}

CRITICAL: Your summary MUST be approximately ${targetWords} words. Do not make it shorter. This is a strict requirement.

Case Content:
${truncatedContent}`,
          },
        ],
      });
    } catch (error) {
      console.warn('[ReadHelpService] GPT-4 unavailable, falling back to local LLM:', String(error).slice(0, 100));

      // Fall back to local llama3.1:70b with improved prompting
      // Use 70b model for better instruction following and longer outputs
      if (length === 'long') {
        // For 30-min summaries, use single call with 70b model (better than splitting)
        const longPrompt = `You are an expert MBA case study analyst creating a comprehensive 30-minute summary.

${prompt}

CRITICAL REQUIREMENTS:
- Your summary MUST be 6500-7000 words
- Be extremely detailed and thorough
- Include specific numbers, quotes, and data from the case
- Expand on every section with multiple paragraphs
- Think of this as a complete case analysis, not a summary

Case Content:
${truncatedContent}`;

        response = await this.openai.chat.completions.create({
          model: 'llama3.1:70b',
          max_tokens: 12000,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing Harvard Business School cases. You excel at creating detailed, comprehensive analyses. Always write the full target word count.',
            },
            { role: 'user', content: longPrompt }
          ],
        });
      } else if (length === 'medium') {
        // For 15-min summaries, use single call with 70b model
        const mediumPrompt = `You are an expert MBA case study analyst creating a detailed 15-minute summary.

${prompt}

CRITICAL REQUIREMENTS:
- Your summary MUST be 3000-3500 words
- Be thorough and detailed
- Include specific facts, data, and examples
- Expand each section with multiple paragraphs

Case Content:
${truncatedContent}`;

        response = await this.openai.chat.completions.create({
          model: 'llama3.1:70b',
          max_tokens: 6000,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing business cases. You excel at creating detailed analyses. Always write the full target word count.',
            },
            { role: 'user', content: mediumPrompt }
          ],
        });
      } else {
        // Short summary - use 8b model (good enough for short summaries)
        response = await this.openai.chat.completions.create({
          model: 'llama3.1:8b',
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing business cases. Create a brief overview.',
            },
            {
              role: 'user',
              content: `${prompt}

Case Content:
${truncatedContent}`,
            },
          ],
        });
      }
    }

    return response.choices[0]?.message?.content || 'Summary generation failed';
  }

  /**
   * Regenerate a chapter summary
   */
  async regenerateSummary(
    chapterId: string,
    length: 'short' | 'medium' | 'long'
  ): Promise<string> {
    // Clear existing summary
    const clearField =
      length === 'short'
        ? { summaryShort: null }
        : length === 'medium'
        ? { summaryMedium: null }
        : { summaryLong: null };

    await db.update(readHelpChapters).set(clearField).where(eq(readHelpChapters.id, chapterId));

    // Generate fresh
    return this.getChapterSummary(chapterId, length);
  }

  // ============================================
  // Search
  // ============================================

  /**
   * Search across all books or a specific book
   */
  async search(query: string, options?: { bookId?: string; chapterId?: string; limit?: number }): Promise<SearchResult[]> {
    const limit = options?.limit || 20;
    const searchTerms = query.toLowerCase().split(/\s+/);

    // Fetch ALL search index entries for the book(s) to search in-memory
    // This is not ideal for large datasets, but works for our use case
    // TODO: Use PostgreSQL full-text search with tsvector for better performance
    let searchQuery = db
      .select({
        id: readHelpSearchIndex.id,
        bookId: readHelpSearchIndex.bookId,
        chapterId: readHelpSearchIndex.chapterId,
        pageNumber: readHelpSearchIndex.pageNumber,
        content: readHelpSearchIndex.content,
      })
      .from(readHelpSearchIndex);

    // Apply filters
    const filters = [];
    if (options?.bookId) {
      filters.push(eq(readHelpSearchIndex.bookId, options.bookId));
    }
    if (options?.chapterId) {
      filters.push(eq(readHelpSearchIndex.chapterId, options.chapterId));
    }
    if (filters.length > 0) {
      searchQuery = searchQuery.where(filters.length === 1 ? filters[0] : and(...filters)) as typeof searchQuery;
    }

    // Fetch ALL results (no limit) to avoid missing matches
    const results = await searchQuery;

    // Score and filter results
    const scoredResults = results
      .map((r) => {
        const contentLower = r.content.toLowerCase();
        let score = 0;
        for (const term of searchTerms) {
          if (contentLower.includes(term)) {
            score += 1;
            // Bonus for exact phrase match
            if (contentLower.includes(query.toLowerCase())) {
              score += 5;
            }
          }
        }
        return { ...r, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Enrich with book and chapter info
    const enrichedResults: SearchResult[] = [];
    for (const result of scoredResults) {
      const book = await this.getBook(result.bookId);
      const chapter = result.chapterId ? await this.getChapter(result.chapterId) : null;

      // Highlight search terms in content
      let highlightedContent = result.content;
      for (const term of searchTerms) {
        const regex = new RegExp(`(${term})`, 'gi');
        highlightedContent = highlightedContent.replace(regex, '**$1**');
      }

      enrichedResults.push({
        bookId: result.bookId,
        bookTitle: book?.title || 'Unknown',
        chapterId: result.chapterId,
        chapterTitle: chapter?.title || null,
        pageNumber: result.pageNumber,
        content: result.content.slice(0, 300) + (result.content.length > 300 ? '...' : ''),
        highlightedContent:
          highlightedContent.slice(0, 300) + (highlightedContent.length > 300 ? '...' : ''),
        score: result.score,
      });
    }

    return enrichedResults;
  }

  // ============================================
  // AI Chat / Tutoring
  // ============================================

  /**
   * Chat about book content
   */
  async chat(
    bookId: string,
    message: string,
    options?: { chapterId?: string; conversationId?: string }
  ): Promise<{ response: string; conversationId: string; citations: Array<{ page: number; text: string }> }> {
    const book = await this.getBook(bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    // Get or create conversation
    let conversation: { id: string; messages: ChatMessage[] };
    if (options?.conversationId) {
      const [existing] = await db
        .select()
        .from(readHelpConversations)
        .where(eq(readHelpConversations.id, options.conversationId))
        .limit(1);

      if (existing) {
        conversation = {
          id: existing.id,
          messages: (existing.messages as ChatMessage[]) || [],
        };
      } else {
        conversation = await this.createConversation(bookId, options?.chapterId);
      }
    } else {
      conversation = await this.createConversation(bookId, options?.chapterId);
    }

    // Get relevant context from the book
    const context = await this.getRelevantContext(bookId, message, options?.chapterId);

    // Build conversation history - limit to last 4 messages for speed
    const historyMessages = conversation.messages.slice(-4).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content.slice(0, 500), // Truncate long messages
    }));

    // Optimized system prompt for local LLM
    const systemPrompt = `Book tutor for "${book.title}". Answer based on this context:
${context.text}

Be concise. Cite page numbers when possible.`;

    const response = await this.openai.chat.completions.create({
      model: 'llama3.1:8b',
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
    });

    const responseText = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    // Save messages to conversation
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      citations: context.citations,
    };

    await db
      .update(readHelpConversations)
      .set({
        messages: [...conversation.messages, userMessage, assistantMessage],
        updatedAt: new Date(),
      })
      .where(eq(readHelpConversations.id, conversation.id));

    return {
      response: responseText,
      conversationId: conversation.id,
      citations: context.citations,
    };
  }

  private async createConversation(
    bookId: string,
    chapterId?: string
  ): Promise<{ id: string; messages: ChatMessage[] }> {
    const [conv] = await db
      .insert(readHelpConversations)
      .values({
        bookId,
        chapterId: chapterId || null,
        context: chapterId ? 'chapter' : 'book',
        messages: [],
      })
      .returning();

    return { id: conv.id, messages: [] };
  }

  private async getRelevantContext(
    bookId: string,
    query: string,
    chapterId?: string
  ): Promise<{ text: string; citations: Array<{ page: number; text: string }> }> {
    // Optimized for local LLM - fewer results, shorter context
    // If chapterId provided, search only within that chapter for accurate context
    const searchResults = await this.search(query, { bookId, chapterId, limit: 3 });

    if (searchResults.length === 0) {
      // Fall back to chapter content if provided
      if (chapterId) {
        const chapter = await this.getChapter(chapterId);
        if (chapter) {
          return {
            text: chapter.content.slice(0, 2000),
            citations: [{ page: chapter.startPage || 1, text: 'Chapter content' }],
          };
        }
      }
      return { text: 'No specific content found.', citations: [] };
    }

    const contextParts: string[] = [];
    const citations: Array<{ page: number; text: string }> = [];

    for (const result of searchResults) {
      // Shorter context per result for faster local LLM
      const shortContent = result.content.slice(0, 200);
      contextParts.push(`[p${result.pageNumber || '?'}] ${shortContent}`);
      if (result.pageNumber) {
        citations.push({ page: result.pageNumber, text: shortContent.slice(0, 50) });
      }
    }

    return {
      text: contextParts.join('\n'),
      citations,
    };
  }

  // ============================================
  // Quiz Generation
  // ============================================

  /**
   * Generate a quiz for a chapter
   */
  async generateQuiz(
    chapterId: string,
    options?: { questionCount?: number; difficulty?: 'easy' | 'medium' | 'hard' }
  ): Promise<{ quizId: string; questions: QuizQuestion[] }> {
    const chapter = await this.getChapter(chapterId);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    const questionCount = options?.questionCount || 3; // Reduced default for speed
    const difficulty = options?.difficulty || 'medium';

    // Optimized for local LLM - much smaller context
    const maxContentLength = 6000;
    const truncatedContent =
      chapter.content.length > maxContentLength
        ? chapter.content.slice(0, maxContentLength) + '\n[...]'
        : chapter.content;

    const response = await this.openai.chat.completions.create({
      model: 'llama3.1:8b',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Create ${questionCount} ${difficulty} quiz questions from this text. Return JSON array only:
[{"id":"q1","type":"multiple_choice","question":"...","options":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}]

Types: multiple_choice, true_false, short_answer

Text:
${truncatedContent}`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content;
    let questions: QuizQuestion[] = [];

    try {
      // Extract JSON from response
      const jsonMatch = responseText?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse quiz questions:', e);
      // Fallback: create a simple true/false question
      questions = [
        {
          id: 'q1',
          type: 'true_false',
          question: 'Did you understand the main concepts of this chapter?',
          correctAnswer: 'true',
          explanation: 'This is a reflection question.',
        },
      ];
    }

    // Save quiz to database
    const [quiz] = await db
      .insert(readHelpQuizzes)
      .values({
        bookId: chapter.bookId,
        chapterId,
        title: `Quiz: ${chapter.title || 'Chapter ' + chapter.chapterNumber}`,
        difficulty,
        questionCount: questions.length,
        questions,
      })
      .returning();

    return {
      quizId: quiz.id,
      questions,
    };
  }

  /**
   * Submit quiz answers and get results
   */
  async submitQuiz(
    quizId: string,
    answers: Array<{ questionId: string; answer: string }>
  ): Promise<{ score: number; results: Array<{ questionId: string; correct: boolean; explanation: string }> }> {
    const [quiz] = await db.select().from(readHelpQuizzes).where(eq(readHelpQuizzes.id, quizId)).limit(1);

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    const questions = quiz.questions as QuizQuestion[];
    const results: Array<{ questionId: string; correct: boolean; explanation: string }> = [];
    let correctCount = 0;

    for (const answer of answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (question) {
        const isCorrect =
          question.correctAnswer.toLowerCase().trim() === answer.answer.toLowerCase().trim();
        if (isCorrect) correctCount++;
        results.push({
          questionId: answer.questionId,
          correct: isCorrect,
          explanation: question.explanation,
        });
      }
    }

    const score = (correctCount / questions.length) * 100;

    // Save results
    await db
      .update(readHelpQuizzes)
      .set({
        answers,
        score,
        completedAt: new Date(),
      })
      .where(eq(readHelpQuizzes.id, quizId));

    return { score, results };
  }

  // ============================================
  // Highlights
  // ============================================

  /**
   * Create a highlight
   */
  async createHighlight(
    bookId: string,
    data: {
      chapterId?: string;
      pageNumber?: number;
      highlightedText: string;
      note?: string;
      color?: string;
      tags?: string[];
    }
  ): Promise<{ id: string }> {
    const [highlight] = await db
      .insert(readHelpHighlights)
      .values({
        bookId,
        chapterId: data.chapterId || null,
        pageNumber: data.pageNumber || null,
        highlightedText: data.highlightedText,
        note: data.note || null,
        color: data.color || 'yellow',
        tags: data.tags || null,
      })
      .returning();

    return { id: highlight.id };
  }

  /**
   * Get highlights for a book
   */
  async getHighlights(bookId: string): Promise<
    Array<{
      id: string;
      chapterId: string | null;
      pageNumber: number | null;
      highlightedText: string;
      note: string | null;
      color: string;
      tags: string[] | null;
      createdAt: string;
    }>
  > {
    const highlights = await db
      .select()
      .from(readHelpHighlights)
      .where(eq(readHelpHighlights.bookId, bookId))
      .orderBy(asc(readHelpHighlights.pageNumber), asc(readHelpHighlights.createdAt));

    return highlights.map((h) => ({
      id: h.id,
      chapterId: h.chapterId,
      pageNumber: h.pageNumber,
      highlightedText: h.highlightedText,
      note: h.note,
      color: h.color,
      tags: h.tags,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(highlightId: string): Promise<void> {
    await db.delete(readHelpHighlights).where(eq(readHelpHighlights.id, highlightId));
  }

  // ============================================
  // Reading Progress
  // ============================================

  /**
   * Get reading progress for a book
   */
  async getProgress(bookId: string): Promise<{
    currentPage: number;
    percentComplete: number;
    pagesRead: number;
    totalReadingTimeMinutes: number;
    lastReadAt: string | null;
  } | null> {
    const [progress] = await db
      .select()
      .from(readHelpProgress)
      .where(eq(readHelpProgress.bookId, bookId))
      .limit(1);

    if (!progress) return null;

    return {
      currentPage: progress.currentPage,
      percentComplete: progress.percentComplete,
      pagesRead: progress.pagesRead,
      totalReadingTimeMinutes: progress.totalReadingTimeMinutes,
      lastReadAt: progress.lastReadAt?.toISOString() || null,
    };
  }

  /**
   * Update reading progress
   */
  async updateProgress(
    bookId: string,
    data: { currentPage?: number; minutesRead?: number }
  ): Promise<void> {
    const book = await this.getBook(bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    const [progress] = await db
      .select()
      .from(readHelpProgress)
      .where(eq(readHelpProgress.bookId, bookId))
      .limit(1);

    if (!progress) {
      throw new Error('Progress record not found');
    }

    const updates: Record<string, unknown> = {
      lastReadAt: new Date(),
      updatedAt: new Date(),
    };

    if (data.currentPage !== undefined) {
      updates.currentPage = data.currentPage;
      updates.pagesRead = Math.max(progress.pagesRead, data.currentPage);
      if (book.pageCount) {
        updates.percentComplete = Math.min(100, (data.currentPage / book.pageCount) * 100);
      }
    }

    if (data.minutesRead !== undefined) {
      updates.totalReadingTimeMinutes = progress.totalReadingTimeMinutes + data.minutesRead;
    }

    await db.update(readHelpProgress).set(updates).where(eq(readHelpProgress.bookId, bookId));

    // Update book last read
    await db.update(readHelpBooks).set({ lastReadAt: new Date() }).where(eq(readHelpBooks.id, bookId));
  }

  // ============================================
  // Flashcards
  // ============================================

  /**
   * Generate flashcards from a chapter
   * Optimized for local LLM
   */
  async generateFlashcards(chapterId: string, count: number = 5): Promise<Array<{ id: string; front: string; back: string }>> {
    const chapter = await this.getChapter(chapterId);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    // Optimized for local LLM - smaller context
    const maxContentLength = 6000;
    const truncatedContent =
      chapter.content.length > maxContentLength ? chapter.content.slice(0, maxContentLength) + '\n[...]' : chapter.content;

    const response = await this.openai.chat.completions.create({
      model: 'llama3.1:8b',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Create ${count} flashcards from this text. Return JSON array only:
[{"front":"Question?","back":"Answer"}]

Text:
${truncatedContent}`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content;
    let cards: Array<{ front: string; back: string }> = [];

    try {
      const jsonMatch = responseText?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cards = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse flashcards:', e);
      cards = [{ front: 'Review this chapter', back: 'Read the chapter content carefully' }];
    }

    // Save flashcards
    const savedCards: Array<{ id: string; front: string; back: string }> = [];
    for (const card of cards) {
      const [saved] = await db
        .insert(readHelpFlashcards)
        .values({
          bookId: chapter.bookId,
          chapterId,
          front: card.front,
          back: card.back,
          cardType: 'concept',
          nextReviewAt: new Date(), // Due immediately
        })
        .returning();

      savedCards.push({ id: saved.id, front: card.front, back: card.back });
    }

    return savedCards;
  }

  /**
   * Get flashcards due for review
   */
  async getDueFlashcards(
    bookId?: string,
    limit: number = 20
  ): Promise<Array<{ id: string; front: string; back: string; bookId: string }>> {
    let query = db
      .select({
        id: readHelpFlashcards.id,
        front: readHelpFlashcards.front,
        back: readHelpFlashcards.back,
        bookId: readHelpFlashcards.bookId,
      })
      .from(readHelpFlashcards)
      .where(
        and(
          eq(readHelpFlashcards.isArchived, false),
          eq(readHelpFlashcards.isSuspended, false),
          sql`${readHelpFlashcards.nextReviewAt} <= NOW()`
        )
      );

    if (bookId) {
      query = query.where(eq(readHelpFlashcards.bookId, bookId)) as typeof query;
    }

    const cards = await query.orderBy(asc(readHelpFlashcards.nextReviewAt)).limit(limit);

    return cards;
  }

  /**
   * Review a flashcard using SM-2 algorithm
   */
  async reviewFlashcard(cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5): Promise<void> {
    const [card] = await db
      .select()
      .from(readHelpFlashcards)
      .where(eq(readHelpFlashcards.id, cardId))
      .limit(1);

    if (!card) {
      throw new Error('Flashcard not found');
    }

    // SM-2 Algorithm
    let easeFactor = card.easeFactor;
    let interval = card.interval;
    let repetitions = card.repetitions;

    if (quality < 3) {
      // Failed - reset
      repetitions = 0;
      interval = 1;
    } else {
      // Success
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    }

    // Update ease factor
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // Calculate next review date
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    await db
      .update(readHelpFlashcards)
      .set({
        easeFactor,
        interval,
        repetitions,
        nextReviewAt,
        lastReviewedAt: new Date(),
        totalReviews: card.totalReviews + 1,
        correctCount: quality >= 3 ? card.correctCount + 1 : card.correctCount,
        updatedAt: new Date(),
      })
      .where(eq(readHelpFlashcards.id, cardId));
  }

  // ============================================
  // Key Concepts Extraction
  // ============================================

  /**
   * Extract and cache key concepts from a chapter
   */
  async getKeyConcepts(chapterId: string): Promise<KeyConcept[]> {
    const chapter = await this.getChapter(chapterId);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    // Return cached if available
    if (chapter.keyConcepts && chapter.keyConcepts.length > 0) {
      return chapter.keyConcepts;
    }

    // Optimized for local LLM - smaller context
    const maxContentLength = 6000;
    const truncatedContent =
      chapter.content.length > maxContentLength ? chapter.content.slice(0, maxContentLength) + '\n[...]' : chapter.content;

    const response = await this.openai.chat.completions.create({
      model: 'llama3.1:8b',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Extract 5 key concepts from this text. Return JSON array only:
[{"term":"Name","definition":"Brief explanation","pageNumbers":[1]}]

Text:
${truncatedContent}`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content;
    let concepts: KeyConcept[] = [];

    try {
      const jsonMatch = responseText?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        concepts = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse concepts:', e);
    }

    // Cache the concepts
    await db
      .update(readHelpChapters)
      .set({ keyConcepts: concepts })
      .where(eq(readHelpChapters.id, chapterId));

    return concepts;
  }

  // ============================================
  // Formatters
  // ============================================

  private formatBook(row: typeof readHelpBooks.$inferSelect): Book {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      publisher: row.publisher,
      publishedYear: row.publishedYear,
      filePath: row.filePath,
      fileSizeBytes: row.fileSizeBytes,
      fileHash: row.fileHash,
      pageCount: row.pageCount,
      coverImagePath: row.coverImagePath,
      status: row.status,
      processingError: row.processingError,
      processingProgress: row.processingProgress,
      totalWordCount: row.totalWordCount,
      language: row.language,
      tags: row.tags,
      notes: row.notes,
      rating: row.rating,
      isArchived: row.isArchived,
      lastReadAt: row.lastReadAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatChapter(row: typeof readHelpChapters.$inferSelect): Chapter {
    return {
      id: row.id,
      bookId: row.bookId,
      chapterNumber: row.chapterNumber,
      title: row.title,
      startPage: row.startPage,
      endPage: row.endPage,
      content: row.content,
      wordCount: row.wordCount,
      summaryShort: row.summaryShort,
      summaryMedium: row.summaryMedium,
      summaryLong: row.summaryLong,
      summaryGeneratedAt: row.summaryGeneratedAt?.toISOString() || null,
      keyConcepts: (row.keyConcepts as KeyConcept[]) || null,
      keyQuotes: (row.keyQuotes as KeyQuote[]) || null,
      frameworks: (row.frameworks as Framework[]) || null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

// Export singleton instance
export const readHelpService = new ReadHelpService();
