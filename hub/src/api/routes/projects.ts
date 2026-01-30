import { Hono } from 'hono';
import { z } from 'zod';
import { projectService } from '../../services/project-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const projectsRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const projectStatusEnum = z.enum(['active', 'on_hold', 'completed', 'archived']);
const projectViewEnum = z.enum(['list', 'board', 'calendar']);

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentProjectId: z.string().uuid().optional(),
  area: z.string().optional(),
  context: z.string().default('Personal'),
  defaultView: projectViewEnum.optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  status: projectStatusEnum.optional(),
  isFavorite: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  defaultView: projectViewEnum.optional(),
  targetCompletionDate: z.string().date().nullable().optional(),
});

const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sortOrder: z.number().int().optional(),
});

const updateSectionSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isCollapsed: z.boolean().optional(),
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/projects
 * List all projects
 */
projectsRouter.get('/', async (c) => {
  const status = c.req.query('status');
  const area = c.req.query('area');
  const isFavorite = c.req.query('isFavorite');

  const projects = await projectService.list({
    status: status || undefined,
    area: area || undefined,
    isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
  });

  return c.json({
    success: true,
    data: projects,
    count: projects.length,
  });
});

/**
 * GET /api/projects/:id
 * Get a single project
 */
projectsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid project ID format');
  }

  const project = await projectService.getWithStats(id);

  if (!project) {
    throw new NotFoundError('Project');
  }

  return c.json({
    success: true,
    data: project,
  });
});

/**
 * POST /api/projects
 * Create a new project
 */
projectsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createProjectSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const project = await projectService.create(parseResult.data);

  return c.json(
    {
      success: true,
      data: project,
      message: 'Project created successfully',
    },
    201
  );
});

/**
 * PATCH /api/projects/:id
 * Update a project
 */
projectsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid project ID format');
  }

  const body = await c.req.json();
  const parseResult = updateProjectSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  // Convert date string to Date object
  const finalUpdateData: any = { ...updateData };
  if (updateData.targetCompletionDate) {
    finalUpdateData.targetCompletionDate = new Date(updateData.targetCompletionDate);
  }

  const project = await projectService.update(id, finalUpdateData);

  if (!project) {
    throw new NotFoundError('Project');
  }

  return c.json({
    success: true,
    data: project,
    message: 'Project updated successfully',
  });
});

/**
 * POST /api/projects/:id/archive
 * Archive a project
 */
projectsRouter.post('/:id/archive', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid project ID format');
  }

  const project = await projectService.archive(id);

  if (!project) {
    throw new NotFoundError('Project');
  }

  return c.json({
    success: true,
    data: project,
    message: 'Project archived',
  });
});

/**
 * POST /api/projects/:id/complete
 * Mark a project as complete
 */
projectsRouter.post('/:id/complete', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid project ID format');
  }

  const project = await projectService.complete(id);

  if (!project) {
    throw new NotFoundError('Project');
  }

  return c.json({
    success: true,
    data: project,
    message: 'Project marked as complete',
  });
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
projectsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid project ID format');
  }

  const deleted = await projectService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Project');
  }

  return c.json({
    success: true,
    message: 'Project deleted permanently',
  });
});

// ============================================
// Sections Routes
// ============================================

/**
 * GET /api/projects/:id/sections
 * List sections for a project
 */
projectsRouter.get('/:id/sections', async (c) => {
  const projectId = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }

  const sections = await projectService.listSections(projectId);

  return c.json({
    success: true,
    data: sections,
    count: sections.length,
  });
});

/**
 * POST /api/projects/:id/sections
 * Create a section in a project
 */
projectsRouter.post('/:id/sections', async (c) => {
  const projectId = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new ValidationError('Invalid project ID format');
  }

  const body = await c.req.json();
  const parseResult = createSectionSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const section = await projectService.createSection({
    projectId,
    ...parseResult.data,
  });

  return c.json(
    {
      success: true,
      data: section,
      message: 'Section created successfully',
    },
    201
  );
});

/**
 * PATCH /api/projects/:projectId/sections/:sectionId
 * Update a section
 */
projectsRouter.patch('/:projectId/sections/:sectionId', async (c) => {
  const sectionId = c.req.param('sectionId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId)) {
    throw new ValidationError('Invalid section ID format');
  }

  const body = await c.req.json();
  const parseResult = updateSectionSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const section = await projectService.updateSection(sectionId, parseResult.data);

  if (!section) {
    throw new NotFoundError('Section');
  }

  return c.json({
    success: true,
    data: section,
    message: 'Section updated successfully',
  });
});

/**
 * DELETE /api/projects/:projectId/sections/:sectionId
 * Delete a section
 */
projectsRouter.delete('/:projectId/sections/:sectionId', async (c) => {
  const sectionId = c.req.param('sectionId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sectionId)) {
    throw new ValidationError('Invalid section ID format');
  }

  const deleted = await projectService.deleteSection(sectionId);

  if (!deleted) {
    throw new NotFoundError('Section');
  }

  return c.json({
    success: true,
    message: 'Section deleted',
  });
});

export { projectsRouter };
