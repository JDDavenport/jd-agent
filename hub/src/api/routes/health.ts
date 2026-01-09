import { Hono } from 'hono';
import { checkDatabaseConnection } from '../../db/client';
import { getWhoopIntegration } from '../../integrations/whoop';

const health = new Hono();

// Get environment info for health checks
const getEnvironment = () => process.env.APP_ENV || process.env.NODE_ENV || 'development';
const getDeploymentId = () => process.env.RAILWAY_DEPLOYMENT_ID || process.env.VERCEL_DEPLOYMENT_ID || 'local';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  deploymentId: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
    redis?: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
  };
}

const startTime = Date.now();

// Basic health check
health.get('/', async (c) => {
  const dbStart = Date.now();
  const dbHealthy = await checkDatabaseConnection();
  const dbLatency = Date.now() - dbStart;

  const status: HealthStatus = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    version: '0.1.0',
    environment: getEnvironment(),
    deploymentId: getDeploymentId(),
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: {
        status: dbHealthy ? 'up' : 'down',
        latencyMs: dbLatency,
      },
    },
  };

  const httpStatus = status.status === 'healthy' ? 200 : 503;
  return c.json(status, httpStatus);
});

// Liveness probe (for Kubernetes/Railway)
health.get('/live', (c) => {
  return c.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness probe
health.get('/ready', async (c) => {
  const dbHealthy = await checkDatabaseConnection();

  if (dbHealthy) {
    return c.json({ status: 'ready', timestamp: new Date().toISOString() });
  }

  return c.json(
    { status: 'not ready', reason: 'Database connection failed' },
    503
  );
});

// Personal health dashboard data
health.get('/personal', async (c) => {
  try {
    const whoop = getWhoopIntegration();

    if (!whoop.isConfigured()) {
      return c.json({
        success: true,
        data: {
          configured: false,
          authorized: false,
          recovery: null,
          sleep: null,
          timestamp: new Date().toISOString(),
          message: 'Whoop integration not configured. Add WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET to your .env file.',
        },
      });
    }

    // Check if authorized
    const isAuthorized = await whoop.isAuthorized();
    if (!isAuthorized) {
      return c.json({
        success: true,
        data: {
          configured: true,
          authorized: false,
          authorizeUrl: '/api/whoop/authorize',
          recovery: null,
          sleep: null,
          timestamp: new Date().toISOString(),
          message: 'Whoop not connected. Click the button below to authorize.',
        },
      });
    }

    // Get today's recovery and last night's sleep in parallel
    const [recovery, sleep] = await Promise.all([
      whoop.getTodayRecovery(),
      whoop.getLastNightSleep(),
    ]);

    const healthData = {
      configured: true,
      authorized: true,
      recovery: recovery ? {
        score: recovery.score.recovery_score,
        restingHeartRate: recovery.score.resting_heart_rate,
        hrv: recovery.score.hrv_rmssd_milli,
        createdAt: recovery.created_at,
      } : null,
      sleep: sleep ? (() => {
        const stageSummary = sleep.score.stage_summary;
        // v2 API doesn't have total_sleep_time_milli, calculate from components
        const totalSleepMilli = (stageSummary.total_light_sleep_time_milli || 0) +
                               (stageSummary.total_slow_wave_sleep_time_milli || 0) +
                               (stageSummary.total_rem_sleep_time_milli || 0);
        return {
          totalSleepHours: (totalSleepMilli / (1000 * 60 * 60)).toFixed(2),
          remSleepMinutes: Math.round((stageSummary.total_rem_sleep_time_milli || 0) / (1000 * 60)),
          deepSleepMinutes: Math.round((stageSummary.total_slow_wave_sleep_time_milli || 0) / (1000 * 60)),
          lightSleepMinutes: Math.round((stageSummary.total_light_sleep_time_milli || 0) / (1000 * 60)),
          sleepNeeded: {
            baselineHours: (sleep.score.sleep_needed.baseline_milli / (1000 * 60 * 60)).toFixed(2),
          },
          start: sleep.start,
          end: sleep.end,
        };
      })() : null,
      timestamp: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    console.error('[Health] Personal health data error:', error);
    // Return a user-friendly response for auth errors
    const errorMessage = error instanceof Error ? error.message : 'Failed to get personal health data';
    if (errorMessage.includes('authorize') || errorMessage.includes('token')) {
      return c.json({
        success: true,
        data: {
          configured: true,
          authorized: false,
          authorizeUrl: '/api/whoop/authorize',
          recovery: null,
          sleep: null,
          timestamp: new Date().toISOString(),
          message: 'Whoop authorization expired. Please reconnect.',
        },
      });
    }
    return c.json({
      success: false,
      error: {
        code: 'HEALTH_DATA_ERROR',
        message: errorMessage,
      },
    }, 500);
  }
});

// Get health status for dashboard stats card
health.get('/status', async (c) => {
  try {
    const whoop = getWhoopIntegration();

    if (!whoop.isConfigured()) {
      return c.json({
        success: true,
        data: {
          status: 'not_configured',
          message: 'Whoop integration not configured',
        },
      });
    }

    const recovery = await whoop.getTodayRecovery();

    let status = 'unknown';
    let score = 0;

    if (recovery) {
      score = recovery.score.recovery_score;
      if (score >= 80) status = 'excellent';
      else if (score >= 60) status = 'good';
      else if (score >= 40) status = 'fair';
      else status = 'poor';
    }

    return c.json({
      success: true,
      data: {
        status,
        score,
        hasData: !!recovery,
      },
    });
  } catch (error) {
    console.error('[Health] Status check error:', error);
    return c.json({
      success: false,
      error: {
        code: 'HEALTH_STATUS_ERROR',
        message: 'Failed to get health status',
      },
    }, 500);
  }
});

// Detailed health check (for dashboard)
health.get('/detailed', async (c) => {
  const checks = {
    database: { status: 'unknown' as string, latency: 0 },
    googleCalendar: { status: 'unknown' as string, configured: false },
    telegram: { status: 'unknown' as string, configured: false },
    canvas: { status: 'unknown' as string, configured: false },
  };

  // Database check with latency
  const dbStart = Date.now();
  const dbHealthy = await checkDatabaseConnection();
  checks.database = {
    status: dbHealthy ? 'connected' : 'disconnected',
    latency: Date.now() - dbStart
  };

  // Check if integrations are configured
  checks.googleCalendar.configured = !!process.env.GOOGLE_CLIENT_ID;
  checks.googleCalendar.status = checks.googleCalendar.configured ? 'configured' : 'not_configured';

  checks.telegram.configured = !!(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN);
  checks.telegram.status = checks.telegram.configured ? 'configured' : 'not_configured';

  checks.canvas.configured = !!process.env.CANVAS_TOKEN;
  checks.canvas.status = checks.canvas.configured ? 'configured' : 'not_configured';

  return c.json({
    success: true,
    timestamp: new Date().toISOString(),
    checks,
  });
});

export { health };
