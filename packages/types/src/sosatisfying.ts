export type ContentType = 'link' | 'image' | 'video' | 'text' | 'gallery';
export type FeedSort = 'hot' | 'new' | 'top';
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
export type VoteValue = 1 | -1;
export type ContentRating = 'all' | '21+';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  emailVerified: boolean;
  isBanned: boolean;
  ageVerified21Plus: boolean;
}

export interface GroupRule {
  title: string;
  description?: string;
}

export interface Group {
  id: string;
  name: string;
  displayTitle: string;
  description?: string;
  category?: string;
  contentRating: ContentRating;
  bannerUrl?: string;
  iconUrl?: string;
  creatorId: string;
  createdAt: string;
  subscriberCount: number;
  rules?: GroupRule[];
}

export interface Post {
  id: string;
  groupId: string;
  authorId?: string;
  title: string;
  contentType: ContentType;
  contentUrl?: string;
  contentText?: string;
  thumbnailUrl?: string;
  is21Plus: boolean;
  isOriginalContent: boolean;
  flair?: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  editedAt?: string;
  isDeleted: boolean;
  isPinned: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId?: string;
  parentCommentId?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  editedAt?: string;
  isDeleted: boolean;
  depth: number;
}

export interface Vote {
  userId: string;
  postId?: string;
  commentId?: string;
  value: VoteValue;
  createdAt: string;
}

export interface Subscription {
  userId: string;
  groupId: string;
  subscribedAt: string;
}

export interface Moderator {
  userId: string;
  groupId: string;
  addedAt: string;
  permissions?: string[];
}

export interface Report {
  id: string;
  reporterId?: string;
  postId?: string;
  commentId?: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AdRevenue {
  id: string;
  groupId: string;
  date: string;
  impressions: number;
  clicks: number;
  revenueCents: number;
  creatorShareCents: number;
}

export interface CreateGroupInput {
  name: string;
  displayTitle: string;
  description?: string;
  category?: string;
  contentRating?: ContentRating;
  bannerUrl?: string;
  iconUrl?: string;
  rules?: GroupRule[];
}

export interface CreatePostInput {
  groupId: string;
  title: string;
  contentType: ContentType;
  contentUrl?: string;
  contentText?: string;
  is21Plus?: boolean;
  isOriginalContent?: boolean;
  flair?: string;
}

export interface CreateCommentInput {
  postId: string;
  parentCommentId?: string;
  content: string;
}

export interface VoteInput {
  postId?: string;
  commentId?: string;
  value: VoteValue;
}
