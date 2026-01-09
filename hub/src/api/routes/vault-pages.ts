import { Hono } from 'hono';
import { z } from 'zod';
import { vaultPageService } from '../../services/vault-page-service';
import { vaultBlockService } from '../../services/vault-block-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const vaultPagesRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const blockTypeEnum = z.enum([
  'text',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list',
  'numbered_list',
  'todo',
  'toggle',
  'quote',
  'callout',
  'divider',
  'code',
  'image',
  'file',
  'bookmark',
  'page_link',
  'task_link',
  'goal_link',
]);

const createPageSchema = z.object({
  title: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().nullable().optional(),
  coverImage: z.string().url().nullable().optional(),
});

const updatePageSchema = z.object({
  title: z.string().optional(),
  icon: z.string().nullable().optional(),
  coverImage: z.string().url().nullable().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const createBlockSchema = z.object({
  type: blockTypeEnum,
  content: z.record(z.unknown()),
  parentBlockId: z.string().uuid().nullable().optional(),
  afterBlockId: z.string().uuid().nullable().optional(),
});

const updateBlockSchema = z.object({
  type: blockTypeEnum.optional(),
  content: z.record(z.unknown()).optional(),
});

const moveBlockSchema = z.object({
  pageId: z.string().uuid().optional(),
  parentBlockId: z.string().uuid().nullable().optional(),
  afterBlockId: z.string().uuid().nullable().optional(),
});

const batchOperationSchema = z.object({
  operations: z.array(
    z.object({
      op: z.enum(['create', 'update', 'delete', 'move']),
      blockId: z.string().uuid().optional(),
      data: z.record(z.unknown()).optional(),
    })
  ),
});

const reorderSchema = z.object({
  pageIds: z.array(z.string().uuid()),
});

// ============================================
// Page Routes
// ============================================

/**
 * GET /api/vault/pages
 * List all pages
 */
vaultPagesRouter.get('/', async (c) => {
  const archived = c.req.query('archived');

  const pages = await vaultPageService.list({
    archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
  });

  return c.json({
    success: true,
    data: pages,
    count: pages.length,
  });
});

/**
 * GET /api/vault/pages/tree
 * Get hierarchical page tree
 */
vaultPagesRouter.get('/tree', async (c) => {
  const archived = c.req.query('archived');

  const tree = await vaultPageService.getTree({
    archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
  });

  return c.json({
    success: true,
    data: tree,
  });
});

/**
 * GET /api/vault/pages/favorites
 * Get favorite pages
 */
vaultPagesRouter.get('/favorites', async (c) => {
  const favorites = await vaultPageService.getFavorites();

  return c.json({
    success: true,
    data: favorites,
    count: favorites.length,
  });
});

/**
 * GET /api/vault/pages/quick-find
 * Quick search for pages
 */
vaultPagesRouter.get('/quick-find', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10', 10);

  if (!query) {
    return c.json({
      success: true,
      data: [],
      count: 0,
    });
  }

  const pages = await vaultPageService.quickFind(query, limit);

  return c.json({
    success: true,
    data: pages,
    count: pages.length,
  });
});

/**
 * GET /api/vault/pages/:id
 * Get a single page with blocks
 */
vaultPagesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const includeBlocks = c.req.query('include_blocks') !== 'false';

  const page = includeBlocks
    ? await vaultPageService.getByIdWithBlocks(id)
    : await vaultPageService.getById(id);

  if (!page) {
    throw new NotFoundError('Vault page');
  }

  // Get breadcrumb
  const breadcrumbs = await vaultPageService.getBreadcrumb(id);

  return c.json({
    success: true,
    data: {
      ...page,
      breadcrumbs,
    },
  });
});

/**
 * GET /api/vault/pages/:id/children
 * Get child pages
 */
vaultPagesRouter.get('/:id/children', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const children = await vaultPageService.getChildren(id);

  return c.json({
    success: true,
    data: children,
    count: children.length,
  });
});

/**
 * POST /api/vault/pages
 * Create a new page
 */
vaultPagesRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createPageSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const page = await vaultPageService.create(parseResult.data);

  return c.json(
    {
      success: true,
      data: page,
      message: 'Page created successfully',
    },
    201
  );
});

/**
 * PATCH /api/vault/pages/:id
 * Update a page
 */
vaultPagesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const parseResult = updatePageSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  try {
    const page = await vaultPageService.update(id, updateData);

    if (!page) {
      throw new NotFoundError('Vault page');
    }

    return c.json({
      success: true,
      data: page,
      message: 'Page updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('descendant')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

/**
 * POST /api/vault/pages/:id/favorite
 * Toggle favorite status
 */
vaultPagesRouter.post('/:id/favorite', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const page = await vaultPageService.toggleFavorite(id);

  if (!page) {
    throw new NotFoundError('Vault page');
  }

  return c.json({
    success: true,
    data: page,
    message: page.isFavorite ? 'Added to favorites' : 'Removed from favorites',
  });
});

/**
 * POST /api/vault/pages/reorder
 * Reorder pages
 */
vaultPagesRouter.post('/reorder', async (c) => {
  const body = await c.req.json();
  const parseResult = reorderSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError('pageIds array of UUIDs is required');
  }

  await vaultPageService.reorder(parseResult.data.pageIds);

  return c.json({
    success: true,
    message: 'Pages reordered successfully',
  });
});

/**
 * DELETE /api/vault/pages/:id
 * Delete a page
 */
vaultPagesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const deleted = await vaultPageService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Vault page');
  }

  return c.json({
    success: true,
    message: 'Page deleted successfully',
  });
});

// ============================================
// Block Routes
// ============================================

/**
 * GET /api/vault/pages/:pageId/blocks
 * Get all blocks for a page
 */
vaultPagesRouter.get('/:pageId/blocks', async (c) => {
  const pageId = c.req.param('pageId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    throw new ValidationError('Invalid page ID format');
  }

  const blocks = await vaultBlockService.getByPage(pageId);

  return c.json({
    success: true,
    data: blocks,
    count: blocks.length,
  });
});

/**
 * POST /api/vault/pages/:pageId/blocks
 * Create a new block
 */
vaultPagesRouter.post('/:pageId/blocks', async (c) => {
  const pageId = c.req.param('pageId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const parseResult = createBlockSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  try {
    const block = await vaultBlockService.create(pageId, parseResult.data as any);

    return c.json(
      {
        success: true,
        data: block,
        message: 'Block created successfully',
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Page not found') {
      throw new NotFoundError('Vault page');
    }
    throw error;
  }
});

/**
 * POST /api/vault/pages/:pageId/blocks/batch
 * Batch block operations
 */
vaultPagesRouter.post('/:pageId/blocks/batch', async (c) => {
  const pageId = c.req.param('pageId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const parseResult = batchOperationSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const results = await vaultBlockService.batch(pageId, parseResult.data.operations as any);

  return c.json({
    success: true,
    data: results,
    message: 'Batch operations completed',
  });
});

// ============================================
// Block Routes (not under pages)
// ============================================

export const vaultBlocksRouter = new Hono();

/**
 * GET /api/vault/blocks/:id
 * Get a single block
 */
vaultBlocksRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const block = await vaultBlockService.getById(id);

  if (!block) {
    throw new NotFoundError('Vault block');
  }

  return c.json({
    success: true,
    data: block,
  });
});

/**
 * GET /api/vault/blocks/:id/children
 * Get child blocks (for nested blocks)
 */
vaultBlocksRouter.get('/:id/children', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const children = await vaultBlockService.getChildren(id);

  return c.json({
    success: true,
    data: children,
    count: children.length,
  });
});

/**
 * PATCH /api/vault/blocks/:id
 * Update a block
 */
vaultBlocksRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const body = await c.req.json();
  const parseResult = updateBlockSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const block = await vaultBlockService.update(id, updateData as any);

  if (!block) {
    throw new NotFoundError('Vault block');
  }

  return c.json({
    success: true,
    data: block,
    message: 'Block updated successfully',
  });
});

/**
 * POST /api/vault/blocks/:id/move
 * Move a block
 */
vaultBlocksRouter.post('/:id/move', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const body = await c.req.json();
  const parseResult = moveBlockSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  try {
    const block = await vaultBlockService.move(id, parseResult.data as any);

    if (!block) {
      throw new NotFoundError('Vault block');
    }

    return c.json({
      success: true,
      data: block,
      message: 'Block moved successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
});

/**
 * DELETE /api/vault/blocks/:id
 * Delete a block
 */
vaultBlocksRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const deleted = await vaultBlockService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Vault block');
  }

  return c.json({
    success: true,
    message: 'Block deleted successfully',
  });
});

export { vaultPagesRouter };
