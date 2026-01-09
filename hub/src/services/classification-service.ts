/**
 * Classification Service - AI-powered content classification
 *
 * Uses Claude to:
 * - Classify content type (resume, note, document, etc.)
 * - Categorize by topic (career, class, personal, etc.)
 * - Generate relevant tags
 * - Determine if content is useful to keep
 * - Suggest actions (keep, archive, delete, review)
 * - Detect resumes for special handling
 */

import OpenAI from 'openai';
import type { RawEntry, ClassificationResult, VaultContentType } from '../types';
import { contentParser } from '../lib/content-parser';

// ============================================
// Configuration
// ============================================

const CLASSIFICATION_CATEGORIES = {
  career: 'Career & Job Search',
  resume: 'Resumes & Applications',
  work: 'Work Projects',
  class: 'Class Notes & Materials',
  study: 'Study Materials',
  research: 'Research',
  journal: 'Journal & Reflections',
  ideas: 'Ideas & Brainstorms',
  goals: 'Goals & Plans',
  reference: 'Reference Materials',
  templates: 'Templates',
  archive: 'Archive',
  useless: 'To Delete',
  duplicate: 'Duplicates',
} as const;

// ============================================
// Classification Service
// ============================================

export class ClassificationService {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Classify a single entry
   */
  async classify(entry: RawEntry): Promise<ClassificationResult> {
    const contentPreview = this.prepareContentPreview(entry.content);

    const prompt = this.buildClassificationPrompt({
      title: entry.title,
      source: entry.source,
      sourcePath: entry.sourcePath || '',
      contentPreview,
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt,
        }],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Expected text response from OpenAI');
      }

      // Parse JSON response
      const result = this.parseClassificationResponse(content);

      // Special handling for resumes
      if (this.isResume(entry)) {
        result.contentType = 'resume';
        result.category = 'resume';
        result.tags = [...new Set([...result.tags, 'resume', 'career'])];
        result.suggestedAction = 'keep';
        result.isUseful = true;
      }

      return result;
    } catch (error) {
      console.error('Error classifying entry:', error);

      // Fallback to simple classification
      return this.fallbackClassification(entry);
    }
  }

  /**
   * Batch classify multiple entries (with rate limiting)
   */
  async classifyBatch(
    entries: RawEntry[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      try {
        const result = await this.classify(entry);
        results.set(entry.sourceId, result);

        if (onProgress) {
          onProgress(i + 1, entries.length);
        }

        // Rate limiting - OpenAI allows more but let's be conservative
        // Wait ~0.5 seconds between requests
        await this.sleep(500);
      } catch (error) {
        console.error(`Error classifying entry ${entry.sourceId}:`, error);
        // Store fallback classification
        results.set(entry.sourceId, this.fallbackClassification(entry));
      }
    }

    return results;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Build classification prompt
   */
  private buildClassificationPrompt(data: {
    title: string;
    source: string;
    sourcePath: string;
    contentPreview: string;
  }): string {
    return `You are classifying a document for a personal knowledge vault. Analyze the document and provide a structured classification.

**Document Info:**
- Title: ${data.title}
- Source: ${data.source}
- Path: ${data.sourcePath}

**Content Preview:**
${data.contentPreview}

**Your Task:**
Classify this document and return a JSON object with the following fields:

1. **contentType**: One of:
   - "note" - General note
   - "document" - Formal document
   - "resume" - Resume or CV
   - "journal" - Personal journal entry
   - "class_notes" - Class/lecture notes
   - "meeting_notes" - Meeting notes
   - "reference" - Reference material
   - "article" - Article or blog post
   - "snippet" - Code snippet or short note
   - "template" - Reusable template
   - "other" - Doesn't fit above

2. **category**: One of: career, resume, work, class, study, research, journal, ideas, goals, reference, templates, archive, useless, duplicate

3. **tags**: Array of 3-7 relevant keywords (lowercase, hyphenated)

4. **summary**: Brief 1-2 sentence summary

5. **isUseful**: Boolean - is this worth keeping?

6. **suggestedAction**: One of: "keep", "archive", "delete", "review"

7. **confidence**: Number 0-1 indicating your confidence

**Consider:**
- Is this a resume? (Has "Experience", "Education", "Skills" sections)
- Is this outdated information?
- Is this a duplicate or redundant?
- Is this a useful template?
- Is this personal reflection (journal)?

**Return ONLY valid JSON, no other text:**`;
  }

  /**
   * Parse classification response from Claude
   */
  private parseClassificationResponse(text: string): ClassificationResult {
    try {
      // Extract JSON from response (Claude might add explanation)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        contentType: parsed.contentType || 'other',
        category: parsed.category || 'archive',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        summary: parsed.summary || '',
        isUseful: parsed.isUseful !== false,
        suggestedAction: parsed.suggestedAction || 'review',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch (error) {
      console.error('Error parsing classification response:', error);
      throw error;
    }
  }

  /**
   * Prepare content preview (first 2000 chars for token efficiency)
   */
  private prepareContentPreview(content: string): string {
    // Extract plain text for analysis
    const plainText = contentParser.extractPlainText(content);

    // Limit to 2000 characters to stay within token limits
    return plainText.substring(0, 2000);
  }

  /**
   * Detect if entry is a resume
   */
  private isResume(entry: RawEntry): boolean {
    const signals = [
      // Filename/title signals
      entry.title.toLowerCase().includes('resume'),
      entry.title.toLowerCase().includes('cv'),
      entry.title.toLowerCase().includes('curriculum vitae'),

      // Path signals
      entry.sourcePath?.toLowerCase().includes('resume'),
      entry.sourcePath?.toLowerCase().includes('career'),
      entry.sourcePath?.toLowerCase().includes('job'),

      // Content signals
      entry.content.toLowerCase().includes('experience') &&
        entry.content.toLowerCase().includes('education') &&
        (entry.content.toLowerCase().includes('skills') ||
          entry.content.toLowerCase().includes('summary')),
    ];

    // Need at least 2 signals to be confident it's a resume
    return signals.filter(Boolean).length >= 2;
  }

  /**
   * Fallback classification (rule-based)
   */
  private fallbackClassification(entry: RawEntry): ClassificationResult {
    const lowerTitle = entry.title.toLowerCase();
    const lowerPath = (entry.sourcePath || '').toLowerCase();

    // Resume detection
    if (this.isResume(entry)) {
      return {
        contentType: 'resume',
        category: 'resume',
        tags: ['resume', 'career'],
        summary: 'Resume or CV document',
        isUseful: true,
        suggestedAction: 'keep',
        confidence: 0.8,
      };
    }

    // Class notes
    if (lowerPath.includes('class') || lowerPath.includes('course')) {
      return {
        contentType: 'class_notes',
        category: 'class',
        tags: ['class', 'education'],
        summary: 'Class or course notes',
        isUseful: true,
        suggestedAction: 'keep',
        confidence: 0.6,
      };
    }

    // Journal
    if (lowerTitle.includes('journal') || lowerPath.includes('journal')) {
      return {
        contentType: 'journal',
        category: 'journal',
        tags: ['journal', 'personal'],
        summary: 'Personal journal entry',
        isUseful: true,
        suggestedAction: 'keep',
        confidence: 0.7,
      };
    }

    // Default: general note
    return {
      contentType: 'note',
      category: 'archive',
      tags: ['imported', 'uncategorized'],
      summary: 'Imported document',
      isUseful: true,
      suggestedAction: 'review',
      confidence: 0.3,
    };
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Singleton Export
// ============================================

export const classificationService = new ClassificationService();
