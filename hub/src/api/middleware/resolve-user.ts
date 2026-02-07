/**
 * Resolve User Middleware
 * 
 * After requireClerkAuth sets clerkUserId, this middleware:
 * 1. Looks up the internal user_id from clerk_id
 * 2. Auto-creates the user record on first request
 * 3. Sets userId on the context for downstream handlers
 */

import { createMiddleware } from 'hono/factory';
import { db } from '../../db/client';
import { studyHelpUsers } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Resolves clerk_id → internal user_id.
 * Must be used AFTER requireClerkAuth.
 * Sets c.get('userId') as the internal UUID.
 */
export const resolveUser = createMiddleware(async (c, next) => {
  const clerkUserId = c.get('clerkUserId') as string;
  if (!clerkUserId) {
    return c.json({
      success: false,
      error: { code: 'NO_CLERK_ID', message: 'Clerk user ID not found' },
    }, 401);
  }

  // Look up by clerk_id first
  let [user] = await db
    .select({ id: studyHelpUsers.id })
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.clerkId, clerkUserId))
    .limit(1);

  // Fallback: check legacy email pattern
  if (!user) {
    [user] = await db
      .select({ id: studyHelpUsers.id })
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.email, `clerk:${clerkUserId}`))
      .limit(1);

    // Backfill clerk_id on the legacy record
    if (user) {
      await db
        .update(studyHelpUsers)
        .set({ clerkId: clerkUserId })
        .where(eq(studyHelpUsers.id, user.id));
    }
  }

  // Auto-create user on first request
  if (!user) {
    [user] = await db
      .insert(studyHelpUsers)
      .values({
        clerkId: clerkUserId,
        email: `clerk:${clerkUserId}`,
        passwordHash: 'clerk-auth',
        name: null,
        isActive: true,
      })
      .returning({ id: studyHelpUsers.id });
  }

  c.set('userId', user.id);
  await next();
});

/**
 * Helper: get user ID from context (for use in route handlers).
 * Requires resolveUser middleware to have run.
 */
export function getUserId(c: any): string {
  return c.get('userId') as string;
}
