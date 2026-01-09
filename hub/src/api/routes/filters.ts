import { Hono } from 'hono';
import { z } from 'zod';
import { filterService } from '../../services/filter-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const filtersRouter = new Hono();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  query: z.string().min(1, 'Query is required'),
  color: z.string().optional(),
  icon: z.string().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

// GET /api/filters - List all filters
filtersRouter.get('/', async (c) => {
  const filters = await filterService.list();
  return c.json({
    success: true,
    data: filters,
    count: filters.length,
  });
});

// GET /api/filters/:id - Get single filter
filtersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const filter = await filterService.getById(id);
  if (!filter) throw new NotFoundError('Filter');
  return c.json({ success: true, data: filter });
});

// POST /api/filters - Create filter
filtersRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const filter = await filterService.create(parseResult.data);
  return c.json({ success: true, data: filter, message: 'Filter created' }, 201);
});

// PATCH /api/filters/:id - Update filter
filtersRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const filter = await filterService.update(id, parseResult.data);
  if (!filter) throw new NotFoundError('Filter');
  return c.json({ success: true, data: filter, message: 'Filter updated' });
});

// DELETE /api/filters/:id - Delete filter
filtersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await filterService.delete(id);
  if (!deleted) throw new NotFoundError('Filter');
  return c.json({ success: true, message: 'Filter deleted' });
});

// POST /api/filters/reorder - Reorder filters
filtersRouter.post('/reorder', async (c) => {
  const body = await c.req.json();
  const schema = z.object({ ids: z.array(z.string().uuid()) });
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid IDs');
  }
  await filterService.reorder(parseResult.data.ids);
  return c.json({ success: true, message: 'Filters reordered' });
});

export { filtersRouter };
