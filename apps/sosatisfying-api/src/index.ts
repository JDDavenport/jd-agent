import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { getEnv } from './config/env';
import sosatisfyingRouter from './api/routes/sosatisfying';

const { port, corsOrigins } = getEnv();

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    if (origin?.startsWith('http://localhost:')) return origin;
    if (corsOrigins.includes(origin || '')) return origin;
    return origin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
app.use('*', logger());
app.use('*', prettyJSON());

app.get('/', (c) => {
  return c.json({
    name: 'SoSatisfying API',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      feed: '/api/v1/sosatisfying/feed',
      groups: '/api/v1/sosatisfying/groups',
      posts: '/api/v1/sosatisfying/posts',
    },
    timestamp: new Date().toISOString(),
  });
});

app.route('/api/v1/sosatisfying', sosatisfyingRouter);

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.path} not found`,
      },
      timestamp: new Date().toISOString(),
    },
    404
  );
});

const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});

console.log(`🚀 SoSatisfying API listening on http://${server.hostname}:${server.port}`);
