import { Hono } from 'hono';
import { z } from 'zod';
import { peopleService } from '../../services/people-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const peopleRouter = new Hono();

const createPersonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  howMet: z.string().optional(),
  whereMet: z.string().optional(),
  firstMetDate: z.string().optional(),
  relationshipType: z.string().optional(),
  keyFacts: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updatePersonSchema = createPersonSchema.partial();

const createInteractionSchema = z.object({
  interactionDate: z.string(),
  interactionType: z.string().optional(),
  summary: z.string().optional(),
  recordingId: z.string().uuid().optional(),
  vaultEntryId: z.string().uuid().optional(),
  commitmentsByThem: z.array(z.string()).optional(),
  commitmentsByMe: z.array(z.string()).optional(),
});

// GET /api/people - List all people
peopleRouter.get('/', async (c) => {
  const search = c.req.query('search');
  const people = await peopleService.list(search);
  return c.json({
    success: true,
    data: people,
    count: people.length,
  });
});

// GET /api/people/:id - Get single person with interactions
peopleRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const person = await peopleService.getWithInteractions(id);
  if (!person) throw new NotFoundError('Person');
  return c.json({ success: true, data: person });
});

// POST /api/people - Create person
peopleRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createPersonSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const person = await peopleService.create(parseResult.data);
  return c.json({ success: true, data: person, message: 'Person created' }, 201);
});

// PATCH /api/people/:id - Update person
peopleRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updatePersonSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const person = await peopleService.update(id, parseResult.data);
  if (!person) throw new NotFoundError('Person');
  return c.json({ success: true, data: person, message: 'Person updated' });
});

// DELETE /api/people/:id - Delete person
peopleRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await peopleService.delete(id);
  if (!deleted) throw new NotFoundError('Person');
  return c.json({ success: true, message: 'Person deleted' });
});

// GET /api/people/:id/interactions - Get person's interactions
peopleRouter.get('/:id/interactions', async (c) => {
  const id = c.req.param('id');
  const interactions = await peopleService.getInteractions(id);
  return c.json({
    success: true,
    data: interactions,
    count: interactions.length,
  });
});

// POST /api/people/:id/interactions - Add interaction
peopleRouter.post('/:id/interactions', async (c) => {
  const personId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = createInteractionSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }
  const interaction = await peopleService.addInteraction({
    ...parseResult.data,
    personId,
  });
  return c.json({ success: true, data: interaction, message: 'Interaction added' }, 201);
});

export { peopleRouter };
