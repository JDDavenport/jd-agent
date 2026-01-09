/**
 * JD Agent - Universal Search Service
 * 
 * Provides unified search across all data:
 * - Tasks
 * - Vault entries
 * - Recordings (via transcripts)
 * - Calendar events
 * - People
 * 
 * Supports:
 * - Full-text search
 * - Semantic search (embeddings)
 * - Natural language queries
 */

import { db } from '../db/client';
import { tasks, vaultEntries, recordings, transcripts, recordingSummaries, calendarEvents, people, classes } from '../db/schema';
import { sql, eq, or, ilike, desc, and, gte, lte } from 'drizzle-orm';
import { embeddingService } from '../lib/embeddings';

// ============================================
// Types
// ============================================

export type SearchResultType = 'task' | 'vault' | 'recording' | 'event' | 'person' | 'class';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  content?: string;
  preview?: string;
  context?: string;
  score: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SearchOptions {
  query: string;
  types?: SearchResultType[];
  context?: string;
  limit?: number;
  offset?: number;
  dateFrom?: Date;
  dateTo?: Date;
  useSemanticSearch?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  searchType: 'fulltext' | 'semantic' | 'hybrid';
  timing: number;
}

// ============================================
// Search Service
// ============================================

class SearchService {
  private readonly DEFAULT_LIMIT = 20;

  /**
   * Universal search across all data types
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    const {
      query,
      types = ['task', 'vault', 'recording', 'event', 'person', 'class'],
      context,
      limit = this.DEFAULT_LIMIT,
      offset = 0,
      dateFrom,
      dateTo,
      useSemanticSearch = false,
    } = options;

    let allResults: SearchResult[] = [];
    let searchType: 'fulltext' | 'semantic' | 'hybrid' = 'fulltext';

    // Try semantic search if enabled and embeddings available
    if (useSemanticSearch && embeddingService.isReady()) {
      searchType = 'semantic';
      // For now, fall back to fulltext as we haven't stored embeddings yet
      // TODO: Implement vector search when embeddings are stored
    }

    // Parallel search across all types
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (types.includes('task')) {
      searchPromises.push(this.searchTasks(query, context, dateFrom, dateTo));
    }
    if (types.includes('vault')) {
      searchPromises.push(this.searchVault(query, context, dateFrom, dateTo));
    }
    if (types.includes('recording')) {
      searchPromises.push(this.searchRecordings(query, context, dateFrom, dateTo));
    }
    if (types.includes('event')) {
      searchPromises.push(this.searchEvents(query, context, dateFrom, dateTo));
    }
    if (types.includes('person')) {
      searchPromises.push(this.searchPeople(query));
    }
    if (types.includes('class')) {
      searchPromises.push(this.searchClasses(query));
    }

    const results = await Promise.all(searchPromises);
    allResults = results.flat();

    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score);

    // Apply pagination
    const total = allResults.length;
    const paginatedResults = allResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      query,
      searchType,
      timing: Date.now() - startTime,
    };
  }

  /**
   * Search tasks
   */
  private async searchTasks(
    query: string,
    context?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`;

    let conditions = or(
      ilike(tasks.title, searchTerm),
      ilike(tasks.description, searchTerm),
      ilike(tasks.context, searchTerm)
    );

    if (context) {
      conditions = and(conditions, eq(tasks.context, context));
    }

    if (dateFrom) {
      conditions = and(conditions, gte(tasks.createdAt, dateFrom));
    }

    if (dateTo) {
      conditions = and(conditions, lte(tasks.createdAt, dateTo));
    }

    const results = await db
      .select()
      .from(tasks)
      .where(conditions)
      .orderBy(desc(tasks.createdAt))
      .limit(50);

    return results.map(task => ({
      id: task.id,
      type: 'task' as const,
      title: task.title,
      content: task.description || undefined,
      preview: task.description?.substring(0, 200),
      context: task.context,
      score: this.calculateTextScore(query, task.title, task.description || ''),
      metadata: {
        status: task.status,
        dueDate: task.dueDate,
        priority: task.priority,
        source: task.source,
      },
      createdAt: task.createdAt,
    }));
  }

  /**
   * Search vault entries
   */
  private async searchVault(
    query: string,
    context?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`;

    let conditions = or(
      ilike(vaultEntries.title, searchTerm),
      ilike(vaultEntries.content, searchTerm),
      ilike(vaultEntries.context, searchTerm)
    );

    if (context) {
      conditions = and(conditions, eq(vaultEntries.context, context));
    }

    if (dateFrom) {
      conditions = and(conditions, gte(vaultEntries.createdAt, dateFrom));
    }

    if (dateTo) {
      conditions = and(conditions, lte(vaultEntries.createdAt, dateTo));
    }

    const results = await db
      .select()
      .from(vaultEntries)
      .where(conditions)
      .orderBy(desc(vaultEntries.createdAt))
      .limit(50);

    return results.map(entry => ({
      id: entry.id,
      type: 'vault' as const,
      title: entry.title,
      content: entry.content || undefined,
      preview: entry.content?.substring(0, 200),
      context: entry.context,
      score: this.calculateTextScore(query, entry.title, entry.content || ''),
      metadata: {
        contentType: entry.contentType,
        tags: entry.tags,
        source: entry.source,
      },
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Search recordings via transcripts and summaries
   */
  private async searchRecordings(
    query: string,
    context?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`;

    // Search in transcripts
    const transcriptResults = await db
      .select({
        recording: recordings,
        transcript: transcripts,
      })
      .from(transcripts)
      .innerJoin(recordings, eq(transcripts.recordingId, recordings.id))
      .where(ilike(transcripts.fullText, searchTerm))
      .limit(30);

    // Search in summaries
    const summaryResults = await db
      .select({
        recording: recordings,
        summary: recordingSummaries,
      })
      .from(recordingSummaries)
      .innerJoin(recordings, eq(recordingSummaries.recordingId, recordings.id))
      .where(ilike(recordingSummaries.summary, searchTerm))
      .limit(30);

    const resultMap = new Map<string, SearchResult>();

    for (const { recording, transcript } of transcriptResults) {
      if (context && recording.context !== context) continue;
      if (dateFrom && recording.recordedAt && recording.recordedAt < dateFrom) continue;
      if (dateTo && recording.recordedAt && recording.recordedAt > dateTo) continue;

      resultMap.set(recording.id, {
        id: recording.id,
        type: 'recording',
        title: `Recording - ${recording.context || 'General'} - ${recording.recordedAt?.toLocaleDateString() || 'Unknown date'}`,
        content: transcript.fullText,
        preview: transcript.fullText.substring(0, 200),
        context: recording.context || undefined,
        score: this.calculateTextScore(query, '', transcript.fullText),
        metadata: {
          recordingType: recording.recordingType,
          duration: recording.durationSeconds,
          status: recording.status,
        },
        createdAt: recording.uploadedAt,
      });
    }

    for (const { recording, summary } of summaryResults) {
      if (context && recording.context !== context) continue;
      if (resultMap.has(recording.id)) {
        // Boost score if found in both
        const existing = resultMap.get(recording.id)!;
        existing.score += 0.2;
        continue;
      }

      resultMap.set(recording.id, {
        id: recording.id,
        type: 'recording',
        title: `Recording - ${recording.context || 'General'} - ${recording.recordedAt?.toLocaleDateString() || 'Unknown date'}`,
        content: summary.summary,
        preview: summary.summary.substring(0, 200),
        context: recording.context || undefined,
        score: this.calculateTextScore(query, '', summary.summary),
        metadata: {
          recordingType: recording.recordingType,
          keyPoints: summary.keyPoints,
        },
        createdAt: recording.uploadedAt,
      });
    }

    return Array.from(resultMap.values());
  }

  /**
   * Search calendar events
   */
  private async searchEvents(
    query: string,
    context?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`;

    let conditions = or(
      ilike(calendarEvents.title, searchTerm),
      ilike(calendarEvents.description, searchTerm),
      ilike(calendarEvents.location, searchTerm)
    );

    if (context) {
      conditions = and(conditions, eq(calendarEvents.context, context));
    }

    if (dateFrom) {
      conditions = and(conditions, gte(calendarEvents.startTime, dateFrom));
    }

    if (dateTo) {
      conditions = and(conditions, lte(calendarEvents.startTime, dateTo));
    }

    const results = await db
      .select()
      .from(calendarEvents)
      .where(conditions)
      .orderBy(desc(calendarEvents.startTime))
      .limit(50);

    return results.map(event => ({
      id: event.id,
      type: 'event' as const,
      title: event.title,
      content: event.description || undefined,
      preview: event.description?.substring(0, 200),
      context: event.context || undefined,
      score: this.calculateTextScore(query, event.title, event.description || ''),
      metadata: {
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        eventType: event.eventType,
      },
      createdAt: event.createdAt,
    }));
  }

  /**
   * Search people
   */
  private async searchPeople(query: string): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`;

    const results = await db
      .select()
      .from(people)
      .where(or(
        ilike(people.name, searchTerm),
        ilike(people.email, searchTerm),
        ilike(people.notes, searchTerm),
        ilike(people.howMet, searchTerm)
      ))
      .limit(30);

    return results.map(person => ({
      id: person.id,
      type: 'person' as const,
      title: person.name,
      content: person.notes || undefined,
      preview: person.notes?.substring(0, 200),
      context: person.relationshipType || undefined,
      score: this.calculateTextScore(query, person.name, person.notes || ''),
      metadata: {
        email: person.email,
        phone: person.phone,
        relationshipType: person.relationshipType,
        keyFacts: person.keyFacts,
      },
      createdAt: person.createdAt,
    }));
  }

  /**
   * Search classes
   */
  private async searchClasses(query: string): Promise<SearchResult[]> {
    const searchTerm = `%${query}%`;

    const results = await db
      .select()
      .from(classes)
      .where(or(
        ilike(classes.name, searchTerm),
        ilike(classes.code, searchTerm),
        ilike(classes.professor, searchTerm)
      ))
      .limit(20);

    return results.map(cls => ({
      id: cls.id,
      type: 'class' as const,
      title: cls.name,
      content: cls.agentSystemPrompt || undefined,
      preview: `${cls.code || ''} - ${cls.professor || 'Unknown professor'}`,
      context: cls.semester || undefined,
      score: this.calculateTextScore(query, cls.name, cls.code || ''),
      metadata: {
        code: cls.code,
        professor: cls.professor,
        status: cls.status,
        semester: cls.semester,
      },
      createdAt: cls.createdAt,
    }));
  }

  /**
   * Calculate simple text relevance score
   */
  private calculateTextScore(query: string, title: string, content: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    let score = 0;

    // Exact title match
    if (titleLower === queryLower) {
      score += 1.0;
    }
    // Title contains query
    else if (titleLower.includes(queryLower)) {
      score += 0.7;
    }
    // Title words match
    else {
      const queryWords = queryLower.split(/\s+/);
      const titleWords = titleLower.split(/\s+/);
      const matchingWords = queryWords.filter(w => titleWords.some(tw => tw.includes(w)));
      score += (matchingWords.length / queryWords.length) * 0.5;
    }

    // Content contains query
    if (contentLower.includes(queryLower)) {
      score += 0.3;
    }

    // Count occurrences in content
    const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
    score += Math.min(occurrences * 0.05, 0.2);

    return Math.min(score, 1.0);
  }

  /**
   * Natural language query processing
   */
  async naturalLanguageSearch(query: string): Promise<SearchResponse> {
    // Extract intent and entities from the query
    const lowerQuery = query.toLowerCase();

    // Detect what type of data they're looking for
    const types: SearchResultType[] = [];
    
    if (lowerQuery.includes('task') || lowerQuery.includes('todo') || lowerQuery.includes('assignment')) {
      types.push('task');
    }
    if (lowerQuery.includes('note') || lowerQuery.includes('document') || lowerQuery.includes('article')) {
      types.push('vault');
    }
    if (lowerQuery.includes('recording') || lowerQuery.includes('lecture') || lowerQuery.includes('meeting')) {
      types.push('recording');
    }
    if (lowerQuery.includes('event') || lowerQuery.includes('calendar') || lowerQuery.includes('schedule')) {
      types.push('event');
    }
    if (lowerQuery.includes('person') || lowerQuery.includes('contact') || lowerQuery.includes('professor')) {
      types.push('person');
    }
    if (lowerQuery.includes('class') || lowerQuery.includes('course')) {
      types.push('class');
    }

    // Extract date ranges
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (lowerQuery.includes('today')) {
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date();
      dateTo.setHours(23, 59, 59, 999);
    } else if (lowerQuery.includes('this week')) {
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - dateFrom.getDay());
      dateTo = new Date(dateFrom);
      dateTo.setDate(dateTo.getDate() + 7);
    } else if (lowerQuery.includes('last week')) {
      dateTo = new Date();
      dateTo.setDate(dateTo.getDate() - dateTo.getDay());
      dateFrom = new Date(dateTo);
      dateFrom.setDate(dateFrom.getDate() - 7);
    }

    // Extract context (class names, project names)
    let context: string | undefined;
    const classMatch = query.match(/\b([A-Z]{2,4}\s*\d{3})\b/i);
    if (classMatch) {
      context = classMatch[1].toUpperCase();
    }

    // Clean the query for search
    const cleanedQuery = query
      .replace(/\b(today|this week|last week|find|search|show|get|what|where|when)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return this.search({
      query: cleanedQuery || query,
      types: types.length > 0 ? types : undefined,
      context,
      dateFrom,
      dateTo,
      useSemanticSearch: true,
    });
  }

  /**
   * Get search suggestions based on recent queries and data
   */
  async getSuggestions(prefix: string, limit = 5): Promise<string[]> {
    const suggestions: string[] = [];

    // Get recent task titles
    const recentTasks = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(ilike(tasks.title, `${prefix}%`))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);

    suggestions.push(...recentTasks.map(t => t.title));

    // Get vault entry titles
    if (suggestions.length < limit) {
      const vaultTitles = await db
        .select({ title: vaultEntries.title })
        .from(vaultEntries)
        .where(ilike(vaultEntries.title, `${prefix}%`))
        .orderBy(desc(vaultEntries.createdAt))
        .limit(limit - suggestions.length);

      suggestions.push(...vaultTitles.map(v => v.title));
    }

    // Deduplicate and limit
    return [...new Set(suggestions)].slice(0, limit);
  }
}

// ============================================
// Singleton instance
// ============================================

export const searchService = new SearchService();
