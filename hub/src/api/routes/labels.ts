import { Hono } from 'hono';
import { z } from 'zod';
import { labelService } from '../../services/label-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const labelsRouter = new Hono();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

// GET /api/labels - List all labels
labelsRouter.get('/', async (c) => {
  const labels = await labelService.list();
  return c.json({
    success: true,
    data: labels,
    count: labels.length,
  });
});

// GET /api/labels/:id - Get single label
labelsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const label = await labelService.getById(id);
  if (!label) throw new NotFoundError('Label');
  return c.json({ success: true, data: label });
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

export { labelsRouter };
