/**
 * Better Auth middleware for Hono
 * 
 * Replaces clerk-auth.ts and resolve-user.ts.
 * Uses Better Auth session cookies to authenticate requests.
 */

import { createMiddleware } from 'hono/factory';
import { auth } from '../../lib/auth';
import { db } from '../../db/client';
import { studyHelpUsers } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Require authentication via Better Auth session.
 * Sets `authUser` (Better Auth user) and `userId` (study_help_users UUID) on context.
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      },
      401
    );
  }

  c.set('authUser', session.user);
  c.set('authSession', session.session);

  // Resolve to study_help_users record
  const betterAuthId = session.user.id;

  let [studyUser] = await db
    .select({ id: studyHelpUsers.id })
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.betterAuthUserId, betterAuthId))
    .limit(1);

  // Auto-create study_help_users record on first request
  if (!studyUser) {
    [studyUser] = await db
      .insert(studyHelpUsers)
      .values({
        betterAuthUserId: betterAuthId,
        email: session.user.email,
        passwordHash: 'better-auth', // Not used — Better Auth manages passwords
        name: session.user.name || null,
        isActive: true,
      })
      .returning({ id: studyHelpUsers.id });
  }

  c.set('userId', studyUser.id);
  await next();
});

/**
 * Optional auth — sets user info if session exists, continues regardless.
 */
export const optionalAuth = createMiddleware(async (c, next) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session?.user) {
      c.set('authUser', session.user);
      c.set('authSession', session.session);

      const [studyUser] = await db
        .select({ id: studyHelpUsers.id })
        .from(studyHelpUsers)
        .where(eq(studyHelpUsers.betterAuthUserId, session.user.id))
        .limit(1);

      if (studyUser) {
        c.set('userId', studyUser.id);
      }
    }
  } catch {
    // Continue without auth
  }

  await next();
});

/**
 * Helper: get userId from context.
 */
export function getUserId(c: any): string {
  return c.get('userId') as string;
}
