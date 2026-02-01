import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { studyHelpAuthService, UserProfile } from '../../services/study-help-auth-service';

const COOKIE_NAME = 'study_help_session';

// Extend Hono context to include user
declare module 'hono' {
  interface ContextVariableMap {
    studyHelpUser: UserProfile;
    studyHelpUserId: string;
  }
}

/**
 * Auth middleware - requires valid session
 * Use for routes that must be authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  const sessionToken = getCookie(c, COOKIE_NAME);

  if (!sessionToken) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' },
      },
      401
    );
  }

  const user = await studyHelpAuthService.validateSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' },
      },
      401
    );
  }

  // Set user in context for downstream handlers
  c.set('studyHelpUser', user);
  c.set('studyHelpUserId', user.id);

  await next();
}

/**
 * Optional auth middleware - doesn't require authentication but attaches user if present
 * Use for routes that work differently when authenticated
 */
export async function optionalAuth(c: Context, next: Next) {
  const sessionToken = getCookie(c, COOKIE_NAME);

  if (sessionToken) {
    const user = await studyHelpAuthService.validateSession(sessionToken);
    if (user) {
      c.set('studyHelpUser', user);
      c.set('studyHelpUserId', user.id);
    }
  }

  await next();
}

/**
 * Require Canvas connection middleware
 * Use for routes that need Canvas API access
 */
export async function requireCanvasConnection(c: Context, next: Next) {
  // First run the auth middleware
  const sessionToken = getCookie(c, COOKIE_NAME);

  if (!sessionToken) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' },
      },
      401
    );
  }

  const user = await studyHelpAuthService.validateSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' },
      },
      401
    );
  }

  if (!user.canvasConnected) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CANVAS_NOT_CONNECTED',
          message: 'Please connect your Canvas account first',
        },
      },
      403
    );
  }

  c.set('studyHelpUser', user);
  c.set('studyHelpUserId', user.id);

  await next();
}

/**
 * Get user ID from context, with fallback for legacy single-user mode
 * This allows gradual migration without breaking existing functionality
 */
export function getUserId(c: Context): string {
  const userId = c.get('studyHelpUserId');
  
  if (userId) {
    return userId;
  }

  // Fallback for legacy single-user mode
  // This allows the app to work during transition
  const defaultUserId = process.env.STUDY_HELP_DEFAULT_USER_ID;
  if (defaultUserId) {
    return defaultUserId;
  }

  throw new Error('No user ID available - auth middleware may not be applied');
}

/**
 * Get user from context
 */
export function getUser(c: Context): UserProfile | undefined {
  return c.get('studyHelpUser');
}
