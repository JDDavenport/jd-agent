/**
 * JD Agent - Garmin API Routes
 *
 * REST endpoints for Garmin Connect health data.
 *
 * Endpoints:
 * - GET /api/garmin/status - Check connection status
 * - GET /api/garmin/login - Test login (triggers auth if needed)
 * - GET /api/garmin/today - Today's summary data
 * - GET /api/garmin/steps - Step data (optional ?date=YYYY-MM-DD)
 * - GET /api/garmin/heart-rate - Heart rate data
 * - GET /api/garmin/sleep - Sleep data
 * - GET /api/garmin/stress - Stress data
 * - GET /api/garmin/body-battery - Body battery data
 * - GET /api/garmin/activities - Recent activities
 * - GET /api/garmin/report - Full health report
 */

import { Hono } from 'hono';
import { garminIntegration } from '../../integrations/garmin';

const garmin = new Hono();

// Get connection status
garmin.get('/status', async (c) => {
  try {
    const status = await garminIntegration.getStatus();

    return c.json({
      success: true,
      data: {
        ...status,
        installInstructions: status.installed ? null : 'Run: pip install garminconnect',
        configInstructions: status.configured ? null : 'Set GARMIN_EMAIL and GARMIN_PASSWORD in .env',
      },
    });
  } catch (error) {
    console.error('[Garmin] Status check error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to check Garmin status',
      },
    }, 500);
  }
});

// Test login
garmin.get('/login', async (c) => {
  try {
    const result = await garminIntegration.login();

    if (result.success) {
      return c.json({
        success: true,
        data: {
          message: 'Login successful',
          profile: result.data,
        },
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_LOGIN_FAILED',
        message: result.error || 'Login failed',
      },
    }, 401);
  } catch (error) {
    console.error('[Garmin] Login error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_LOGIN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to login to Garmin',
      },
    }, 500);
  }
});

// Get today's summary
garmin.get('/today', async (c) => {
  try {
    const result = await garminIntegration.getToday();

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch today\'s data',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Today data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_TODAY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch today\'s data',
      },
    }, 500);
  }
});

// Get step data
garmin.get('/steps', async (c) => {
  try {
    const date = c.req.query('date');
    const result = await garminIntegration.getSteps(date);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch step data',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Steps data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_STEPS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch step data',
      },
    }, 500);
  }
});

// Get heart rate data
garmin.get('/heart-rate', async (c) => {
  try {
    const date = c.req.query('date');
    const result = await garminIntegration.getHeartRate(date);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch heart rate data',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Heart rate data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_HEART_RATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch heart rate data',
      },
    }, 500);
  }
});

// Get sleep data
garmin.get('/sleep', async (c) => {
  try {
    const date = c.req.query('date');
    const result = await garminIntegration.getSleep(date);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch sleep data',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Sleep data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_SLEEP_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch sleep data',
      },
    }, 500);
  }
});

// Get stress data
garmin.get('/stress', async (c) => {
  try {
    const date = c.req.query('date');
    const result = await garminIntegration.getStress(date);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch stress data',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Stress data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_STRESS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch stress data',
      },
    }, 500);
  }
});

// Get body battery data
garmin.get('/body-battery', async (c) => {
  try {
    const date = c.req.query('date');
    const result = await garminIntegration.getBodyBattery(date);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch body battery data',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Body battery data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_BODY_BATTERY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch body battery data',
      },
    }, 500);
  }
});

// Get recent activities
garmin.get('/activities', async (c) => {
  try {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    const result = await garminIntegration.getActivities(limit);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch activities',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Activities data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_ACTIVITIES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch activities',
      },
    }, 500);
  }
});

// Get full health report
garmin.get('/report', async (c) => {
  try {
    const date = c.req.query('date');
    const result = await garminIntegration.getFullReport(date);

    if (result.success) {
      return c.json({
        success: true,
        data: result.data,
      });
    }

    return c.json({
      success: false,
      error: {
        code: 'GARMIN_DATA_ERROR',
        message: result.error || 'Failed to fetch health report',
      },
    }, 500);
  } catch (error) {
    console.error('[Garmin] Report data error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_REPORT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch health report',
      },
    }, 500);
  }
});

// Get simplified daily metrics (for dashboard widgets)
garmin.get('/metrics', async (c) => {
  try {
    const date = c.req.query('date');
    const metrics = await garminIntegration.getDailyMetrics(date);

    return c.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[Garmin] Metrics error:', error);
    return c.json({
      success: false,
      error: {
        code: 'GARMIN_METRICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch daily metrics',
      },
    }, 500);
  }
});

export { garmin };
