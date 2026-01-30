import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  date,
  index,
} from 'drizzle-orm/pg-core';

export const sosUsers = pgTable(
  'sos_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    walletAddress: text('wallet_address'),
    isAdmin: boolean('is_admin').default(false).notNull(),
    karma: integer('karma').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    isBanned: boolean('is_banned').default(false).notNull(),
    ageVerified21Plus: boolean('age_verified_21plus').default(false).notNull(),
  },
  (table) => [
    index('sos_users_username_idx').on(table.username),
    index('sos_users_email_idx').on(table.email),
  ]
);

export const sosGroups = pgTable(
  'sos_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    displayTitle: text('display_title').notNull(),
    description: text('description'),
    category: text('category'),
    is21Plus: boolean('is_21plus').default(false).notNull(),
    bannerUrl: text('banner_url'),
    iconUrl: text('icon_url'),
    creatorId: uuid('creator_id').references(() => sosUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    subscriberCount: integer('subscriber_count').default(0).notNull(),
    rules: jsonb('rules'),
  },
  (table) => [
    index('sos_groups_name_idx').on(table.name),
    index('sos_groups_category_idx').on(table.category),
    index('sos_groups_creator_idx').on(table.creatorId),
  ]
);

export const sosPosts = pgTable(
  'sos_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    contentType: text('content_type').notNull(),
    contentUrl: text('content_url'),
    contentText: text('content_text'),
    thumbnailUrl: text('thumbnail_url'),
    is21Plus: boolean('is_21plus').default(false).notNull(),
    isOriginalContent: boolean('is_original_content').default(false).notNull(),
    flair: text('flair'),
    upvotes: integer('upvotes').default(0).notNull(),
    downvotes: integer('downvotes').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
  },
  (table) => [
    index('sos_posts_group_idx').on(table.groupId),
    index('sos_posts_created_idx').on(table.createdAt),
    index('sos_posts_group_created_idx').on(table.groupId, table.createdAt),
  ]
);

export const sosComments = pgTable(
  'sos_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .references(() => sosPosts.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    parentCommentId: uuid('parent_comment_id').references(() => sosComments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    upvotes: integer('upvotes').default(0).notNull(),
    downvotes: integer('downvotes').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    depth: integer('depth').default(0).notNull(),
  },
  (table) => [
    index('sos_comments_post_idx').on(table.postId),
    index('sos_comments_post_created_idx').on(table.postId, table.createdAt),
  ]
);

export const sosVotes = pgTable(
  'sos_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => sosUsers.id, { onDelete: 'cascade' })
      .notNull(),
    postId: uuid('post_id').references(() => sosPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => sosComments.id, { onDelete: 'cascade' }),
    voteType: integer('vote_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_votes_user_idx').on(table.userId),
    index('sos_votes_post_idx').on(table.postId),
    index('sos_votes_comment_idx').on(table.commentId),
  ]
);

export const sosSubscriptions = pgTable(
  'sos_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => sosUsers.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_subscriptions_user_idx').on(table.userId),
    index('sos_subscriptions_group_idx').on(table.groupId),
  ]
);

export const sosModerators = pgTable(
  'sos_moderators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => sosUsers.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    permissions: jsonb('permissions'),
  },
  (table) => [
    index('sos_moderators_user_idx').on(table.userId),
    index('sos_moderators_group_idx').on(table.groupId),
  ]
);

export const sosReports = pgTable(
  'sos_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    postId: uuid('post_id').references(() => sosPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => sosComments.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').default('pending').notNull(),
    reviewedBy: uuid('reviewed_by').references(() => sosUsers.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_reports_status_idx').on(table.status),
    index('sos_reports_post_idx').on(table.postId),
    index('sos_reports_comment_idx').on(table.commentId),
  ]
);

export const sosAdRevenue = pgTable(
  'sos_ad_revenue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    impressions: integer('impressions').default(0).notNull(),
    clicks: integer('clicks').default(0).notNull(),
    revenueCents: integer('revenue_cents').default(0).notNull(),
    creatorShareCents: integer('creator_share_cents').default(0).notNull(),
  },
  (table) => [
    index('sos_ad_revenue_group_idx').on(table.groupId),
    index('sos_ad_revenue_date_idx').on(table.date),
  ]
);

export const sosBugReports = pgTable(
  'sos_bug_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    severity: text('severity').default('medium').notNull(),
    pageUrl: text('page_url'),
    userEmail: text('user_email'),
    status: text('status').default('new').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_bug_reports_status_idx').on(table.status),
    index('sos_bug_reports_created_idx').on(table.createdAt),
  ]
);

export const sosAdSpaces = pgTable(
  'sos_ad_spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    placement: text('placement').notNull(), // frontpage-banner, sidebar-rect, in-feed
    groupId: uuid('group_id').references(() => sosGroups.id, { onDelete: 'set null' }),
    ownerUserId: uuid('owner_user_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    allowSelfServe: boolean('allow_self_serve').default(true).notNull(),
    priceCents: integer('price_cents').default(0).notNull(),
    status: text('status').default('active').notNull(), // active, paused
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_ad_spaces_placement_idx').on(table.placement),
    index('sos_ad_spaces_group_idx').on(table.groupId),
    index('sos_ad_spaces_owner_idx').on(table.ownerUserId),
  ]
);

export const sosAds = pgTable(
  'sos_ads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adSpaceId: uuid('ad_space_id')
      .references(() => sosAdSpaces.id, { onDelete: 'cascade' })
      .notNull(),
    ownerUserId: uuid('owner_user_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    imageUrl: text('image_url'),
    clickUrl: text('click_url'),
    status: text('status').default('pending').notNull(), // pending, active, rejected, archived
    isAdult: boolean('is_adult').default(false).notNull(),
    moderationStatus: text('moderation_status').default('pending').notNull(),
    moderationReason: text('moderation_reason'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_ads_space_idx').on(table.adSpaceId),
    index('sos_ads_status_idx').on(table.status),
    index('sos_ads_moderation_idx').on(table.moderationStatus),
  ]
);

export const sosAdOrders = pgTable(
  'sos_ad_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adSpaceId: uuid('ad_space_id')
      .references(() => sosAdSpaces.id, { onDelete: 'cascade' })
      .notNull(),
    buyerUserId: uuid('buyer_user_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').default(0).notNull(),
    status: text('status').default('pending').notNull(), // pending, paid, cancelled
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_ad_orders_space_idx').on(table.adSpaceId),
    index('sos_ad_orders_status_idx').on(table.status),
  ]
);

export const sosRankSettings = pgTable(
  'sos_rank_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hotDecayHours: integer('hot_decay_hours').default(24).notNull(),
    voteWeight: integer('vote_weight').default(1).notNull(),
    commentWeight: real('comment_weight').default(0.2).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('sos_rank_settings_updated_idx').on(table.updatedAt)]
);
