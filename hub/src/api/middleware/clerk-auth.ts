/**
 * Clerk authentication middleware for Hono
 * Verifies Clerk JWT tokens from the Authorization header
 * and attaches the userId to the request context.
 */

import { createMiddleware } from 'hono/factory';
import { createClerkClient, type AuthObject } from '@clerk/backend';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

const clerkClient = CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: CLERK_SECRET_KEY })
  : null;

/**
 * Optional Clerk auth - attaches clerkUserId if valid token present, 
 * but does NOT reject unauthenticated requests.
 * Use this for routes that work both with and without auth.
 */
export const optionalClerkAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ') && clerkClient) {
    try {
      const token = authHeader.slice(7);
      const { sub } = await clerkClient.verifyToken(token);
      if (sub) {
        c.set('clerkUserId', sub);
      }
    } catch {
      // Token invalid or expired - continue without auth
    }
  }
  await next();
});

/**
 * Required Clerk auth - rejects requests without valid Clerk token.
 * Returns 401 if no valid token.
 */
export const requireClerkAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    }, 401);
  }

  if (!clerkClient) {
    console.error('[Clerk] CLERK_SECRET_KEY not configured');
    return c.json({
      success: false,
      error: { code: 'AUTH_CONFIG_ERROR', message: 'Authentication not configured' },
    }, 500);
  }

  try {
    const token = authHeader.slice(7);
    const { sub } = await clerkClient.verifyToken(token);
    if (!sub) {
      return c.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
      }, 401);
    }
    c.set('clerkUserId', sub);
    await next();
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    }, 401);
  }
});
