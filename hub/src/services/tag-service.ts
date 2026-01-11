/**
 * Tag Service
 *
 * Manages controlled tag taxonomy with categories, validation, and suggestions.
 */

import { db } from '../db/client';
import { labels, tagCategories } from '../db/schema';
import { eq, ilike, or, sql, desc, asc, inArray } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface TagCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  isFavorite: boolean;
  sortOrder: number;
  categoryId: string | null;
  description: string | null;
  aliases: string[] | null;
  isSystem: boolean;
  usageCount: number;
  createdAt: Date;
  category?: TagCategory | null;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  categoryId?: string;
  description?: string;
  aliases?: string[];
  isSystem?: boolean;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  categoryId?: string | null;
  description?: string;
  aliases?: string[];
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
}

export interface TagSuggestion {
  tag: Tag;
  matchType: 'exact' | 'prefix' | 'alias' | 'fuzzy';
  score: number;
}

// ============================================
// Default System Tags
// ============================================

const DEFAULT_CATEGORIES = [
  { name: 'status', description: 'Status indicators', color: '#3B82F6', icon: '📊', isSystem: true },
  { name: 'type', description: 'Content type classification', color: '#10B981', icon: '📁', isSystem: true },
  { name: 'context', description: 'GTD contexts', color: '#F59E0B', icon: '📍', isSystem: true },
  { name: 'priority', description: 'Priority levels', color: '#EF4444', icon: '🎯', isSystem: true },
  { name: 'area', description: 'Life areas', color: '#8B5CF6', icon: '🏠', isSystem: true },
];

const DEFAULT_TAGS = [
  // Status tags
  { name: 'active', categoryName: 'status', color: '#22C55E', aliases: ['in-progress', 'ongoing'] },
  { name: 'archived', categoryName: 'status', color: '#6B7280', aliases: ['done', 'completed'] },
  { name: 'favorite', categoryName: 'status', color: '#F59E0B', aliases: ['starred', 'important'] },
  { name: 'processed', categoryName: 'status', color: '#3B82F6', aliases: ['reviewed'] },

  // Type tags
  { name: 'project', categoryName: 'type', color: '#8B5CF6', aliases: ['proj'] },
  { name: 'reference', categoryName: 'type', color: '#06B6D4', aliases: ['ref', 'resource'] },
  { name: 'meeting', categoryName: 'type', color: '#EC4899', aliases: ['mtg'] },
  { name: 'person', categoryName: 'type', color: '#F97316', aliases: ['contact', 'people'] },

  // Context tags (GTD)
  { name: '@computer', categoryName: 'context', color: '#3B82F6', aliases: ['@laptop', '@desk'] },
  { name: '@home', categoryName: 'context', color: '#22C55E', aliases: ['@house'] },
  { name: '@errands', categoryName: 'context', color: '#F59E0B', aliases: ['@out', '@outside'] },
  { name: '@calls', categoryName: 'context', color: '#EC4899', aliases: ['@phone'] },
  { name: '@email', categoryName: 'context', color: '#6366F1', aliases: ['@inbox'] },

  // Priority tags
  { name: 'urgent', categoryName: 'priority', color: '#EF4444', aliases: ['asap', 'critical'] },
  { name: 'high', categoryName: 'priority', color: '#F97316', aliases: ['important'] },
  { name: 'low', categoryName: 'priority', color: '#6B7280', aliases: ['someday'] },

  // Area tags
  { name: 'work', categoryName: 'area', color: '#3B82F6', aliases: ['professional', 'career'] },
  { name: 'personal', categoryName: 'area', color: '#22C55E', aliases: ['life'] },
  { name: 'family', categoryName: 'area', color: '#EC4899', aliases: ['home'] },
  { name: 'health', categoryName: 'area', color: '#10B981', aliases: ['fitness', 'wellness'] },
  { name: 'finance', categoryName: 'area', color: '#F59E0B', aliases: ['money', 'budget'] },
  { name: 'school', categoryName: 'area', color: '#8B5CF6', aliases: ['education', 'learning'] },
];

// ============================================
// Tag Service
// ============================================

class TagService {
  /**
   * Initialize default categories and tags if they don't exist
   */
  async initializeDefaults(): Promise<{ categories: number; tags: number }> {
    let categoriesCreated = 0;
    let tagsCreated = 0;

    // Create default categories
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.name, cat.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(tagCategories).values(cat);
        categoriesCreated++;
      }
    }

    // Create default tags
    for (const tag of DEFAULT_TAGS) {
      const existing = await db
        .select()
        .from(labels)
        .where(eq(labels.name, tag.name))
        .limit(1);

      if (existing.length === 0) {
        // Find category
        const [category] = await db
          .select()
          .from(tagCategories)
          .where(eq(tagCategories.name, tag.categoryName))
          .limit(1);

        await db.insert(labels).values({
          name: tag.name,
          color: tag.color,
          categoryId: category?.id,
          aliases: tag.aliases,
          isSystem: true,
        });
        tagsCreated++;
      }
    }

    return { categories: categoriesCreated, tags: tagsCreated };
  }

  // ============================================
  // Category Operations
  // ============================================

  async listCategories(): Promise<TagCategory[]> {
    return db
      .select()
      .from(tagCategories)
      .orderBy(asc(tagCategories.sortOrder), asc(tagCategories.name));
  }

  async getCategoryById(id: string): Promise<TagCategory | null> {
    const [category] = await db
      .select()
      .from(tagCategories)
      .where(eq(tagCategories.id, id))
      .limit(1);
    return category || null;
  }

  async createCategory(input: CreateCategoryInput): Promise<TagCategory> {
    const [category] = await db
      .insert(tagCategories)
      .values(input)
      .returning();
    return category;
  }

  async deleteCategory(id: string): Promise<boolean> {
    // Check if system category
    const category = await this.getCategoryById(id);
    if (category?.isSystem) {
      throw new Error('Cannot delete system category');
    }

    const result = await db
      .delete(tagCategories)
      .where(eq(tagCategories.id, id))
      .returning();
    return result.length > 0;
  }

  // ============================================
  // Tag Operations
  // ============================================

  async listTags(options: { categoryId?: string; includeCategory?: boolean } = {}): Promise<Tag[]> {
    const query = db
      .select()
      .from(labels)
      .orderBy(desc(labels.usageCount), asc(labels.name));

    if (options.categoryId) {
      return query.where(eq(labels.categoryId, options.categoryId));
    }

    return query;
  }

  async getTagById(id: string): Promise<Tag | null> {
    const [tag] = await db
      .select()
      .from(labels)
      .where(eq(labels.id, id))
      .limit(1);
    return tag || null;
  }

  async getTagByName(name: string): Promise<Tag | null> {
    const [tag] = await db
      .select()
      .from(labels)
      .where(eq(labels.name, name.toLowerCase()))
      .limit(1);
    return tag || null;
  }

  async createTag(input: CreateTagInput): Promise<Tag> {
    const [tag] = await db
      .insert(labels)
      .values({
        name: input.name.toLowerCase(),
        color: input.color,
        categoryId: input.categoryId,
        description: input.description,
        aliases: input.aliases?.map(a => a.toLowerCase()),
        isSystem: input.isSystem || false,
      })
      .returning();
    return tag;
  }

  async updateTag(id: string, input: UpdateTagInput): Promise<Tag | null> {
    const existing = await this.getTagById(id);
    if (!existing) return null;

    // Prevent modifying system tags' core properties
    if (existing.isSystem && (input.name || input.categoryId !== undefined)) {
      throw new Error('Cannot modify name or category of system tag');
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.toLowerCase();
    if (input.color !== undefined) updateData.color = input.color;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.aliases !== undefined) updateData.aliases = input.aliases.map(a => a.toLowerCase());
    if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

    const [tag] = await db
      .update(labels)
      .set(updateData)
      .where(eq(labels.id, id))
      .returning();
    return tag;
  }

  async deleteTag(id: string): Promise<boolean> {
    const tag = await this.getTagById(id);
    if (tag?.isSystem) {
      throw new Error('Cannot delete system tag');
    }

    const result = await db
      .delete(labels)
      .where(eq(labels.id, id))
      .returning();
    return result.length > 0;
  }

  /**
   * Increment usage count for tags
   */
  async incrementUsage(tagNames: string[]): Promise<void> {
    if (tagNames.length === 0) return;

    await db
      .update(labels)
      .set({ usageCount: sql`${labels.usageCount} + 1` })
      .where(inArray(labels.name, tagNames.map(t => t.toLowerCase())));
  }

  // ============================================
  // Tag Suggestions
  // ============================================

  /**
   * Get tag suggestions based on input
   * Searches name, aliases, and does fuzzy matching
   */
  async suggestTags(input: string, limit: number = 10): Promise<TagSuggestion[]> {
    if (!input || input.length === 0) {
      // Return popular tags
      const popular = await db
        .select()
        .from(labels)
        .orderBy(desc(labels.usageCount), asc(labels.name))
        .limit(limit);

      return popular.map(tag => ({
        tag,
        matchType: 'fuzzy' as const,
        score: tag.usageCount,
      }));
    }

    const searchTerm = input.toLowerCase();
    const suggestions: TagSuggestion[] = [];

    // Get all tags for matching
    const allTags = await db.select().from(labels);

    for (const tag of allTags) {
      let matchType: TagSuggestion['matchType'] | null = null;
      let score = 0;

      // Exact match
      if (tag.name === searchTerm) {
        matchType = 'exact';
        score = 100 + tag.usageCount;
      }
      // Prefix match
      else if (tag.name.startsWith(searchTerm)) {
        matchType = 'prefix';
        score = 80 + tag.usageCount;
      }
      // Alias match
      else if (tag.aliases?.some(a => a === searchTerm || a.startsWith(searchTerm))) {
        matchType = 'alias';
        score = 70 + tag.usageCount;
      }
      // Contains match
      else if (tag.name.includes(searchTerm)) {
        matchType = 'fuzzy';
        score = 50 + tag.usageCount;
      }
      // Alias contains
      else if (tag.aliases?.some(a => a.includes(searchTerm))) {
        matchType = 'fuzzy';
        score = 40 + tag.usageCount;
      }

      if (matchType) {
        suggestions.push({ tag, matchType, score });
      }
    }

    // Sort by score and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Validate tags exist (or create them if allowed)
   */
  async validateTags(
    tagNames: string[],
    options: { createMissing?: boolean } = {}
  ): Promise<{ valid: string[]; invalid: string[]; created: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];
    const created: string[] = [];

    for (const name of tagNames) {
      const normalized = name.toLowerCase();
      const existing = await this.getTagByName(normalized);

      if (existing) {
        valid.push(normalized);
      } else if (options.createMissing) {
        await this.createTag({ name: normalized });
        created.push(normalized);
        valid.push(normalized);
      } else {
        invalid.push(normalized);
      }
    }

    return { valid, invalid, created };
  }

  /**
   * Get tags grouped by category
   */
  async getTagsByCategory(): Promise<Map<string, Tag[]>> {
    const tags = await this.listTags();
    const categories = await this.listCategories();

    const grouped = new Map<string, Tag[]>();
    grouped.set('uncategorized', []);

    for (const cat of categories) {
      grouped.set(cat.name, []);
    }

    for (const tag of tags) {
      if (tag.categoryId) {
        const category = categories.find(c => c.id === tag.categoryId);
        if (category) {
          grouped.get(category.name)?.push(tag);
        } else {
          grouped.get('uncategorized')?.push(tag);
        }
      } else {
        grouped.get('uncategorized')?.push(tag);
      }
    }

    return grouped;
  }
}

// Export singleton instance
export const tagService = new TagService();
