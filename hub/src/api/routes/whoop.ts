/**
 * JD Agent - Whoop API Routes
 * 
 * OAuth flow and health data endpoints for Whoop integration
 */

import { Hono } from 'hono';
import { getWhoopIntegration } from '../../integrations/whoop';
import { AppError } from '../middleware/error-handler';

const whoopRouter = new Hono();

/**
 * GET /api/whoop/authorize
 * Initiate OAuth flow - redirects to Whoop authorization
 */
whoopRouter.get('/authorize', async (c) => {
  const whoop = getWhoopIntegration();
  
  if (!whoop.isConfigured()) {
    throw new AppError(400, 'Whoop integration not configured', 'NOT_CONFIGURED');
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();
  
  // Store state in session/cookie (simplified - use proper session management in production)
  c.header('Set-Cookie', `whoop_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600`);
  
  const authUrl = whoop.getAuthorizationUrl(state);
  
  // Redirect to Whoop OAuth
  return c.redirect(authUrl);
});

/**
 * GET /api/whoop/callback
 * OAuth callback - receives authorization code
 */
whoopRouter.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.json({
      success: false,
      error: { code: 'OAUTH_ERROR', message: error },
    }, 400);
  }

  if (!code) {
    return c.json({
      success: false,
      error: { code: 'MISSING_CODE', message: 'Authorization code not provided' },
    }, 400);
  }

  // Verify state (CSRF protection)
  const storedState = c.req.header('Cookie')?.match(/whoop_oauth_state=([^;]+)/)?.[1];
  if (state !== storedState) {
    return c.json({
      success: false,
      error: { code: 'INVALID_STATE', message: 'Invalid state parameter' },
    }, 400);
  }

  try {
    const whoop = getWhoopIntegration();
    await whoop.exchangeCodeForToken(code);

    // Redirect back to the frontend personal health page
    const frontendUrl = process.env.FRONTEND_URL || 'https://command-center-plum.vercel.app';
    return c.redirect(`${frontendUrl}/personal-health?connected=true`);
  } catch (error) {
    console.error('[Whoop] OAuth callback error:', error);
    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'https://command-center-plum.vercel.app';
    const errorMessage = encodeURIComponent(error instanceof Error ? error.message : 'Failed to connect');
    return c.redirect(`${frontendUrl}/personal-health?error=${errorMessage}`);
  }
});

/**
 * GET /api/whoop/user
 * Get current Whoop user profile
 */
whoopRouter.get('/user', async (c) => {
  try {
    const whoop = getWhoopIntegration();
    const user = await whoop.getUser();
    
    return c.json({
      success: true,
      data: user,
    });
  } catch (error) {
    throw new AppError(
      500,
      error instanceof Error ? error.message : 'Failed to get Whoop user',
      'WHOOP_API_ERROR'
    );
  }
});

/**
 * GET /api/whoop/recovery/today
 * Get today's recovery score
 */
whoopRouter.get('/recovery/today', async (c) => {
  try {
    const whoop = getWhoopIntegration();
    const recovery = await whoop.getTodayRecovery();
    
    if (!recovery) {
      return c.json({
        success: true,
        data: null,
        message: 'No recovery data available for today',
      });
    }
    
    return c.json({
      success: true,
      data: {
        score: recovery.score.recovery_score,
        restingHeartRate: recovery.score.resting_heart_rate,
        hrv: recovery.score.hrv_rmssd_milli,
        createdAt: recovery.created_at,
      },
    });
  } catch (error) {
    throw new AppError(
      500,
      error instanceof Error ? error.message : 'Failed to get recovery data',
      'WHOOP_API_ERROR'
    );
  }
});

/**
 * GET /api/whoop/sleep/last-night
 * Get last night's sleep data
 */
whoopRouter.get('/sleep/last-night', async (c) => {
  try {
    const whoop = getWhoopIntegration();
    const sleep = await whoop.getLastNightSleep();
    
    if (!sleep) {
      return c.json({
        success: true,
        data: null,
        message: 'No sleep data available for last night',
      });
    }
    
    const stageSummary = sleep.score.stage_summary;
    const totalSleepHours = stageSummary.total_sleep_time_milli / (1000 * 60 * 60);
    
    return c.json({
      success: true,
      data: {
        totalSleepHours: totalSleepHours.toFixed(2),
        remSleepMinutes: Math.round(stageSummary.total_rem_sleep_time_milli / (1000 * 60)),
        deepSleepMinutes: Math.round(stageSummary.total_slow_wave_sleep_time_milli / (1000 * 60)),
        lightSleepMinutes: Math.round(stageSummary.total_light_sleep_time_milli / (1000 * 60)),
        awakeMinutes: Math.round(stageSummary.total_awake_time_milli / (1000 * 60)),
        sleepNeeded: {
          baselineHours: (sleep.score.sleep_needed.baseline_milli / (1000 * 60 * 60)).toFixed(2),
        },
        start: sleep.start,
        end: sleep.end,
      },
    });
  } catch (error) {
    throw new AppError(
      500,
      error instanceof Error ? error.message : 'Failed to get sleep data',
      'WHOOP_API_ERROR'
    );
  }
});

/**
 * GET /api/whoop/status
 * Check Whoop integration status
 */
whoopRouter.get('/status', async (c) => {
  const whoop = getWhoopIntegration();
  const authorized = await whoop.isAuthorized();

  return c.json({
    success: true,
    data: {
      configured: whoop.isConfigured(),
      authorized,
      redirectUri: process.env.WHOOP_REDIRECT_URI || 'http://localhost:3000/api/whoop/callback',
      authorizationUrl: whoop.isConfigured()
        ? `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/whoop/authorize`
        : null,
      privacyPolicyUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/privacy`,
    },
  });
});

/**
 * POST /api/whoop/disconnect
 * Disconnect Whoop integration (clear tokens)
 */
whoopRouter.post('/disconnect', async (c) => {
  try {
    const whoop = getWhoopIntegration();
    await whoop.disconnect();

    return c.json({
      success: true,
      message: 'Whoop integration disconnected',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'DISCONNECT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to disconnect'
      },
    }, 500);
  }
});

export { whoopRouter };
