/**
 * Canvas Materials API Routes
 *
 * Canvas Complete Phase 2: Course materials management
 * - List and filter materials
 * - Download files
 * - Track reading progress
 * - Sync with Canvas
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { canvasMaterialsService, CreateMaterialInput, ReadingProgress } from '../../services/canvas-materials-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import * as fs from 'fs/promises';

const canvasMaterialsRouter = new Hono();

// ============================================
// Schemas
// ============================================

const listMaterialsSchema = z.object({
  courseId: z.string().uuid().optional(),
  fileType: z.string().optional(),
  materialType: z.string().optional(),
  readStatus: z.enum(['unread', 'in_progress', 'completed']).optional(),
});

const updateProgressSchema = z.object({
  readStatus: z.enum(['unread', 'in_progress', 'completed']),
  readProgress: z.number().min(0).max(100),
});

const createMaterialSchema = z.object({
  canvasItemId: z.string().uuid().optional(),
  canvasFileId: z.string().optional(),
  courseId: z.string().uuid(),
  fileName: z.string().min(1),
  displayName: z.string().optional(),
  fileType: z.string().min(1),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  downloadUrl: z.string().url().optional(),
  canvasUrl: z.string().url().optional(),
  moduleName: z.string().optional(),
  modulePosition: z.number().optional(),
  materialType: z.string().optional(),
  relatedAssignmentIds: z.array(z.string().uuid()).optional(),
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/canvas-materials
 * List all materials with optional filters
 */
canvasMaterialsRouter.get('/', async (c) => {
  const query = c.req.query();
  const filter = listMaterialsSchema.parse(query);

  const materials = await canvasMaterialsService.listMaterials(filter);

  return c.json({
    success: true,
    data: materials,
    count: materials.length,
  });
});

/**
 * GET /api/canvas-materials/by-course/:courseId
 * Get materials grouped by module for a course
 */
canvasMaterialsRouter.get('/by-course/:courseId', async (c) => {
  const courseId = c.req.param('courseId');

  const groupedMaterials = await canvasMaterialsService.getMaterialsByCourse(courseId);

  return c.json({
    success: true,
    data: groupedMaterials,
  });
});

/**
 * GET /api/canvas-materials/readings
 * Get reading list (materials marked as readings)
 */
canvasMaterialsRouter.get('/readings', async (c) => {
  const courseId = c.req.query('courseId');

  const readings = await canvasMaterialsService.getReadingList(courseId);

  return c.json({
    success: true,
    data: readings,
    count: readings.length,
  });
});

/**
 * GET /api/canvas-materials/unread-counts
 * Get unread material counts per course
 */
canvasMaterialsRouter.get('/unread-counts', async (c) => {
  const counts = await canvasMaterialsService.getUnreadCounts();

  return c.json({
    success: true,
    data: counts,
  });
});

/**
 * GET /api/canvas-materials/for-assignment/:canvasItemId
 * Get materials related to an assignment
 */
canvasMaterialsRouter.get('/for-assignment/:canvasItemId', async (c) => {
  const canvasItemId = c.req.param('canvasItemId');

  const materials = await canvasMaterialsService.getMaterialsForAssignment(canvasItemId);

  return c.json({
    success: true,
    data: materials,
    count: materials.length,
  });
});

/**
 * GET /api/canvas-materials/:id
 * Get a single material by ID
 */
canvasMaterialsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const material = await canvasMaterialsService.getMaterial(id);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  return c.json({
    success: true,
    data: material,
  });
});

/**
 * GET /api/canvas-materials/:id/download
 * Download a material file
 */
canvasMaterialsRouter.get('/:id/download', async (c) => {
  const id = c.req.param('id');

  const material = await canvasMaterialsService.getMaterial(id);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  const filePath = canvasMaterialsService.getFilePath(material);
  if (!filePath) {
    throw new NotFoundError('File not downloaded yet');
  }

  try {
    const fileContent = await fs.readFile(filePath);
    const fileName = material.displayName || material.fileName;

    // Set appropriate content type
    const contentType = material.mimeType || 'application/octet-stream';

    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(fileContent.length),
      },
    });
  } catch (error) {
    throw new NotFoundError('File not found on disk');
  }
});

/**
 * GET /api/canvas-materials/:id/view
 * View a material file inline (for PDFs, images)
 */
canvasMaterialsRouter.get('/:id/view', async (c) => {
  const id = c.req.param('id');

  const material = await canvasMaterialsService.getMaterial(id);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  const filePath = canvasMaterialsService.getFilePath(material);
  if (!filePath) {
    throw new NotFoundError('File not downloaded yet');
  }

  try {
    const fileContent = await fs.readFile(filePath);
    const contentType = material.mimeType || 'application/octet-stream';

    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${material.displayName || material.fileName}"`,
        'Content-Length': String(fileContent.length),
      },
    });
  } catch (error) {
    throw new NotFoundError('File not found on disk');
  }
});

/**
 * POST /api/canvas-materials
 * Create a new material record
 */
canvasMaterialsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const data = createMaterialSchema.parse(body) as CreateMaterialInput;

  const material = await canvasMaterialsService.createMaterial(data);

  return c.json({
    success: true,
    data: material,
  }, 201);
});

/**
 * PATCH /api/canvas-materials/:id/progress
 * Update reading progress for a material
 */
canvasMaterialsRouter.patch('/:id/progress', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const progress = updateProgressSchema.parse(body) as ReadingProgress;

  const material = await canvasMaterialsService.updateReadingProgress(id, progress);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  return c.json({
    success: true,
    data: material,
  });
});

/**
 * PATCH /api/canvas-materials/:id/vault-link
 * Link material to a Vault page
 */
canvasMaterialsRouter.patch('/:id/vault-link', async (c) => {
  const id = c.req.param('id');
  const { vaultPageId } = await c.req.json();

  if (!vaultPageId) {
    throw new ValidationError('vaultPageId is required');
  }

  const material = await canvasMaterialsService.linkToVaultPage(id, vaultPageId);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  return c.json({
    success: true,
    data: material,
  });
});

/**
 * DELETE /api/canvas-materials/:id
 * Delete a material and its local file
 */
canvasMaterialsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const material = await canvasMaterialsService.getMaterial(id);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  await canvasMaterialsService.deleteMaterial(id);

  return c.json({
    success: true,
    message: 'Material deleted',
  });
});

/**
 * POST /api/canvas-materials/sync/:canvasCourseId
 * Sync materials from a Canvas course
 */
canvasMaterialsRouter.post('/sync/:canvasCourseId', async (c) => {
  const canvasCourseId = parseInt(c.req.param('canvasCourseId'), 10);
  const { courseId, courseCode } = await c.req.json();

  if (!courseId || !courseCode) {
    throw new ValidationError('courseId and courseCode are required');
  }

  // Sync both direct files and module files
  const filesAdded = await canvasMaterialsService.syncCourseFiles(canvasCourseId, courseId, courseCode);
  const moduleFilesAdded = await canvasMaterialsService.syncCourseModules(canvasCourseId, courseId, courseCode);

  return c.json({
    success: true,
    data: {
      filesAdded,
      moduleFilesAdded,
      totalAdded: filesAdded + moduleFilesAdded,
    },
  });
});

/**
 * POST /api/canvas-materials/:id/create-vault-page
 * Create a Vault page for a material (makes it searchable in Vault)
 */
canvasMaterialsRouter.post('/:id/create-vault-page', async (c) => {
  const id = c.req.param('id');
  const { parentPageId } = await c.req.json().catch(() => ({}));

  const material = await canvasMaterialsService.getMaterial(id);
  if (!material) {
    throw new NotFoundError('Material not found');
  }

  if (material.vaultPageId) {
    return c.json({
      success: true,
      message: 'Material already has a Vault page',
      data: { vaultPageId: material.vaultPageId },
    });
  }

  const vaultPageId = await canvasMaterialsService.createVaultPageForMaterial(id, parentPageId);
  if (!vaultPageId) {
    throw new ValidationError('Failed to create Vault page');
  }

  return c.json({
    success: true,
    data: { vaultPageId },
  });
});

/**
 * POST /api/canvas-materials/create-vault-pages-for-course/:courseId
 * Bulk create Vault pages for all materials in a course
 */
canvasMaterialsRouter.post('/create-vault-pages-for-course/:courseId', async (c) => {
  const courseId = c.req.param('courseId');
  const { courseName, parentPageId } = await c.req.json().catch(() => ({}));

  // Create or get the course materials folder
  let folderPageId = parentPageId;
  if (!folderPageId && courseName) {
    folderPageId = await canvasMaterialsService.getOrCreateCourseMaterialsFolder(courseId, courseName);
  }

  const created = await canvasMaterialsService.createVaultPagesForCourse(courseId, folderPageId);

  return c.json({
    success: true,
    data: {
      created,
      folderPageId,
    },
  });
});

export { canvasMaterialsRouter };
