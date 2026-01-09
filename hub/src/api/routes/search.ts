/**
 * JD Agent - Search API Routes
 * 
 * Universal search across all data:
 * - Full-text search
 * - Natural language queries
 * - Class-specific queries
 */

import { Hono } from 'hono';
import { searchService } from '../../services/search-service';
import { classAgentManager } from '../../agents/class-agent';
import type { SearchResultType } from '../../services/search-service';

const search = new Hono();

// ============================================
// Universal Search
// ============================================

/**
 * POST /api/search
 * Universal search across all data types
 */
search.post('/', async (c) => {
  const body = await c.req.json();
  const { 
    query, 
    types, 
    context, 
    limit, 
    offset, 
    dateFrom, 
    dateTo,
    semantic 
  } = body;

  if (!query || typeof query !== 'string') {
    return c.json({ error: 'Query is required' }, 400);
  }

  try {
    const results = await searchService.search({
      query,
      types: types as SearchResultType[],
      context,
      limit,
      offset,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      useSemanticSearch: semantic,
    });

    return c.json(results);
  } catch (error) {
    console.error('[SearchAPI] Search failed:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

/**
 * GET /api/search?q=...
 * Quick search with query string
 */
search.get('/', async (c) => {
  const query = c.req.query('q');
  const type = c.req.query('type');
  const context = c.req.query('context');
  const limit = parseInt(c.req.query('limit') || '20');

  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  try {
    const results = await searchService.search({
      query,
      types: type ? [type as SearchResultType] : undefined,
      context: context || undefined,
      limit,
    });

    return c.json(results);
  } catch (error) {
    console.error('[SearchAPI] Quick search failed:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// ============================================
// Natural Language Search
// ============================================

/**
 * POST /api/search/natural
 * Natural language query processing
 */
search.post('/natural', async (c) => {
  const body = await c.req.json();
  const { query } = body;

  if (!query || typeof query !== 'string') {
    return c.json({ error: 'Query is required' }, 400);
  }

  try {
    const results = await searchService.naturalLanguageSearch(query);
    return c.json(results);
  } catch (error) {
    console.error('[SearchAPI] NL search failed:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// ============================================
// Search Suggestions
// ============================================

/**
 * GET /api/search/suggest?prefix=...
 * Get search suggestions
 */
search.get('/suggest', async (c) => {
  const prefix = c.req.query('prefix');
  const limit = parseInt(c.req.query('limit') || '5');

  if (!prefix) {
    return c.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchService.getSuggestions(prefix, limit);
    return c.json({ suggestions });
  } catch (error) {
    console.error('[SearchAPI] Suggestions failed:', error);
    return c.json({ suggestions: [] });
  }
});

// ============================================
// Class-Specific Search
// ============================================

/**
 * POST /api/search/class/:classId
 * Query a specific class agent
 */
search.post('/class/:classId', async (c) => {
  const classId = c.req.param('classId');
  const body = await c.req.json();
  const { question } = body;

  if (!question || typeof question !== 'string') {
    return c.json({ error: 'Question is required' }, 400);
  }

  try {
    const agent = await classAgentManager.getAgent(classId);
    
    if (!agent) {
      return c.json({ error: 'Class not found' }, 404);
    }

    const response = await agent.query(question);
    return c.json(response);
  } catch (error) {
    console.error('[SearchAPI] Class query failed:', error);
    return c.json({ error: 'Query failed' }, 500);
  }
});

/**
 * POST /api/search/class/by-name/:nameOrCode
 * Query a class by name or code
 */
search.post('/class/by-name/:nameOrCode', async (c) => {
  const nameOrCode = c.req.param('nameOrCode');
  const body = await c.req.json();
  const { question } = body;

  if (!question || typeof question !== 'string') {
    return c.json({ error: 'Question is required' }, 400);
  }

  try {
    const agent = await classAgentManager.getAgentByName(nameOrCode);
    
    if (!agent) {
      return c.json({ error: 'Class not found' }, 404);
    }

    const response = await agent.query(question);
    return c.json(response);
  } catch (error) {
    console.error('[SearchAPI] Class query by name failed:', error);
    return c.json({ error: 'Query failed' }, 500);
  }
});

/**
 * GET /api/search/class
 * List all available class agents
 */
search.get('/class', async (c) => {
  try {
    const agents = await classAgentManager.listAgents();
    return c.json({ agents });
  } catch (error) {
    console.error('[SearchAPI] List agents failed:', error);
    return c.json({ error: 'Failed to list agents' }, 500);
  }
});

/**
 * GET /api/search/class/:classId/summary
 * Get class summary
 */
search.get('/class/:classId/summary', async (c) => {
  const classId = c.req.param('classId');

  try {
    const agent = await classAgentManager.getAgent(classId);
    
    if (!agent) {
      return c.json({ error: 'Class not found' }, 404);
    }

    const summary = await agent.getSummary();
    return c.json(summary);
  } catch (error) {
    console.error('[SearchAPI] Class summary failed:', error);
    return c.json({ error: 'Failed to get summary' }, 500);
  }
});

export default search;
