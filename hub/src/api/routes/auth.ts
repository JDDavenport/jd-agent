/**
 * Better Auth API route handler
 * 
 * Mounts Better Auth at /api/auth/* to handle:
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-in/social (Google)
 * - GET  /api/auth/session
 * - POST /api/auth/sign-out
 * - etc.
 */

import { Hono } from 'hono';
import { auth } from '../../lib/auth';

const authRouter = new Hono();

// Mount Better Auth handler — it handles all /api/auth/* paths
authRouter.on(['POST', 'GET'], '/*', (c) => {
  return auth.handler(c.req.raw);
});

export { authRouter };
