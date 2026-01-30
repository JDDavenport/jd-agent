/**
 * JD Agent - Briefing API Routes
 *
 * Provides on-demand personalized briefings for the Command Center iOS app.
 *
 * Endpoints:
 * - GET /api/briefing - Generate full on-demand briefing
 * - GET /api/briefing/preview - Quick summary for widgets
 * - GET /api/briefing/integrations - Integration health status only
 */

import { Hono } from 'hono';
import { briefingService } from '../../services/briefing-service';

const briefingRouter = new Hono();

/**
 * GET /api/briefing
 *
 * Generate a full on-demand personalized briefing.
 * Includes AI-generated summary, sections, and integration status.
 */
briefingRouter.get('/', async (c) => {
  try {
    const briefing = await briefingService.generate();

    return c.json({
      success: true,
      data: briefing,
    });
  } catch (error) {
    console.error('[Briefing API] Error generating briefing:', error);
    return c.json({
      success: false,
      error: {
        code: 'BRIEFING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate briefing',
      },
    }, 500);
  }
});

/**
 * GET /api/briefing/preview
 *
 * Get a quick summary of key metrics for widgets.
 * Faster than full briefing - no AI generation.
 */
briefingRouter.get('/preview', async (c) => {
  try {
    const preview = await briefingService.getPreview();

    return c.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error('[Briefing API] Error getting preview:', error);
    return c.json({
      success: false,
      error: {
        code: 'PREVIEW_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get preview',
      },
    }, 500);
  }
});

/**
 * GET /api/briefing/integrations
 *
 * Get integration health status only.
 * Useful for status monitoring without full briefing.
 */
briefingRouter.get('/integrations', async (c) => {
  try {
    const integrations = await briefingService.getIntegrationStatus();

    return c.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('[Briefing API] Error getting integration status:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTEGRATION_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get integration status',
      },
    }, 500);
  }
});

export { briefingRouter };
