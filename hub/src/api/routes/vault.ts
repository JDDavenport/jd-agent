import { Hono } from 'hono';
import { z } from 'zod';
import { vaultService } from '../../services/vault-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import type { VaultContentType, VaultSource } from '../../types';
import { vaultPagesRouter, vaultBlocksRouter } from './vault-pages';

const vaultRouter = new Hono();

// Mount new Notion-like pages and blocks routes
vaultRouter.route('/pages', vaultPagesRouter);
vaultRouter.route('/blocks', vaultBlocksRouter);

// ============================================
// Validation Schemas
// ============================================

const contentTypeEnum = z.enum([
  'note',
  'recording_summary',
  'lecture',
  'meeting',
  'article',
  'reference',
  'resume',
  'document',
  'journal',
  'class_notes',
  'meeting_notes',
  'task_archive',
  'snippet',
  'template',
  'other'
]);
const sourceEnum = z.enum([
  'remarkable',
  'plaud',
  'email',
  'manual',
  'web',
  'canvas',
  'notion',
  'google_drive',
  'google_docs',
  'apple_notes'
]);

const createEntrySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  contentType: contentTypeEnum,
  context: z.string().min(1, 'Context is required'),
  tags: z.array(z.string()).optional(),
  source: sourceEnum,
  sourceRef: z.string().optional(),
  recordingId: z.string().uuid().optional(),
  relatedEntries: z.array(z.string().uuid()).optional(),
  sourceDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  parentId: z.string().uuid().optional(),
});

const updateEntrySchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  contentType: contentTypeEnum.optional(),
  context: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  sourceRef: z.string().optional(),
  relatedEntries: z.array(z.string().uuid()).optional(),
});

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').optional(),
  q: z.string().min(1).optional(),
  context: z.string().optional(),
  contentType: contentTypeEnum.optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
}).transform(data => ({
  ...data,
  query: data.query || data.q || '',
})).refine(data => data.query.length > 0, {
  message: 'Search query is required (use "query" or "q" parameter)',
});

const listFiltersSchema = z.object({
  context: z.string().optional(),
  contentType: contentTypeEnum.optional(),
  source: sourceEnum.optional(),
  tags: z.string().optional().transform(val => val ? val.split(',') : undefined),
  fromDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  toDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  recordingId: z.string().uuid().optional(),
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/vault
 * List vault entries with optional filters
 */
vaultRouter.get('/', async (c) => {
  const query = c.req.query();
  const parseResult = listFiltersSchema.safeParse(query);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const entries = await vaultService.list(parseResult.data);
  
  return c.json({
    success: true,
    data: entries,
    count: entries.length,
  });
});

/**
 * GET /api/vault/search
 * Full-text search across vault entries
 * Use ?semantic=true for semantic search (requires embedding API key)
 */
vaultRouter.get('/search', async (c) => {
  const query = c.req.query();
  const useSemantic = query.semantic === 'true';
  const parseResult = searchSchema.safeParse(query);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  try {
    // Use semantic search if requested
    if (useSemantic) {
      const entries = await vaultService.semanticSearch(parseResult.data.query, {
        limit: parseResult.data.limit,
        context: parseResult.data.context,
      });

      return c.json({
        success: true,
        data: entries,
        count: entries.length,
        searchType: 'semantic',
      });
    }

    // Try full-text search first
    const entries = await vaultService.search(parseResult.data);

    return c.json({
      success: true,
      data: entries,
      count: entries.length,
      searchType: 'fulltext',
    });
  } catch (error) {
    // Fall back to simple search if full-text fails
    const entries = await vaultService.simpleSearch(
      parseResult.data.query,
      parseResult.data.limit
    );

    return c.json({
      success: true,
      data: entries,
      count: entries.length,
      searchType: 'simple',
    });
  }
});

/**
 * GET /api/vault/embeddings/stats
 * Get embedding statistics
 */
vaultRouter.get('/embeddings/stats', async (c) => {
  const stats = await vaultService.getEmbeddingStats();
  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * POST /api/vault/embeddings/backfill
 * Backfill embeddings for entries that don't have them
 */
vaultRouter.post('/embeddings/backfill', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const batchSize = body.batchSize || 10;

  const result = await vaultService.backfillEmbeddings(batchSize);
  return c.json({
    success: true,
    data: result,
    message: `Processed ${result.processed} entries, ${result.errors} errors`,
  });
});

/**
 * GET /api/vault/stats
 * Get vault statistics
 */
vaultRouter.get('/stats', async (c) => {
  const stats = await vaultService.getStats();
  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/vault/contexts
 * Get all unique contexts
 */
vaultRouter.get('/contexts', async (c) => {
  const contexts = await vaultService.getContexts();
  return c.json({
    success: true,
    data: contexts,
  });
});

/**
 * GET /api/vault/tags
 * Get all unique tags
 */
vaultRouter.get('/tags', async (c) => {
  const tags = await vaultService.getTags();
  return c.json({
    success: true,
    data: tags,
  });
});

// ============================================
// Hierarchy Routes (Nested Pages)
// ============================================

/**
 * GET /api/vault/tree
 * Get hierarchical tree of all vault entries
 */
vaultRouter.get('/tree', async (c) => {
  const tree = await vaultService.getTree();
  return c.json({
    success: true,
    data: tree,
  });
});

/**
 * GET /api/vault/children
 * Get root-level entries (no parent)
 */
vaultRouter.get('/children', async (c) => {
  const children = await vaultService.getChildren(null);
  return c.json({
    success: true,
    data: children,
    count: children.length,
  });
});

/**
 * GET /api/vault/:id
 * Get a single vault entry by ID
 */
vaultRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const entry = await vaultService.getById(id);
  
  if (!entry) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    data: entry,
  });
});

/**
 * GET /api/vault/:id/related
 * Get related entries for a vault entry
 */
vaultRouter.get('/:id/related', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const related = await vaultService.getRelated(id);

  return c.json({
    success: true,
    data: related,
    count: related.length,
  });
});

/**
 * GET /api/vault/:id/children
 * Get child entries of a vault entry
 */
vaultRouter.get('/:id/children', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const children = await vaultService.getChildren(id);

  return c.json({
    success: true,
    data: children,
    count: children.length,
  });
});

/**
 * GET /api/vault/:id/breadcrumb
 * Get breadcrumb trail from root to entry
 */
vaultRouter.get('/:id/breadcrumb', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const breadcrumb = await vaultService.getBreadcrumb(id);

  return c.json({
    success: true,
    data: breadcrumb,
  });
});

/**
 * POST /api/vault/:id/move
 * Move entry to a new parent
 */
vaultRouter.post('/:id/move', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const body = await c.req.json();
  const schema = z.object({
    parentId: z.string().uuid().nullable(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('parentId must be a valid UUID or null');
  }

  try {
    const entry = await vaultService.move(id, parseResult.data.parentId);

    if (!entry) {
      throw new NotFoundError('Vault entry');
    }

    return c.json({
      success: true,
      data: entry,
      message: 'Entry moved successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('descendant')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

/**
 * POST /api/vault
 * Create a new vault entry (optionally nested under a parent)
 */
vaultRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createEntrySchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const { parentId, ...createData } = parseResult.data;
  const entry = parentId
    ? await vaultService.createWithParent({ ...createData, parentId } as any)
    : await vaultService.create(createData as any);

  return c.json({
    success: true,
    data: entry,
    message: 'Vault entry created successfully',
  }, 201);
});

/**
 * PATCH /api/vault/:id
 * Update an existing vault entry
 */
vaultRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const body = await c.req.json();
  const parseResult = updateEntrySchema.safeParse(body);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const entry = await vaultService.update(id, updateData as any);
  
  if (!entry) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    data: entry,
    message: 'Vault entry updated successfully',
  });
});

/**
 * POST /api/vault/:id/tags
 * Add tags to a vault entry
 */
vaultRouter.post('/:id/tags', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const body = await c.req.json();
  const schema = z.object({
    tags: z.array(z.string()).min(1),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Tags array is required');
  }

  const entry = await vaultService.addTags(id, parseResult.data.tags);
  
  if (!entry) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    data: entry,
    message: 'Tags added successfully',
  });
});

/**
 * DELETE /api/vault/:id/tags
 * Remove tags from a vault entry
 */
vaultRouter.delete('/:id/tags', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const body = await c.req.json();
  const schema = z.object({
    tags: z.array(z.string()).min(1),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Tags array is required');
  }

  const entry = await vaultService.removeTags(id, parseResult.data.tags);
  
  if (!entry) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    data: entry,
    message: 'Tags removed successfully',
  });
});

/**
 * POST /api/vault/:id/link
 * Link related entries
 */
vaultRouter.post('/:id/link', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const body = await c.req.json();
  const schema = z.object({
    relatedIds: z.array(z.string().uuid()).min(1),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('relatedIds array of UUIDs is required');
  }

  const entry = await vaultService.linkEntries(id, parseResult.data.relatedIds);
  
  if (!entry) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    data: entry,
    message: 'Entries linked successfully',
  });
});

/**
 * DELETE /api/vault/:id
 * Delete a vault entry
 */
vaultRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const deleted = await vaultService.delete(id);
  
  if (!deleted) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    message: 'Vault entry deleted successfully',
  });
});

// ============================================
// Version Management Routes
// ============================================

/**
 * GET /api/vault/:id/versions
 * List all versions of a vault entry
 */
vaultRouter.get('/:id/versions', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const versions = await vaultService.listVersions(id);

  return c.json({
    success: true,
    data: versions,
    count: versions.length,
  });
});

/**
 * GET /api/vault/:id/versions/:version
 * Get a specific version of a vault entry
 */
vaultRouter.get('/:id/versions/:version', async (c) => {
  const id = c.req.param('id');
  const versionStr = c.req.param('version');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const versionNumber = parseInt(versionStr, 10);
  if (isNaN(versionNumber) || versionNumber < 1) {
    throw new ValidationError('Version must be a positive integer');
  }

  const version = await vaultService.getVersion(id, versionNumber);

  if (!version) {
    throw new NotFoundError('Version');
  }

  return c.json({
    success: true,
    data: version,
  });
});

/**
 * POST /api/vault/:id/versions
 * Create a version snapshot of the current state
 */
vaultRouter.post('/:id/versions', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({
    changeDescription: z.string().optional(),
    changedBy: z.enum(['user', 'agent', 'system', 'auto']).optional(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid version options');
  }

  const version = await vaultService.createVersion(id, parseResult.data);

  if (!version) {
    throw new NotFoundError('Vault entry');
  }

  return c.json({
    success: true,
    data: version,
    message: 'Version created successfully',
  }, 201);
});

/**
 * POST /api/vault/:id/versions/:version/restore
 * Restore a vault entry to a previous version
 */
vaultRouter.post('/:id/versions/:version/restore', async (c) => {
  const id = c.req.param('id');
  const versionStr = c.req.param('version');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const versionNumber = parseInt(versionStr, 10);
  if (isNaN(versionNumber) || versionNumber < 1) {
    throw new ValidationError('Version must be a positive integer');
  }

  const entry = await vaultService.restoreVersion(id, versionNumber);

  if (!entry) {
    throw new NotFoundError('Version');
  }

  return c.json({
    success: true,
    data: entry,
    message: `Restored to version ${versionNumber}`,
  });
});

/**
 * DELETE /api/vault/:id/versions
 * Prune old versions, keeping only the most recent N
 */
vaultRouter.delete('/:id/versions', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid entry ID format');
  }

  const keepLastStr = c.req.query('keepLast') || '10';
  const keepLast = parseInt(keepLastStr, 10);

  if (isNaN(keepLast) || keepLast < 1) {
    throw new ValidationError('keepLast must be a positive integer');
  }

  const deletedCount = await vaultService.pruneVersions(id, keepLast);

  return c.json({
    success: true,
    deletedCount,
    message: `Deleted ${deletedCount} old versions, kept ${keepLast} most recent`,
  });
});

export { vaultRouter };
