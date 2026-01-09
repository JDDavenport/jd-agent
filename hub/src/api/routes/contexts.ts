import { Hono } from 'hono';
import { z } from 'zod';
import { contextService } from '../../services/context-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const contextsRouter = new Hono();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

// GET /api/contexts - List all contexts
contextsRouter.get('/', async (c) => {
  const contexts = await contextService.list();
  return c.json({
    success: true,
    data: contexts,
    count: contexts.length,
  });
});

// GET /api/contexts/:id - Get single context
contextsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const context = await contextService.getById(id);
  if (!context) throw new NotFoundError('Context');
  return c.json({ success: true, data: context });
});

// POST /api/contexts - Create context
contextsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const context = await contextService.create(parseResult.data);
  return c.json({ success: true, data: context, message: 'Context created' }, 201);
});

// PATCH /api/contexts/:id - Update context
contextsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const context = await contextService.update(id, parseResult.data);
  if (!context) throw new NotFoundError('Context');
  return c.json({ success: true, data: context, message: 'Context updated' });
});

// DELETE /api/contexts/:id - Delete context
contextsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await contextService.delete(id);
  if (!deleted) throw new NotFoundError('Context');
  return c.json({ success: true, message: 'Context deleted' });
});

// POST /api/contexts/reorder - Reorder contexts
contextsRouter.post('/reorder', async (c) => {
  const body = await c.req.json();
  const schema = z.object({ ids: z.array(z.string().uuid()) });
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid IDs');
  }
  await contextService.reorder(parseResult.data.ids);
  return c.json({ success: true, message: 'Contexts reordered' });
});

export { contextsRouter };
