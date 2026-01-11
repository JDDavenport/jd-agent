import { Hono } from 'hono';
import { z } from 'zod';
import { labelService } from '../../services/label-service';
import { tagService } from '../../services/tag-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const labelsRouter = new Hono();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  aliases: z.array(z.string()).optional(),
});

const updateSchema = createSchema.partial();

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

// GET /api/labels - List all labels
labelsRouter.get('/', async (c) => {
  const labels = await labelService.list();
  return c.json({
    success: true,
    data: labels,
    count: labels.length,
  });
});

// POST /api/labels - Create label
labelsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const label = await labelService.create(parseResult.data);
  return c.json({ success: true, data: label, message: 'Label created' }, 201);
});

// POST /api/labels/reorder - Reorder labels
labelsRouter.post('/reorder', async (c) => {
  const body = await c.req.json();
  const schema = z.object({ ids: z.array(z.string().uuid()) });
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid IDs');
  }
  await labelService.reorder(parseResult.data.ids);
  return c.json({ success: true, message: 'Labels reordered' });
});

// ============================================
// Tag Taxonomy Endpoints
// ============================================

// POST /api/labels/initialize - Initialize default categories and tags
labelsRouter.post('/initialize', async (c) => {
  const result = await tagService.initializeDefaults();
  return c.json({
    success: true,
    data: result,
    message: `Created ${result.categories} categories and ${result.tags} tags`,
  });
});

// GET /api/labels/suggest - Get tag suggestions
labelsRouter.get('/suggest', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10', 10);

  const suggestions = await tagService.suggestTags(query, limit);

  return c.json({
    success: true,
    data: suggestions,
    count: suggestions.length,
  });
});

// POST /api/labels/validate - Validate tags exist
labelsRouter.post('/validate', async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    tags: z.array(z.string()),
    createMissing: z.boolean().optional(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid input');
  }

  const result = await tagService.validateTags(
    parseResult.data.tags,
    { createMissing: parseResult.data.createMissing }
  );

  return c.json({
    success: true,
    data: result,
  });
});

// GET /api/labels/grouped - Get tags grouped by category
labelsRouter.get('/grouped', async (c) => {
  const grouped = await tagService.getTagsByCategory();

  // Convert Map to object for JSON
  const result: Record<string, unknown[]> = {};
  for (const [key, value] of grouped) {
    result[key] = value;
  }

  return c.json({
    success: true,
    data: result,
  });
});

// ============================================
// Category Endpoints
// ============================================

// GET /api/labels/categories - List all categories
labelsRouter.get('/categories', async (c) => {
  const categories = await tagService.listCategories();
  return c.json({
    success: true,
    data: categories,
    count: categories.length,
  });
});

// GET /api/labels/categories/:id - Get single category
labelsRouter.get('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const category = await tagService.getCategoryById(id);
  if (!category) throw new NotFoundError('Category');
  return c.json({ success: true, data: category });
});

// POST /api/labels/categories - Create category
labelsRouter.post('/categories', async (c) => {
  const body = await c.req.json();
  const parseResult = categorySchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const category = await tagService.createCategory(parseResult.data);
  return c.json({ success: true, data: category, message: 'Category created' }, 201);
});

// DELETE /api/labels/categories/:id - Delete category
labelsRouter.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const deleted = await tagService.deleteCategory(id);
    if (!deleted) throw new NotFoundError('Category');
    return c.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('system')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

// GET /api/labels/category/:categoryId - Get tags by category
labelsRouter.get('/category/:categoryId', async (c) => {
  const categoryId = c.req.param('categoryId');
  const tags = await tagService.listTags({ categoryId });
  return c.json({
    success: true,
    data: tags,
    count: tags.length,
  });
});

// ============================================
// Single Label CRUD (must be last - :id is catch-all)
// ============================================

// GET /api/labels/:id - Get single label
labelsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const label = await labelService.getById(id);
  if (!label) throw new NotFoundError('Label');
  return c.json({ success: true, data: label });
});

// PATCH /api/labels/:id - Update label
labelsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const label = await labelService.update(id, parseResult.data);
  if (!label) throw new NotFoundError('Label');
  return c.json({ success: true, data: label, message: 'Label updated' });
});

// DELETE /api/labels/:id - Delete label
labelsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await labelService.delete(id);
  if (!deleted) throw new NotFoundError('Label');
  return c.json({ success: true, message: 'Label deleted' });
});

export { labelsRouter };
