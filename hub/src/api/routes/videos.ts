/**
 * JD Agent - Video Learning API Routes
 *
 * YouTube Video Learning Assistant API:
 * - Add YouTube videos for transcript extraction
 * - Generate AI summaries of video content
 * - Key concepts and insights extraction
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { videoService, extractYouTubeId } from '../../services/video-service';
import { requireClerkAuth } from '../middleware/clerk-auth';
import { resolveUser, getUserId } from '../middleware/resolve-user';

type Env = { Variables: { clerkUserId: string; userId: string } };
const videosRouter = new Hono<Env>();

// Apply auth to all video routes
videosRouter.use('*', requireClerkAuth);
videosRouter.use('*', resolveUser);

// ============================================
// Video Management
// ============================================

/**
 * POST /api/read-help/videos
 * Add a YouTube video for processing
 */
videosRouter.post(
  '/',
  zValidator(
    'json',
    z.object({
      url: z.string().url(),
      canvasCourseId: z.string().optional(),
      canvasModuleItemId: z.string().optional(),
      canvasModuleName: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
  ),
  async (c) => {
    try {
      const body = c.req.valid('json');
      
      const video = await videoService.addVideo(body.url, {
        canvasCourseId: body.canvasCourseId,
        canvasModuleItemId: body.canvasModuleItemId,
        canvasModuleName: body.canvasModuleName,
        tags: body.tags,
      });
      
      return c.json({ success: true, data: video }, 201);
    } catch (error) {
      console.error('[Video API] Error adding video:', error);
      const message = error instanceof Error ? error.message : String(error);
      return c.json(
        { success: false, error: { code: 'ADD_ERROR', message } },
        400
      );
    }
  }
);

/**
 * GET /api/read-help/videos
 * List all videos
 */
videosRouter.get('/', async (c) => {
  try {
    const canvasCourseId = c.req.query('canvas_course_id');
    const status = c.req.query('status');
    const archived = c.req.query('archived');
    
    const videos = await videoService.listVideos({
      canvasCourseId: canvasCourseId || undefined,
      status: status || undefined,
      archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
    });
    
    return c.json({ success: true, data: videos });
  } catch (error) {
    console.error('[Video API] Error listing videos:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/videos/:id
 * Get video by ID
 */
videosRouter.get('/:id', async (c) => {
  try {
    const videoId = c.req.param('id');
    const video = await videoService.getVideo(videoId);
    
    if (!video) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
        404
      );
    }
    
    return c.json({ success: true, data: video });
  } catch (error) {
    console.error('[Video API] Error getting video:', error);
    return c.json(
      { success: false, error: { code: 'GET_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/videos/:id/summary/:length
 * Get video summary
 */
videosRouter.get('/:id/summary/:length', async (c) => {
  try {
    const videoId = c.req.param('id');
    const length = c.req.param('length') as 'short' | 'medium' | 'long';
    
    if (!['short', 'medium', 'long'].includes(length)) {
      return c.json(
        { success: false, error: { code: 'INVALID_LENGTH', message: 'Length must be short, medium, or long' } },
        400
      );
    }
    
    const result = await videoService.getSummary(videoId, length);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[Video API] Error getting summary:', error);
    const message = error instanceof Error ? error.message : String(error);
    return c.json(
      { success: false, error: { code: 'SUMMARY_ERROR', message } },
      500
    );
  }
});

/**
 * POST /api/read-help/videos/:id/reprocess
 * Reprocess a video (refetch transcript and regenerate summaries)
 */
videosRouter.post('/:id/reprocess', async (c) => {
  try {
    const videoId = c.req.param('id');
    const video = await videoService.reprocessVideo(videoId);
    return c.json({ success: true, data: video });
  } catch (error) {
    console.error('[Video API] Error reprocessing video:', error);
    return c.json(
      { success: false, error: { code: 'REPROCESS_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * PATCH /api/read-help/videos/:id
 * Update video metadata
 */
videosRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
      isArchived: z.boolean().optional(),
      watchProgress: z.number().optional(),
    })
  ),
  async (c) => {
    try {
      const videoId = c.req.param('id');
      const updates = c.req.valid('json');
      
      const video = await videoService.updateVideo(videoId, updates);
      return c.json({ success: true, data: video });
    } catch (error) {
      console.error('[Video API] Error updating video:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: String(error) } },
        500
      );
    }
  }
);

/**
 * DELETE /api/read-help/videos/:id
 * Delete a video
 */
videosRouter.delete('/:id', async (c) => {
  try {
    const videoId = c.req.param('id');
    await videoService.deleteVideo(videoId);
    return c.json({ success: true });
  } catch (error) {
    console.error('[Video API] Error deleting video:', error);
    return c.json(
      { success: false, error: { code: 'DELETE_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/read-help/videos/youtube/:youtubeId
 * Get video by YouTube ID
 */
videosRouter.get('/youtube/:youtubeId', async (c) => {
  try {
    const youtubeId = c.req.param('youtubeId');
    const video = await videoService.getVideoByYouTubeId(youtubeId);
    
    if (!video) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
        404
      );
    }
    
    return c.json({ success: true, data: video });
  } catch (error) {
    console.error('[Video API] Error getting video by YouTube ID:', error);
    return c.json(
      { success: false, error: { code: 'GET_ERROR', message: String(error) } },
      500
    );
  }
});

export { videosRouter };
