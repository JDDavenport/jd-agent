/**
 * Stripe Webhook Handler (Supplementary)
 * 
 * Better Auth's stripe plugin handles the main webhook at /api/auth/stripe/webhook.
 * This handler is for any custom/additional webhook events you want to process
 * (e.g., invoice.payment_failed notifications).
 * 
 * Mount at /api/stripe/webhook with a SEPARATE webhook endpoint in Stripe Dashboard.
 */

import { Hono } from 'hono';
import Stripe from 'stripe';

const stripeWebhookRouter = new Hono();

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

stripeWebhookRouter.post('/', async (c) => {
  if (!stripeClient) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event: Stripe.Event;

  try {
    const body = await c.req.text();
    event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[Stripe] Checkout completed for customer: ${session.customer}`);
      // Better Auth's stripe plugin handles subscription creation
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription ${sub.id} updated. Status: ${sub.status}`);
      // Better Auth's stripe plugin syncs the status
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription ${sub.id} cancelled`);
      // Better Auth's stripe plugin handles this
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe] Payment failed for customer: ${invoice.customer}`);
      // TODO: Send notification to user about failed payment
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  return c.json({ received: true });
});

export { stripeWebhookRouter };
