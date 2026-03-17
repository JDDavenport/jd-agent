/**
 * Subscription check middleware
 * 
 * Checks if the user has an active Pro subscription.
 * Free tier users get limited access.
 */

import { createMiddleware } from 'hono/factory';
import { db } from '../../db/client';
import { subscription } from '../../db/auth-schema';
import { eq, and } from 'drizzle-orm';

export interface SubscriptionInfo {
  plan: 'free' | 'pro';
  isActive: boolean;
  limits: {
    courses: number;
    classGPT: boolean;
    flashcardsPerDay: number;
  };
}

const FREE_LIMITS = {
  courses: 2,
  classGPT: false,
  flashcardsPerDay: 10,
};

const PRO_LIMITS = {
  courses: Infinity,
  classGPT: true,
  flashcardsPerDay: Infinity,
};

/**
 * Attaches subscription info to context.
 * Does NOT block — use requirePro for that.
 */
export const checkSubscription = createMiddleware(async (c, next) => {
  const authUser = c.get('authUser') as any;

  if (!authUser) {
    c.set('subscription', {
      plan: 'free',
      isActive: false,
      limits: FREE_LIMITS,
    } as SubscriptionInfo);
    await next();
    return;
  }

  // Check for active subscription
  const [sub] = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, authUser.id),
        eq(subscription.status, 'active')
      )
    )
    .limit(1);

  const isPro = sub?.plan === 'pro';

  c.set('subscription', {
    plan: isPro ? 'pro' : 'free',
    isActive: !!sub,
    limits: isPro ? PRO_LIMITS : FREE_LIMITS,
  } as SubscriptionInfo);

  await next();
});

/**
 * Require Pro subscription. Returns 403 if on free tier.
 */
export const requirePro = createMiddleware(async (c, next) => {
  const sub = c.get('subscription') as SubscriptionInfo | undefined;

  if (!sub || sub.plan !== 'pro') {
    return c.json(
      {
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'This feature requires a Pro subscription ($8/mo)',
        },
      },
      403
    );
  }

  await next();
});

/**
 * Helper: get subscription info from context.
 */
export function getSubscription(c: any): SubscriptionInfo {
  return (
    c.get('subscription') || {
      plan: 'free',
      isActive: false,
      limits: FREE_LIMITS,
    }
  );
}
