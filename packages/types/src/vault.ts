export type VaultContentType =
  | 'note'
  | 'recording_summary'
  | 'lecture'
  | 'meeting'
  | 'article'
  | 'reference'
  | 'resume'
  | 'document'
  | 'journal'
  | 'class_notes'
  | 'meeting_notes'
  | 'task_archive'
  | 'snippet'
  | 'template'
  | 'other';

export type VaultSource =
  | 'remarkable'
  | 'plaud'
  | 'email'
  | 'manual'
  | 'web'
  | 'canvas'
  | 'notion'
  | 'google_drive'
  | 'google_docs'
  | 'apple_notes';

export interface VaultEntry {
  id: string;
  title: string;
  content?: string;
  contentType: VaultContentType;
  source: VaultSource;
  sourceRef?: string;
  context: string;
  tags: string[];
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultTreeNode {
  id: string;
  title: string;
  contentType: string;
  context: string;
  parentId: string | null;
  children: VaultTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultBreadcrumb {
  id: string;
  title: string;
}

export interface CreateVaultInput {
  title: string;
  content?: string;
  contentType: VaultContentType;
  source?: VaultSource;
  context: string;
  tags?: string[];
  parentId?: string;
}

export interface VaultSearchParams {
  query: string;
  context?: string;
  contentType?: VaultContentType;
  limit?: number;
}

// ============================================
// VAULT PAGES (Notion-like block-based pages)
// ============================================

export interface VaultPage {
  id: string;
  parentId?: string | null;
  title: string;
  icon?: string | null;
  coverImage?: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  sortOrder: number;
  legacyEntryId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string | null;
}

export interface VaultPageTreeNode {
  id: string;
  title: string;
  icon?: string | null;
  parentId: string | null;
  isFavorite: boolean;
  children: VaultPageTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultPageBreadcrumb {
  id: string;
  title: string;
  icon?: string | null;
}

export interface CreateVaultPageInput {
  title?: string;
  parentId?: string | null;
  icon?: string | null;
  coverImage?: string | null;
}

export interface UpdateVaultPageInput {
  title?: string;
  icon?: string | null;
  coverImage?: string | null;
  isFavorite?: boolean;
  isArchived?: boolean;
  parentId?: string | null;
  sortOrder?: number;
}

// ============================================
// VAULT BLOCKS (Content blocks within pages)
// ============================================

export type VaultBlockType =
  // Text blocks
  | 'text'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list'
  | 'numbered_list'
  | 'todo'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  // Media blocks
  | 'image'
  | 'file'
  | 'bookmark'
  // Link blocks (Phase 6)
  | 'page_link'
  | 'task_link'
  | 'goal_link';

// Block content type definitions
export interface TextBlockContent {
  text: string;
  marks?: Array<{
    type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link';
    attrs?: { href?: string };
  }>;
}

export interface HeadingBlockContent {
  text: string;
  level: 1 | 2 | 3;
}

export interface TodoBlockContent {
  text: string;
  checked: boolean;
}

export interface CalloutBlockContent {
  text: string;
  emoji?: string;
  color?: 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
}

export interface CodeBlockContent {
  code: string;
  language?: string;
  caption?: string;
}

export interface ImageBlockContent {
  url: string;
  caption?: string;
  width?: number;
}

export interface FileBlockContent {
  url: string;
  filename: string;
  size?: number;
  mimeType?: string;
}

export interface BookmarkBlockContent {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  image?: string;
}

export interface PageLinkBlockContent {
  pageId: string;
  title?: string;
}

export interface TaskLinkBlockContent {
  taskId: string;
  title?: string;
  status?: string;
}

export interface GoalLinkBlockContent {
  goalId: string;
  title?: string;
}

export type VaultBlockContent =
  | TextBlockContent
  | HeadingBlockContent
  | TodoBlockContent
  | CalloutBlockContent
  | CodeBlockContent
  | ImageBlockContent
  | FileBlockContent
  | BookmarkBlockContent
  | PageLinkBlockContent
  | TaskLinkBlockContent
  | GoalLinkBlockContent
  | Record<string, unknown>; // For divider and other empty blocks

export interface VaultBlock {
  id: string;
  pageId: string;
  parentBlockId?: string | null;
  type: VaultBlockType;
  content: VaultBlockContent;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaultBlockInput {
  type: VaultBlockType;
  content: VaultBlockContent;
  parentBlockId?: string | null;
  afterBlockId?: string | null; // Insert position
}

export interface UpdateVaultBlockInput {
  type?: VaultBlockType;
  content?: VaultBlockContent;
}

export interface MoveVaultBlockInput {
  pageId?: string;
  parentBlockId?: string | null;
  afterBlockId?: string | null;
}

export interface BatchBlockOperation {
  op: 'create' | 'update' | 'delete' | 'move';
  blockId?: string;
  data?: CreateVaultBlockInput | UpdateVaultBlockInput | MoveVaultBlockInput;
}

// ============================================
// VAULT REFERENCES (Cross-system links)
// ============================================

export type VaultReferenceTargetType = 'page' | 'task' | 'goal' | 'calendar_event' | 'person';

export interface VaultReference {
  id: string;
  pageId: string;
  blockId?: string | null;
  targetType: VaultReferenceTargetType;
  targetId: string;
  createdAt: string;
}

export interface CreateVaultReferenceInput {
  pageId: string;
  blockId?: string | null;
  targetType: VaultReferenceTargetType;
  targetId: string;
}
