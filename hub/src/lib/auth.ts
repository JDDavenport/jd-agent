/**
 * Better Auth configuration for Study Aide
 * 
 * Replaces Clerk with self-hosted auth:
 * - Email/password authentication
 * - Google OAuth
 * - Session management via cookies
 * - Stripe subscription integration
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { db } from '../db/client';
import * as authSchema from '../db/auth-schema';

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authSchema.user,
      session: authSchema.session,
      account: authSchema.account,
      verification: authSchema.verification,
      subscription: authSchema.subscription,
    },
  }),

  // Base URL for auth callbacks
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  // Secret for signing tokens
  secret: process.env.BETTER_AUTH_SECRET,

  // Email/password provider
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },

  // Session configuration
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },

  // Plugins
  plugins: [
    ...(stripeClient
      ? [
          stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
            createCustomerOnSignUp: true,
            subscription: {
              enabled: true,
              plans: [
                {
                  name: 'free',
                  limits: {
                    courses: 2,
                    classGPT: false,
                    flashcardsPerDay: 10,
                  },
                },
                {
                  name: 'pro',
                  priceId: process.env.STRIPE_PRO_PRICE_ID || '',
                  limits: {
                    courses: Infinity,
                    classGPT: true,
                    flashcardsPerDay: Infinity,
                  },
                },
              ],
            },
          }),
        ]
      : []),
  ],

  // Trusted origins (for CORS)
  trustedOrigins: [
    'http://localhost:5177',
    'http://localhost:3000',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean),
});

export type Auth = typeof auth;
