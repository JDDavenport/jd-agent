/**
 * SoSatisfying.com API Routes (MVP)
 *
 * Core endpoints for groups, posts, feed, voting, and comments.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  sosGroups,
  sosPosts,
  sosComments,
  sosVotes,
  sosUsers,
} from '../../db/schema';
import { and, desc, eq, gte, ilike, isNull, sql } from 'drizzle-orm';

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

// ============================================
// Feed
// ============================================

/**
 * GET /api/v1/sosatisfying/feed
 * Query params: sort=hot|new|top, timeRange=hour|day|week|month|year|all
 */
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

    let orderByClause;
    if (sortParse.data === 'new') {
      orderByClause = desc(sosPosts.createdAt);
    } else if (sortParse.data === 'top') {
      orderByClause = desc(sql`${sosPosts.upvotes} - ${sosPosts.downvotes}`);
    } else {
      orderByClause = desc(
        sql`(${sosPosts.upvotes} - ${sosPosts.downvotes}) / greatest(extract(epoch from (now() - ${sosPosts.createdAt})) / 3600, 1)`
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
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sosPosts)
      .where(and(...conditions));

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

// ============================================
// Groups
// ============================================

/**
 * GET /api/v1/sosatisfying/groups
 * List groups with optional search/category filters
 */
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

/**
 * GET /api/v1/sosatisfying/groups/:name
 * Get group details plus recent posts
 */
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
      .where(and(eq(sosPosts.groupId, group.id), eq(sosPosts.isDeleted, false)))
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

/**
 * POST /api/v1/sosatisfying/groups
 * Create a new group
 */
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

// ============================================
// Posts
// ============================================

/**
 * POST /api/v1/sosatisfying/posts
 * Create a new post
 */
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

/**
 * GET /api/v1/sosatisfying/posts/:id
 * Get post details
 */
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

/**
 * GET /api/v1/sosatisfying/posts/:id/comments
 * List comments for a post
 */
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

/**
 * POST /api/v1/sosatisfying/posts/:id/comments
 * Add comment to a post
 */
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
      depth = (parent.depth as number) + 1;
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

/**
 * POST /api/v1/sosatisfying/posts/:id/vote
 * Upvote or downvote a post
 */
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
      } else {
        await db
          .update(sosPosts)
          .set({
            upvotes: sql`${sosPosts.upvotes} + 1`,
            downvotes: sql`${sosPosts.downvotes} - 1`,
          })
          .where(eq(sosPosts.id, postId));
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
    } else {
      await db
        .update(sosPosts)
        .set({ downvotes: sql`${sosPosts.downvotes} + 1` })
        .where(eq(sosPosts.id, postId));
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

/**
 * POST /api/v1/sosatisfying/comments/:id/vote
 * Upvote or downvote a comment
 */
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
      } else {
        await db
          .update(sosComments)
          .set({
            upvotes: sql`${sosComments.upvotes} + 1`,
            downvotes: sql`${sosComments.downvotes} - 1`,
          })
          .where(eq(sosComments.id, commentId));
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
    } else {
      await db
        .update(sosComments)
        .set({ downvotes: sql`${sosComments.downvotes} + 1` })
        .where(eq(sosComments.id, commentId));
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

// ============================================
// Basic user helpers (MVP)
// ============================================

/**
 * GET /api/v1/sosatisfying/users/:id
 * Fetch a user profile
 */
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
