import { Hono } from 'hono';

const webhooksRouter = new Hono();

/**
 * POST /api/webhooks/google-calendar
 * Handle incoming Google Calendar webhooks
 */
webhooksRouter.post('/google-calendar', async (c) => {
  console.log('[Webhook] Google Calendar event received');

  // Will be implemented when calendar sync is set up
  return c.json({ success: true, message: 'Calendar webhook received' });
});

/**
 * GET /api/webhooks/test
 * Test endpoint to verify webhooks are working
 */
webhooksRouter.get('/test', (c) => {
  return c.json({
    success: true,
    message: 'Webhooks endpoint is operational',
  });
});

export { webhooksRouter };
