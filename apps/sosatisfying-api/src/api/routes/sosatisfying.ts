/**
 * SoSatisfying.com API Routes (MVP)
 */

import { Hono } from 'hono';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  sosGroups,
  sosPosts,
  sosComments,
  sosVotes,
  sosUsers,
  sosReports,
  sosBugReports,
  sosAdSpaces,
  sosAds,
  sosAdOrders,
  sosRankSettings,
} from '../../db/schema';
import { and, desc, eq, gte, ilike, isNull, or, sql } from 'drizzle-orm';

const sosatisfyingRouter = new Hono();

const contentTypeEnum = z.enum(['link', 'image', 'video', 'text', 'gallery']);
const feedSortEnum = z.enum(['hot', 'new', 'top']);
const timeRangeEnum = z.enum(['hour', 'day', 'week', 'month', 'year', 'all']);

const createGroupSchema = z.object({
  name: z.string().min(3).max(50),
  displayTitle: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  contentRating: z.enum(['all', '21+']).optional(),
  bannerUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  creatorId: z.string().uuid().optional(),
  rules: z.array(z.object({ title: z.string(), description: z.string().optional() })).optional(),
});

const createPostSchema = z.object({
  groupId: z.string().uuid(),
  authorId: z.string().uuid().optional(),
  title: z.string().min(10).max(300),
  contentType: contentTypeEnum,
  contentUrl: z.string().url().optional(),
  contentText: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  is21Plus: z.boolean().optional(),
  isOriginalContent: z.boolean().optional(),
  flair: z.string().max(50).optional(),
});

const createCommentSchema = z.object({
  authorId: z.string().uuid().optional(),
  parentCommentId: z.string().uuid().optional(),
  content: z.string().min(1),
});

const voteSchema = z.object({
  userId: z.string().uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const reportSchema = z.object({
  reporterId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reason: z.string().min(2),
  details: z.string().optional(),
});

const updateReportSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'actioned']),
  reviewedBy: z.string().uuid().optional(),
});

const bugReportSchema = z.object({
  reporterId: z.string().uuid().optional(),
  title: z.string().min(3),
  description: z.string().min(10),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  pageUrl: z.string().url().optional(),
  userEmail: z.string().email().optional(),
});

const updateWalletSchema = z.object({
  walletAddress: z.string().min(4),
});

const adSpaceSchema = z.object({
  name: z.string().min(3),
  placement: z.enum(['frontpage-banner', 'sidebar-rect', 'in-feed']),
  groupId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  priceCents: z.number().int().min(0).optional(),
  allowSelfServe: z.boolean().optional(),
  adminUserId: z.string().uuid().optional(),
});

const adSchema = z.object({
  adSpaceId: z.string().uuid(),
  ownerUserId: z.string().uuid().optional(),
  title: z.string().min(3),
  imageUrl: z.string().url().optional(),
  clickUrl: z.string().url().optional(),
  isAdult: z.boolean().optional(),
});

const buyAdSchema = z.object({
  buyerUserId: z.string().uuid().optional(),
});

const updateAdSchema = z.object({
  status: z.enum(['pending', 'active', 'rejected', 'archived']).optional(),
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  moderationReason: z.string().optional(),
});

const updateAdSpaceSchema = z.object({
  ownerUserId: z.string().uuid().optional(),
  adminUserId: z.string().uuid().optional(),
  priceCents: z.number().int().min(0).optional(),
  allowSelfServe: z.boolean().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

const rankingSchema = z.object({
  hotDecayHours: z.number().int().min(1).max(168).optional(),
  voteWeight: z.number().int().min(1).max(10).optional(),
  commentWeight: z.number().min(0).max(5).optional(),
  adminUserId: z.string().uuid().optional(),
});

const parseLimit = (value?: string, fallback = 20) => {
  const parsed = parseInt(value || String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
};

const parseOffset = (value?: string) => {
  const parsed = parseInt(value || '0', 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

const getTimeRangeFilter = (range: z.infer<typeof timeRangeEnum>) => {
  switch (range) {
    case 'hour':
      return gte(sosPosts.createdAt, sql`now() - interval '1 hour'`);
    case 'day':
      return gte(sosPosts.createdAt, sql`now() - interval '1 day'`);
    case 'week':
      return gte(sosPosts.createdAt, sql`now() - interval '7 days'`);
    case 'month':
      return gte(sosPosts.createdAt, sql`now() - interval '1 month'`);
    case 'year':
      return gte(sosPosts.createdAt, sql`now() - interval '1 year'`);
    default:
      return undefined;
  }
};

const hashPassword = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const profanityList = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'motherfucker',
];
const pornList = [
  'porn', 'xxx', 'sex', 'nude', 'nudes', 'onlyfans', 'camgirl', 'explicit',
];

const normalizeText = (value: string) => value.toLowerCase();

const containsBannedContent = (value: string) => {
  const text = normalizeText(value);
  return profanityList.some((word) => text.includes(word)) ||
    pornList.some((word) => text.includes(word));
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (key: string, limit: number, windowMs: number) => {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
};

const getRequesterKey = (c: any, userId?: string) => {
  if (userId) return `user:${userId}`;
  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : c.req.header('x-real-ip') || 'anonymous';
  return `ip:${ip}`;
};

const getAdminUser = async (userId?: string) => {
  if (!userId) return null;
  const [user] = await db
    .select({ id: sosUsers.id, isAdmin: sosUsers.isAdmin })
    .from(sosUsers)
    .where(eq(sosUsers.id, userId))
    .limit(1);
  return user?.isAdmin ? user : null;
};

const getUserStatus = async (userId?: string) => {
  if (!userId) return null;
  const [user] = await db
    .select({ id: sosUsers.id, isBanned: sosUsers.isBanned })
    .from(sosUsers)
    .where(eq(sosUsers.id, userId))
    .limit(1);
  return user || null;
};

const getBugMailer = () => {
  const host = process.env.SOS_SMTP_HOST;
  const port = process.env.SOS_SMTP_PORT ? parseInt(process.env.SOS_SMTP_PORT, 10) : 587;
  const user = process.env.SOS_SMTP_USER;
  const pass = process.env.SOS_SMTP_PASS;
  const from = process.env.SOS_SMTP_FROM || 'bugs@sosatisfying.com';
  const to = process.env.SOS_BUG_REPORT_TO || 'jddavenport46@gmail.com';

  if (!host || !user || !pass) {
    return null;
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return { transport, from, to };
};

// ============================================
// Dev bootstrap (creates demo user)
// ============================================

sosatisfyingRouter.get('/dev/bootstrap', async (c) => {
  try {
    const [existing] = await db
      .select({ id: sosUsers.id })
      .from(sosUsers)
      .where(eq(sosUsers.username, 'demo'))
      .limit(1);

    if (existing) {
      return c.json({ success: true, data: { userId: existing.id } });
    }

    const [created] = await db
      .insert(sosUsers)
      .values({
        username: 'demo',
        email: 'demo@sosatisfying.local',
        passwordHash: 'demo',
      })
      .returning({ id: sosUsers.id });

    return c.json({ success: true, data: { userId: created.id } });
  } catch (error) {
    console.error('[SoSatisfying API] Error bootstrapping demo user:', error);
    return c.json(
      { success: false, error: { code: 'BOOTSTRAP_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Auth (MVP)
// ============================================

sosatisfyingRouter.post('/auth/register', async (c) => {
  const body = await c.req.json();
  const parseResult = registerSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  try {
    const [existing] = await db
      .select({ id: sosUsers.id })
      .from(sosUsers)
      .where(or(eq(sosUsers.email, payload.email), eq(sosUsers.username, payload.username)))
      .limit(1);
    if (existing) {
      return c.json(
        { success: false, error: { code: 'USER_EXISTS', message: 'User already exists' } },
        409
      );
    }

    const [created] = await db
      .insert(sosUsers)
      .values({
        username: payload.username,
        email: payload.email,
        passwordHash: hashPassword(payload.password),
      })
      .returning({
        id: sosUsers.id,
        username: sosUsers.username,
        email: sosUsers.email,
        ageVerified21Plus: sosUsers.ageVerified21Plus,
        isAdmin: sosUsers.isAdmin,
        walletAddress: sosUsers.walletAddress,
        karma: sosUsers.karma,
      });

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error registering user:', error);
    return c.json(
      { success: false, error: { code: 'REGISTER_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.post('/auth/login', async (c) => {
  const body = await c.req.json();
  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  try {
    const [user] = await db
      .select({
        id: sosUsers.id,
        username: sosUsers.username,
        email: sosUsers.email,
        passwordHash: sosUsers.passwordHash,
        ageVerified21Plus: sosUsers.ageVerified21Plus,
        isAdmin: sosUsers.isAdmin,
        walletAddress: sosUsers.walletAddress,
        karma: sosUsers.karma,
        isBanned: sosUsers.isBanned,
      })
      .from(sosUsers)
      .where(eq(sosUsers.email, payload.email))
      .limit(1);

    if (!user || user.passwordHash !== hashPassword(payload.password)) {
      return c.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        401
      );
    }
    if (user.isBanned) {
      return c.json(
        { success: false, error: { code: 'USER_BANNED', message: 'User is banned' } },
        403
      );
    }

    return c.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        ageVerified21Plus: user.ageVerified21Plus,
        isAdmin: user.isAdmin,
        walletAddress: user.walletAddress,
        karma: user.karma,
      },
    });
  } catch (error) {
    console.error('[SoSatisfying API] Error logging in:', error);
    return c.json(
      { success: false, error: { code: 'LOGIN_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Search (MVP)
// ============================================

sosatisfyingRouter.get('/search', async (c) => {
  const query = c.req.query('query')?.trim();
  const scope = c.req.query('scope') || 'posts';
  const limit = parseLimit(c.req.query('limit'), 20);

  if (!query) {
    return c.json({ success: true, data: [] });
  }

  try {
    if (scope === 'groups') {
      const data = await db
        .select()
        .from(sosGroups)
        .where(ilike(sosGroups.name, `%${query}%`))
        .limit(limit);
      return c.json({ success: true, data });
    }

    if (scope === 'users') {
      const data = await db
        .select({
          id: sosUsers.id,
          username: sosUsers.username,
          avatarUrl: sosUsers.avatarUrl,
          createdAt: sosUsers.createdAt,
        })
        .from(sosUsers)
        .where(ilike(sosUsers.username, `%${query}%`))
        .limit(limit);
      return c.json({ success: true, data });
    }

    const data = await db
      .select({
        post: sosPosts,
        groupName: sosGroups.name,
        groupTitle: sosGroups.displayTitle,
      })
      .from(sosPosts)
      .leftJoin(sosGroups, eq(sosPosts.groupId, sosGroups.id))
      .where(and(eq(sosPosts.isDeleted, false), ilike(sosPosts.title, `%${query}%`)))
      .orderBy(desc(sosPosts.createdAt))
      .limit(limit);

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[SoSatisfying API] Error searching:', error);
    return c.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// User preferences (MVP)
// ============================================

sosatisfyingRouter.post('/users/:id/age-verify', async (c) => {
  const id = c.req.param('id');
  try {
    const [updated] = await db
      .update(sosUsers)
      .set({ ageVerified21Plus: true })
      .where(eq(sosUsers.id, id))
      .returning({ id: sosUsers.id, ageVerified21Plus: sosUsers.ageVerified21Plus });

    if (!updated) {
      return c.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        404
      );
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('[SoSatisfying API] Error verifying age:', error);
    return c.json(
      { success: false, error: { code: 'AGE_VERIFY_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.patch('/users/:id/wallet', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateWalletSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  try {
    const [updated] = await db
      .update(sosUsers)
      .set({ walletAddress: parseResult.data.walletAddress })
      .where(eq(sosUsers.id, id))
      .returning({
        id: sosUsers.id,
        walletAddress: sosUsers.walletAddress,
      });
    if (!updated) {
      return c.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        404
      );
    }
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('[SoSatisfying API] Error updating wallet:', error);
    return c.json(
      { success: false, error: { code: 'WALLET_UPDATE_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/feed', async (c) => {
  const sortParam = c.req.query('sort') || 'hot';
  const timeRangeParam = c.req.query('timeRange') || 'all';
  const groupName = c.req.query('group');
  const limit = parseLimit(c.req.query('limit'));
  const offset = parseOffset(c.req.query('offset'));

  const sortParse = feedSortEnum.safeParse(sortParam);
  const timeRangeParse = timeRangeEnum.safeParse(timeRangeParam);
  if (!sortParse.success || !timeRangeParse.success) {
    return c.json(
      { success: false, error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' } },
      400
    );
  }

  try {
    const conditions = [eq(sosPosts.isDeleted, false)];
    const timeFilter = getTimeRangeFilter(timeRangeParse.data);
    if (timeFilter) conditions.push(timeFilter);

    if (groupName) {
      const [group] = await db
        .select({ id: sosGroups.id })
        .from(sosGroups)
        .where(eq(sosGroups.name, groupName))
        .limit(1);
      if (!group) {
        return c.json(
          { success: false, error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } },
          404
        );
      }
      conditions.push(eq(sosPosts.groupId, group.id));
    }

    const [rankSettings] = await db
      .select()
      .from(sosRankSettings)
      .orderBy(desc(sosRankSettings.updatedAt))
      .limit(1);

    const voteWeight = rankSettings?.voteWeight ?? 1;
    const commentWeight = rankSettings?.commentWeight ?? 0.2;
    const decayHours = rankSettings?.hotDecayHours ?? 24;
    const voteWeightSql = sql.raw(String(voteWeight));
    const commentWeightSql = sql.raw(String(commentWeight));
    const decayHoursSql = sql.raw(String(decayHours));

    let orderByClause;
    if (sortParse.data === 'new') {
      orderByClause = desc(sosPosts.createdAt);
    } else if (sortParse.data === 'top') {
      orderByClause = desc(
        sql`${sosPosts.upvotes} - ${sosPosts.downvotes} + ${commentWeightSql} * ${sosPosts.commentCount}`
      );
    } else {
      orderByClause = desc(
        sql`(
          (${voteWeightSql} * (${sosPosts.upvotes} - ${sosPosts.downvotes})
          + ${commentWeightSql} * ${sosPosts.commentCount})
          / greatest(extract(epoch from (now() - ${sosPosts.createdAt})) / 3600 / ${decayHoursSql}, 1)
        )`
      );
    }

    const data = await db
      .select({
        post: sosPosts,
        groupName: sosGroups.name,
        groupTitle: sosGroups.displayTitle,
      })
      .from(sosPosts)
      .leftJoin(sosGroups, eq(sosPosts.groupId, sosGroups.id))
      .leftJoin(sosUsers, eq(sosPosts.authorId, sosUsers.id))
      .where(
        and(
          ...conditions,
          or(isNull(sosUsers.isBanned), eq(sosUsers.isBanned, false))
        )
      )
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sosPosts)
      .leftJoin(sosUsers, eq(sosPosts.authorId, sosUsers.id))
      .where(
        and(
          ...conditions,
          or(isNull(sosUsers.isBanned), eq(sosUsers.isBanned, false))
        )
      );

    const total = Number(countResult[0]?.count || 0);

    return c.json({
      success: true,
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error('[SoSatisfying API] Error fetching feed:', error);
    return c.json(
      { success: false, error: { code: 'FEED_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/groups', async (c) => {
  const limit = parseLimit(c.req.query('limit'), 25);
  const offset = parseOffset(c.req.query('offset'));
  const search = c.req.query('search');
  const category = c.req.query('category');

  try {
    const conditions = [];
    if (search) conditions.push(ilike(sosGroups.name, `%${search}%`));
    if (category) conditions.push(eq(sosGroups.category, category));

    const data = await db
      .select()
      .from(sosGroups)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(sosGroups.subscriberCount))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sosGroups)
      .where(conditions.length ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    return c.json({
      success: true,
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error('[SoSatisfying API] Error listing groups:', error);
    return c.json(
      { success: false, error: { code: 'GROUP_LIST_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/groups/:name', async (c) => {
  const name = c.req.param('name');
  const limit = parseLimit(c.req.query('limit'), 25);

  try {
    const [group] = await db.select().from(sosGroups).where(eq(sosGroups.name, name)).limit(1);
    if (!group) {
      return c.json(
        { success: false, error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } },
        404
      );
    }

    const posts = await db
      .select()
      .from(sosPosts)
      .leftJoin(sosUsers, eq(sosPosts.authorId, sosUsers.id))
      .where(
        and(
          eq(sosPosts.groupId, group.id),
          eq(sosPosts.isDeleted, false),
          or(isNull(sosUsers.isBanned), eq(sosUsers.isBanned, false))
        )
      )
      .orderBy(desc(sosPosts.createdAt))
      .limit(limit);

    return c.json({ success: true, data: { group, posts } });
  } catch (error) {
    console.error('[SoSatisfying API] Error fetching group:', error);
    return c.json(
      { success: false, error: { code: 'GROUP_FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.post('/groups', async (c) => {
  const body = await c.req.json();
  const parseResult = createGroupSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  if (payload.creatorId) {
    const userStatus = await getUserStatus(payload.creatorId);
    if (userStatus?.isBanned) {
      return c.json(
        { success: false, error: { code: 'USER_BANNED', message: 'User is banned' } },
        403
      );
    }
  }

  const groupContent = [payload.name, payload.displayTitle, payload.description]
    .filter(Boolean)
    .join(' ');
  if (containsBannedContent(groupContent)) {
    return c.json(
      { success: false, error: { code: 'CONTENT_REJECTED', message: 'Group violates policy' } },
      400
    );
  }
  const namePattern = /^[a-z0-9-]+$/;
  if (!namePattern.test(payload.name)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: 'Group name must be lowercase alphanumeric with hyphens only',
        },
      },
      400
    );
  }

  try {
    const [existing] = await db
      .select({ id: sosGroups.id })
      .from(sosGroups)
      .where(eq(sosGroups.name, payload.name))
      .limit(1);
    if (existing) {
      return c.json(
        { success: false, error: { code: 'GROUP_EXISTS', message: 'Group already exists' } },
        409
      );
    }

    const [created] = await db
      .insert(sosGroups)
      .values({
        name: payload.name,
        displayTitle: payload.displayTitle,
        description: payload.description,
        category: payload.category,
        is21Plus: payload.contentRating === '21+',
        bannerUrl: payload.bannerUrl,
        iconUrl: payload.iconUrl,
        creatorId: payload.creatorId,
        rules: payload.rules,
      })
      .returning();

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error creating group:', error);
    return c.json(
      { success: false, error: { code: 'GROUP_CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.post('/posts', async (c) => {
  const body = await c.req.json();
  const parseResult = createPostSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  const requesterKey = getRequesterKey(c, payload.authorId);
  if (!checkRateLimit(`${requesterKey}:posts`, 3, 60_000)) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many posts, slow down.' } },
      429
    );
  }

  if (payload.authorId) {
    const userStatus = await getUserStatus(payload.authorId);
    if (userStatus?.isBanned) {
      return c.json(
        { success: false, error: { code: 'USER_BANNED', message: 'User is banned' } },
        403
      );
    }
  }

  if (payload.contentType === 'text' && !payload.contentText) {
    return c.json(
      { success: false, error: { code: 'CONTENT_REQUIRED', message: 'Text content required' } },
      400
    );
  }
  if (payload.contentType !== 'text' && !payload.contentUrl) {
    return c.json(
      { success: false, error: { code: 'CONTENT_REQUIRED', message: 'Content URL required' } },
      400
    );
  }

  const contentToCheck = [
    payload.title,
    payload.contentText,
    payload.contentUrl,
  ]
    .filter(Boolean)
    .join(' ');

  if (containsBannedContent(contentToCheck)) {
    return c.json(
      { success: false, error: { code: 'CONTENT_REJECTED', message: 'Content violates policy' } },
      400
    );
  }

  try {
    const [group] = await db
      .select({ id: sosGroups.id, is21Plus: sosGroups.is21Plus })
      .from(sosGroups)
      .where(eq(sosGroups.id, payload.groupId))
      .limit(1);
    if (!group) {
      return c.json(
        { success: false, error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } },
        404
      );
    }

    if (payload.contentUrl) {
      const [duplicate] = await db
        .select({ id: sosPosts.id })
        .from(sosPosts)
        .where(and(eq(sosPosts.contentUrl, payload.contentUrl), eq(sosPosts.isDeleted, false)))
        .limit(1);
      if (duplicate) {
        return c.json(
          { success: false, error: { code: 'DUPLICATE_LINK', message: 'Duplicate link already posted' } },
          409
        );
      }
    }

    const [created] = await db
      .insert(sosPosts)
      .values({
        groupId: payload.groupId,
        authorId: payload.authorId,
        title: payload.title,
        contentType: payload.contentType,
        contentUrl: payload.contentUrl,
        contentText: payload.contentText,
        thumbnailUrl: payload.thumbnailUrl,
        is21Plus: payload.is21Plus ?? group.is21Plus,
        isOriginalContent: payload.isOriginalContent ?? false,
        flair: payload.flair,
      })
      .returning();

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error creating post:', error);
    return c.json(
      { success: false, error: { code: 'POST_CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/posts/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const [post] = await db
      .select({
        post: sosPosts,
        groupName: sosGroups.name,
        groupTitle: sosGroups.displayTitle,
      })
      .from(sosPosts)
      .leftJoin(sosGroups, eq(sosPosts.groupId, sosGroups.id))
      .where(eq(sosPosts.id, id))
      .limit(1);

    if (!post) {
      return c.json(
        { success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } },
        404
      );
    }

    return c.json({ success: true, data: post });
  } catch (error) {
    console.error('[SoSatisfying API] Error fetching post:', error);
    return c.json(
      { success: false, error: { code: 'POST_FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/posts/:id/comments', async (c) => {
  const id = c.req.param('id');
  const limit = parseLimit(c.req.query('limit'), 50);
  const offset = parseOffset(c.req.query('offset'));

  try {
    const comments = await db
      .select()
      .from(sosComments)
      .where(and(eq(sosComments.postId, id), eq(sosComments.isDeleted, false)))
      .orderBy(desc(sosComments.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ success: true, data: comments });
  } catch (error) {
    console.error('[SoSatisfying API] Error listing comments:', error);
    return c.json(
      { success: false, error: { code: 'COMMENT_LIST_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.post('/posts/:id/comments', async (c) => {
  const postId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = createCommentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const requesterKey = getRequesterKey(c, parseResult.data.authorId);
  if (!checkRateLimit(`${requesterKey}:comments`, 10, 60_000)) {
    return c.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many comments, slow down.' } },
      429
    );
  }

  if (parseResult.data.authorId) {
    const userStatus = await getUserStatus(parseResult.data.authorId);
    if (userStatus?.isBanned) {
      return c.json(
        { success: false, error: { code: 'USER_BANNED', message: 'User is banned' } },
        403
      );
    }
  }

  if (containsBannedContent(parseResult.data.content)) {
    return c.json(
      { success: false, error: { code: 'CONTENT_REJECTED', message: 'Comment violates policy' } },
      400
    );
  }

  try {
    const [post] = await db.select({ id: sosPosts.id }).from(sosPosts).where(eq(sosPosts.id, postId));
    if (!post) {
      return c.json(
        { success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } },
        404
      );
    }

    let depth = 0;
    if (parseResult.data.parentCommentId) {
      const [parent] = await db
        .select({ depth: sosComments.depth })
        .from(sosComments)
        .where(eq(sosComments.id, parseResult.data.parentCommentId))
        .limit(1);
      if (!parent) {
        return c.json(
          { success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent comment not found' } },
          404
        );
      }
      depth = parent.depth + 1;
      if (depth > 10) {
        return c.json(
          { success: false, error: { code: 'DEPTH_LIMIT', message: 'Max comment depth exceeded' } },
          400
        );
      }
    }

    const [created] = await db
      .insert(sosComments)
      .values({
        postId,
        authorId: parseResult.data.authorId,
        parentCommentId: parseResult.data.parentCommentId,
        content: parseResult.data.content,
        depth,
      })
      .returning();

    await db
      .update(sosPosts)
      .set({ commentCount: sql`${sosPosts.commentCount} + 1` })
      .where(eq(sosPosts.id, postId));

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error creating comment:', error);
    return c.json(
      { success: false, error: { code: 'COMMENT_CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Reports (MVP)
// ============================================

sosatisfyingRouter.post('/reports', async (c) => {
  const body = await c.req.json();
  const parseResult = reportSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  if (!payload.postId && !payload.commentId) {
    return c.json(
      { success: false, error: { code: 'MISSING_TARGET', message: 'Post or comment required' } },
      400
    );
  }

  try {
    const [created] = await db
      .insert(sosReports)
      .values({
        reporterId: payload.reporterId,
        postId: payload.postId,
        commentId: payload.commentId,
        reason: payload.reason,
        details: payload.details,
        status: 'pending',
      })
      .returning();

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error creating report:', error);
    return c.json(
      { success: false, error: { code: 'REPORT_CREATE_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/reports', async (c) => {
  const status = c.req.query('status') || 'pending';
  const limit = parseLimit(c.req.query('limit'), 50);

  try {
    const data = await db
      .select()
      .from(sosReports)
      .where(eq(sosReports.status, status))
      .orderBy(desc(sosReports.createdAt))
      .limit(limit);

    return c.json({ success: true, data });
  } catch (error) {
    console.error('[SoSatisfying API] Error listing reports:', error);
    return c.json(
      { success: false, error: { code: 'REPORT_LIST_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.patch('/reports/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateReportSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  try {
    const [updated] = await db
      .update(sosReports)
      .set({
        status: parseResult.data.status,
        reviewedBy: parseResult.data.reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(sosReports.id, id))
      .returning();

    if (!updated) {
      return c.json(
        { success: false, error: { code: 'REPORT_NOT_FOUND', message: 'Report not found' } },
        404
      );
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('[SoSatisfying API] Error updating report:', error);
    return c.json(
      { success: false, error: { code: 'REPORT_UPDATE_ERROR', message: String(error) } },
      500
    );
  }
});

// ============================================
// Admin (MVP)
// ============================================

sosatisfyingRouter.get('/admin/users', async (c) => {
  const adminUserId = c.req.query('adminUserId');
  const admin = await getAdminUser(adminUserId);
  if (!admin) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }

  const data = await db.select().from(sosUsers).orderBy(desc(sosUsers.createdAt));
  return c.json({ success: true, data });
});

sosatisfyingRouter.post('/admin/users/:id/ban', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const admin = await getAdminUser(body?.adminUserId);
  if (!admin) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }

  const [updated] = await db
    .update(sosUsers)
    .set({ isBanned: true })
    .where(eq(sosUsers.id, id))
    .returning({ id: sosUsers.id, isBanned: sosUsers.isBanned });
  if (!updated) {
    return c.json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, 404);
  }
  return c.json({ success: true, data: updated });
});

sosatisfyingRouter.post('/admin/posts/:id/block', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const admin = await getAdminUser(body?.adminUserId);
  if (!admin) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }

  const [updated] = await db
    .update(sosPosts)
    .set({ isDeleted: true })
    .where(eq(sosPosts.id, id))
    .returning({ id: sosPosts.id, isDeleted: sosPosts.isDeleted });
  if (!updated) {
    return c.json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } }, 404);
  }
  return c.json({ success: true, data: updated });
});

sosatisfyingRouter.get('/admin/ranking', async (c) => {
  const adminUserId = c.req.query('adminUserId');
  const admin = await getAdminUser(adminUserId);
  if (!admin) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }

  const [settings] = await db
    .select()
    .from(sosRankSettings)
    .orderBy(desc(sosRankSettings.updatedAt))
    .limit(1);

  return c.json({
    success: true,
    data: settings || { hotDecayHours: 24, voteWeight: 1, commentWeight: 0.2 },
  });
});

sosatisfyingRouter.patch('/admin/ranking', async (c) => {
  const body = await c.req.json();
  const parseResult = rankingSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const admin = await getAdminUser(parseResult.data.adminUserId);
  if (!admin) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }

  const [created] = await db
    .insert(sosRankSettings)
    .values({
      hotDecayHours: parseResult.data.hotDecayHours ?? 24,
      voteWeight: parseResult.data.voteWeight ?? 1,
      commentWeight: parseResult.data.commentWeight ?? 0.2,
      updatedAt: new Date(),
    })
    .returning();

  return c.json({ success: true, data: created });
});

// ============================================
// Ad spaces & ads (MVP)
// ============================================

sosatisfyingRouter.get('/ad-spaces', async (c) => {
  const data = await db.select().from(sosAdSpaces).orderBy(desc(sosAdSpaces.createdAt));
  return c.json({ success: true, data });
});

sosatisfyingRouter.post('/ad-spaces', async (c) => {
  const body = await c.req.json();
  const parseResult = adSpaceSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  const admin = await getAdminUser(payload.adminUserId);
  if (!admin && !payload.ownerUserId) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Owner required' } }, 403);
  }

  if (!admin && payload.groupId && payload.ownerUserId) {
    const [group] = await db
      .select({ creatorId: sosGroups.creatorId })
      .from(sosGroups)
      .where(eq(sosGroups.id, payload.groupId))
      .limit(1);
    if (!group || group.creatorId !== payload.ownerUserId) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not group owner' } }, 403);
    }
  }

  const [created] = await db
    .insert(sosAdSpaces)
    .values({
      name: payload.name,
      placement: payload.placement,
      groupId: payload.groupId,
      ownerUserId: payload.ownerUserId,
      allowSelfServe: payload.allowSelfServe ?? true,
      priceCents: payload.priceCents ?? 0,
    })
    .returning();
  return c.json({ success: true, data: created }, 201);
});

sosatisfyingRouter.patch('/ad-spaces/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateAdSpaceSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const [adSpace] = await db.select().from(sosAdSpaces).where(eq(sosAdSpaces.id, id)).limit(1);
  if (!adSpace) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ad space not found' } }, 404);
  }

  const admin = await getAdminUser(parseResult.data.adminUserId);
  const isOwner = parseResult.data.ownerUserId && adSpace.ownerUserId === parseResult.data.ownerUserId;
  if (!admin && !isOwner) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  const [updated] = await db
    .update(sosAdSpaces)
    .set({
      priceCents: parseResult.data.priceCents ?? adSpace.priceCents,
      allowSelfServe: parseResult.data.allowSelfServe ?? adSpace.allowSelfServe,
      status: parseResult.data.status ?? adSpace.status,
      updatedAt: new Date(),
    })
    .where(eq(sosAdSpaces.id, id))
    .returning();

  return c.json({ success: true, data: updated });
});

sosatisfyingRouter.post('/ad-spaces/:id/ads', async (c) => {
  const adSpaceId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = adSchema.safeParse({ ...body, adSpaceId });
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;
  const [adSpace] = await db.select().from(sosAdSpaces).where(eq(sosAdSpaces.id, adSpaceId)).limit(1);
  if (!adSpace) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ad space not found' } }, 404);
  }

  if (adSpace.ownerUserId && payload.ownerUserId && adSpace.ownerUserId !== payload.ownerUserId) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not ad space owner' } }, 403);
  }

  const contentToCheck = [payload.title, payload.clickUrl].filter(Boolean).join(' ');
  if (containsBannedContent(contentToCheck)) {
    return c.json(
      { success: false, error: { code: 'CONTENT_REJECTED', message: 'Ad violates policy' } },
      400
    );
  }

  const [created] = await db
    .insert(sosAds)
    .values({
      adSpaceId,
      ownerUserId: payload.ownerUserId,
      title: payload.title,
      imageUrl: payload.imageUrl,
      clickUrl: payload.clickUrl,
      isAdult: payload.isAdult ?? false,
      status: 'pending',
      moderationStatus: 'pending',
    })
    .returning();
  return c.json({ success: true, data: created }, 201);
});

sosatisfyingRouter.post('/ad-spaces/:id/buy', async (c) => {
  const adSpaceId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = buyAdSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const [adSpace] = await db.select().from(sosAdSpaces).where(eq(sosAdSpaces.id, adSpaceId)).limit(1);
  if (!adSpace) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ad space not found' } }, 404);
  }

  const [created] = await db
    .insert(sosAdOrders)
    .values({
      adSpaceId,
      buyerUserId: parseResult.data.buyerUserId,
      amountCents: adSpace.priceCents,
      status: 'pending',
    })
    .returning();
  return c.json({ success: true, data: created }, 201);
});

sosatisfyingRouter.patch('/admin/ads/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateAdSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }
  const admin = await getAdminUser(body?.adminUserId);
  if (!admin) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }

  const [updated] = await db
    .update(sosAds)
    .set({
      status: parseResult.data.status,
      moderationStatus: parseResult.data.moderationStatus,
      moderationReason: parseResult.data.moderationReason,
    })
    .where(eq(sosAds.id, id))
    .returning();
  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Ad not found' } }, 404);
  }
  return c.json({ success: true, data: updated });
});

sosatisfyingRouter.get('/ads/placement/:placement', async (c) => {
  const placement = c.req.param('placement');
  const data = await db
    .select({
      ad: sosAds,
      space: sosAdSpaces,
    })
    .from(sosAds)
    .leftJoin(sosAdSpaces, eq(sosAds.adSpaceId, sosAdSpaces.id))
    .where(and(eq(sosAdSpaces.placement, placement), eq(sosAds.status, 'active')))
    .orderBy(desc(sosAds.createdAt));
  return c.json({ success: true, data });
});

// ============================================
// Public ad API (MVP)
// ============================================

sosatisfyingRouter.get('/public/ad-spaces', async (c) => {
  const data = await db.select().from(sosAdSpaces).orderBy(desc(sosAdSpaces.createdAt));
  return c.json({ success: true, data });
});

sosatisfyingRouter.get('/public/ads/:placement', async (c) => {
  const placement = c.req.param('placement');
  const data = await db
    .select({
      ad: sosAds,
      space: sosAdSpaces,
    })
    .from(sosAds)
    .leftJoin(sosAdSpaces, eq(sosAds.adSpaceId, sosAdSpaces.id))
    .where(and(eq(sosAdSpaces.placement, placement), eq(sosAds.status, 'active')))
    .orderBy(desc(sosAds.createdAt));
  return c.json({ success: true, data });
});

// ============================================
// Bug reports (MVP)
// ============================================

sosatisfyingRouter.post('/bug-reports', async (c) => {
  const body = await c.req.json();
  const parseResult = bugReportSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  const payload = parseResult.data;

  try {
    const [created] = await db
      .insert(sosBugReports)
      .values({
        reporterId: payload.reporterId,
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        pageUrl: payload.pageUrl,
        userEmail: payload.userEmail,
      })
      .returning();

    let emailSent = false;
    const mailer = getBugMailer();
    if (mailer) {
      const { transport, from, to } = mailer;
      await transport.sendMail({
        from,
        to,
        subject: `[SoSatisfying Bug] ${payload.title} (${payload.severity})`,
        text: [
          `Title: ${payload.title}`,
          `Severity: ${payload.severity}`,
          payload.userEmail ? `Reporter: ${payload.userEmail}` : undefined,
          payload.pageUrl ? `Page: ${payload.pageUrl}` : undefined,
          '',
          payload.description,
        ]
          .filter(Boolean)
          .join('\n'),
      });
      emailSent = true;
    }

    return c.json({ success: true, data: { ...created, emailSent } }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error creating bug report:', error);
    return c.json(
      { success: false, error: { code: 'BUG_REPORT_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.post('/posts/:id/vote', async (c) => {
  const postId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = voteSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  try {
    const [post] = await db
      .select({ id: sosPosts.id, authorId: sosPosts.authorId })
      .from(sosPosts)
      .where(eq(sosPosts.id, postId))
      .limit(1);
    if (!post) {
      return c.json(
        { success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } },
        404
      );
    }
    const userStatus = await getUserStatus(parseResult.data.userId);
    if (userStatus?.isBanned) {
      return c.json(
        { success: false, error: { code: 'USER_BANNED', message: 'User is banned' } },
        403
      );
    }
    if (post.authorId && post.authorId === parseResult.data.userId) {
      return c.json(
        { success: false, error: { code: 'SELF_VOTE', message: 'Cannot vote on own post' } },
        400
      );
    }

    const [existing] = await db
      .select()
      .from(sosVotes)
      .where(
        and(eq(sosVotes.userId, parseResult.data.userId), eq(sosVotes.postId, postId), isNull(sosVotes.commentId))
      )
      .limit(1);

    if (existing) {
      if (existing.voteType === parseResult.data.value) {
        return c.json({ success: true, data: existing });
      }

      await db
        .update(sosVotes)
        .set({ voteType: parseResult.data.value })
        .where(eq(sosVotes.id, existing.id));

      if (existing.voteType === 1) {
        await db
          .update(sosPosts)
          .set({
            upvotes: sql`${sosPosts.upvotes} - 1`,
            downvotes: sql`${sosPosts.downvotes} + 1`,
          })
          .where(eq(sosPosts.id, postId));
        if (post.authorId) {
          await db
            .update(sosUsers)
            .set({ karma: sql`${sosUsers.karma} - 2` })
            .where(eq(sosUsers.id, post.authorId));
        }
      } else {
        await db
          .update(sosPosts)
          .set({
            upvotes: sql`${sosPosts.upvotes} + 1`,
            downvotes: sql`${sosPosts.downvotes} - 1`,
          })
          .where(eq(sosPosts.id, postId));
        if (post.authorId) {
          await db
            .update(sosUsers)
            .set({ karma: sql`${sosUsers.karma} + 2` })
            .where(eq(sosUsers.id, post.authorId));
        }
      }

      return c.json({ success: true, data: { ...existing, voteType: parseResult.data.value } });
    }

    const [created] = await db
      .insert(sosVotes)
      .values({
        userId: parseResult.data.userId,
        postId,
        voteType: parseResult.data.value,
      })
      .returning();

    if (parseResult.data.value === 1) {
      await db
        .update(sosPosts)
        .set({ upvotes: sql`${sosPosts.upvotes} + 1` })
        .where(eq(sosPosts.id, postId));
      if (post.authorId) {
        await db
          .update(sosUsers)
          .set({ karma: sql`${sosUsers.karma} + 1` })
          .where(eq(sosUsers.id, post.authorId));
      }
    } else {
      await db
        .update(sosPosts)
        .set({ downvotes: sql`${sosPosts.downvotes} + 1` })
        .where(eq(sosPosts.id, postId));
      if (post.authorId) {
        await db
          .update(sosUsers)
          .set({ karma: sql`${sosUsers.karma} - 1` })
          .where(eq(sosUsers.id, post.authorId));
      }
    }

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error voting on post:', error);
    return c.json(
      { success: false, error: { code: 'VOTE_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.post('/comments/:id/vote', async (c) => {
  const commentId = c.req.param('id');
  const body = await c.req.json();
  const parseResult = voteSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
      400
    );
  }

  try {
    const [comment] = await db
      .select({ id: sosComments.id, authorId: sosComments.authorId })
      .from(sosComments)
      .where(eq(sosComments.id, commentId))
      .limit(1);
    if (!comment) {
      return c.json(
        { success: false, error: { code: 'COMMENT_NOT_FOUND', message: 'Comment not found' } },
        404
      );
    }
    const userStatus = await getUserStatus(parseResult.data.userId);
    if (userStatus?.isBanned) {
      return c.json(
        { success: false, error: { code: 'USER_BANNED', message: 'User is banned' } },
        403
      );
    }
    if (comment.authorId && comment.authorId === parseResult.data.userId) {
      return c.json(
        { success: false, error: { code: 'SELF_VOTE', message: 'Cannot vote on own comment' } },
        400
      );
    }

    const [existing] = await db
      .select()
      .from(sosVotes)
      .where(
        and(
          eq(sosVotes.userId, parseResult.data.userId),
          eq(sosVotes.commentId, commentId),
          isNull(sosVotes.postId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.voteType === parseResult.data.value) {
        return c.json({ success: true, data: existing });
      }

      await db
        .update(sosVotes)
        .set({ voteType: parseResult.data.value })
        .where(eq(sosVotes.id, existing.id));

      if (existing.voteType === 1) {
        await db
          .update(sosComments)
          .set({
            upvotes: sql`${sosComments.upvotes} - 1`,
            downvotes: sql`${sosComments.downvotes} + 1`,
          })
          .where(eq(sosComments.id, commentId));
        if (comment.authorId) {
          await db
            .update(sosUsers)
            .set({ karma: sql`${sosUsers.karma} - 2` })
            .where(eq(sosUsers.id, comment.authorId));
        }
      } else {
        await db
          .update(sosComments)
          .set({
            upvotes: sql`${sosComments.upvotes} + 1`,
            downvotes: sql`${sosComments.downvotes} - 1`,
          })
          .where(eq(sosComments.id, commentId));
        if (comment.authorId) {
          await db
            .update(sosUsers)
            .set({ karma: sql`${sosUsers.karma} + 2` })
            .where(eq(sosUsers.id, comment.authorId));
        }
      }

      return c.json({ success: true, data: { ...existing, voteType: parseResult.data.value } });
    }

    const [created] = await db
      .insert(sosVotes)
      .values({
        userId: parseResult.data.userId,
        commentId,
        voteType: parseResult.data.value,
      })
      .returning();

    if (parseResult.data.value === 1) {
      await db
        .update(sosComments)
        .set({ upvotes: sql`${sosComments.upvotes} + 1` })
        .where(eq(sosComments.id, commentId));
      if (comment.authorId) {
        await db
          .update(sosUsers)
          .set({ karma: sql`${sosUsers.karma} + 1` })
          .where(eq(sosUsers.id, comment.authorId));
      }
    } else {
      await db
        .update(sosComments)
        .set({ downvotes: sql`${sosComments.downvotes} + 1` })
        .where(eq(sosComments.id, commentId));
      if (comment.authorId) {
        await db
          .update(sosUsers)
          .set({ karma: sql`${sosUsers.karma} - 1` })
          .where(eq(sosUsers.id, comment.authorId));
      }
    }

    return c.json({ success: true, data: created }, 201);
  } catch (error) {
    console.error('[SoSatisfying API] Error voting on comment:', error);
    return c.json(
      { success: false, error: { code: 'VOTE_ERROR', message: String(error) } },
      500
    );
  }
});

sosatisfyingRouter.get('/users/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const [user] = await db.select().from(sosUsers).where(eq(sosUsers.id, id)).limit(1);
    if (!user) {
      return c.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        404
      );
    }

    return c.json({ success: true, data: user });
  } catch (error) {
    console.error('[SoSatisfying API] Error fetching user:', error);
    return c.json(
      { success: false, error: { code: 'USER_FETCH_ERROR', message: String(error) } },
      500
    );
  }
});

export default sosatisfyingRouter;
