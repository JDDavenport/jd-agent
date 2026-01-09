/**
 * Notion Integration - Extract pages and databases
 *
 * Provides:
 * - Full page extraction with content
 * - Database extraction
 * - Incremental sync support
 * - File attachment handling
 */

import { Client } from '@notionhq/client';
import type { RawEntry } from '../types';
import { contentParser } from '../lib/content-parser';

// ============================================
// Types
// ============================================

export interface NotionConfig {
  apiKey: string;
  rootPageIds?: string[]; // Specific pages to start from
  excludePageIds?: string[]; // Pages to skip
  includeArchived?: boolean; // Include archived pages
}

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  createdTime: string;
  lastEditedTime: string;
  archived: boolean;
  parent: any;
  properties: any;
}

export interface NotionBlock {
  id: string;
  type: string;
  [key: string]: any;
}

// ============================================
// Notion Extractor
// ============================================

export class NotionExtractor {
  private notion: Client;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = {
      includeArchived: false,
      ...config,
    };
    this.notion = new Client({ auth: config.apiKey });
  }

  /**
   * Extract all accessible pages
   */
  async *extractAll(): AsyncGenerator<RawEntry> {
    console.log('Starting Notion extraction...');

    try {
      // Get all pages via search
      const pages = await this.getAllPages();
      console.log(`Found ${pages.length} Notion pages`);

      for (const page of pages) {
        // Skip excluded pages
        if (this.config.excludePageIds?.includes(page.id)) {
          continue;
        }

        // Skip archived unless included
        if (page.archived && !this.config.includeArchived) {
          continue;
        }

        try {
          const entry = await this.extractPage(page.id);
          if (entry) {
            yield entry;
          }
        } catch (error) {
          console.error(`Error extracting page ${page.id}:`, error);
          // Continue with next page
        }
      }
    } catch (error) {
      console.error('Error in Notion extraction:', error);
      throw error;
    }
  }

  /**
   * Extract a single page with its content
   */
  async extractPage(pageId: string): Promise<RawEntry | null> {
    try {
      // Get page metadata
      const page = await this.notion.pages.retrieve({ page_id: pageId }) as any;

      // Get page title
      const title = this.extractPageTitle(page);

      // Get all blocks (content)
      const blocks = await this.getPageBlocks(pageId);

      // Convert blocks to markdown
      const content = contentParser.notionBlocksToMarkdown(blocks);

      // Get folder path (parent hierarchy)
      const sourcePath = await this.getPagePath(page);

      // Extract attachments
      const attachments = this.extractAttachments(blocks);

      return {
        title: title || 'Untitled',
        content,
        source: 'notion',
        sourceId: page.id,
        sourceUrl: page.url || `https://notion.so/${page.id.replace(/-/g, '')}`,
        sourcePath,
        createdAt: new Date(page.created_time),
        modifiedAt: new Date(page.last_edited_time),
        rawMetadata: {
          properties: page.properties,
          archived: page.archived,
          icon: page.icon,
          cover: page.cover,
        },
        attachments,
      };
    } catch (error: any) {
      // Handle specific Notion API errors
      if (error.code === 'object_not_found') {
        console.warn(`Page ${pageId} not found or no access`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Extract pages from a database
   */
  async extractDatabase(databaseId: string): Promise<RawEntry[]> {
    const entries: RawEntry[] = [];

    try {
      // Query all pages in the database
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const response = await this.notion.databases.query({
          database_id: databaseId,
          start_cursor: cursor,
        });

        for (const page of response.results) {
          try {
            const entry = await this.extractPage(page.id);
            if (entry) {
              entries.push(entry);
            }
          } catch (error) {
            console.error(`Error extracting database page ${page.id}:`, error);
          }
        }

        hasMore = response.has_more;
        cursor = response.next_cursor || undefined;

        // Rate limiting
        await this.sleep(100);
      }
    } catch (error) {
      console.error(`Error extracting database ${databaseId}:`, error);
      throw error;
    }

    return entries;
  }

  /**
   * Get pages modified since a specific date (for incremental sync)
   */
  async *extractModifiedSince(since: Date): AsyncGenerator<RawEntry> {
    console.log(`Extracting Notion pages modified since ${since.toISOString()}`);

    try {
      const response = await this.notion.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
      });

      for (const page of response.results as any[]) {
        const lastEdited = new Date(page.last_edited_time);

        // Stop if we've reached pages older than our sync date
        if (lastEdited <= since) {
          break;
        }

        try {
          const entry = await this.extractPage(page.id);
          if (entry) {
            yield entry;
          }
        } catch (error) {
          console.error(`Error extracting page ${page.id}:`, error);
        }

        // Rate limiting
        await this.sleep(100);
      }
    } catch (error) {
      console.error('Error in incremental sync:', error);
      throw error;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get all accessible pages via search
   */
  private async getAllPages(): Promise<any[]> {
    const pages: any[] = [];
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      const response = await this.notion.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        start_cursor: cursor,
      });

      pages.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;

      // Rate limiting (Notion: 3 req/sec)
      await this.sleep(350);
    }

    return pages;
  }

  /**
   * Get all blocks for a page (recursive to handle nested blocks)
   */
  private async getPageBlocks(blockId: string, depth: number = 0): Promise<any[]> {
    if (depth > 10) {
      console.warn(`Maximum block depth reached for ${blockId}`);
      return [];
    }

    const blocks: any[] = [];
    let hasMore = true;
    let cursor: string | undefined;

    try {
      while (hasMore) {
        const response = await this.notion.blocks.children.list({
          block_id: blockId,
          start_cursor: cursor,
        });

        for (const block of response.results as any[]) {
          // Get children for blocks that can have them
          if (block.has_children) {
            block.children = await this.getPageBlocks(block.id, depth + 1);
          }
          blocks.push(block);
        }

        hasMore = response.has_more;
        cursor = response.next_cursor || undefined;

        // Rate limiting
        await this.sleep(100);
      }
    } catch (error: any) {
      console.error(`Error fetching blocks for ${blockId}:`, error.message);
      // Return what we have so far
    }

    return blocks;
  }

  /**
   * Extract page title from properties
   */
  private extractPageTitle(page: any): string {
    // Try to find title in properties
    for (const prop of Object.values(page.properties) as any[]) {
      if (prop.type === 'title' && prop.title?.length > 0) {
        return contentParser.notionRichTextToMarkdown(prop.title);
      }
    }
    return 'Untitled';
  }

  /**
   * Get the path/hierarchy of a page
   */
  private async getPagePath(page: any): Promise<string> {
    const path: string[] = [];
    let current = page;

    try {
      // Walk up the parent chain
      while (current.parent && path.length < 10) {
        const parent = current.parent;

        if (parent.type === 'workspace') {
          path.unshift('Workspace');
          break;
        } else if (parent.type === 'page_id') {
          try {
            const parentPage = await this.notion.pages.retrieve({
              page_id: parent.page_id,
            }) as any;
            const title = this.extractPageTitle(parentPage);
            path.unshift(title);
            current = parentPage;
          } catch {
            break;
          }
        } else if (parent.type === 'database_id') {
          try {
            const db = await this.notion.databases.retrieve({
              database_id: parent.database_id,
            }) as any;
            const title = this.extractDatabaseTitle(db);
            path.unshift(title);
            current = db;
          } catch {
            break;
          }
        } else {
          break;
        }

        // Rate limiting
        await this.sleep(100);
      }
    } catch (error) {
      console.error('Error building page path:', error);
    }

    return path.length > 0 ? path.join(' / ') : 'Root';
  }

  /**
   * Extract database title
   */
  private extractDatabaseTitle(database: any): string {
    if (database.title && database.title.length > 0) {
      return contentParser.notionRichTextToMarkdown(database.title);
    }
    return 'Untitled Database';
  }

  /**
   * Extract file attachments from blocks
   */
  private extractAttachments(blocks: any[]): RawEntry['attachments'] {
    const attachments: NonNullable<RawEntry['attachments']> = [];

    const processBlock = (block: any) => {
      const blockType = block.type;
      const blockContent = block[blockType];

      // Handle image blocks
      if (blockType === 'image') {
        const url = blockContent.file?.url || blockContent.external?.url;
        if (url) {
          attachments.push({
            filename: `image-${block.id}.jpg`,
            url,
            mimeType: 'image/jpeg',
            size: 0, // Unknown
          });
        }
      }

      // Handle file blocks
      if (blockType === 'file') {
        const url = blockContent.file?.url || blockContent.external?.url;
        const name = blockContent.name || `file-${block.id}`;
        if (url) {
          attachments.push({
            filename: name,
            url,
            mimeType: 'application/octet-stream',
            size: 0, // Unknown
          });
        }
      }

      // Handle PDF blocks
      if (blockType === 'pdf') {
        const url = blockContent.file?.url || blockContent.external?.url;
        if (url) {
          attachments.push({
            filename: `document-${block.id}.pdf`,
            url,
            mimeType: 'application/pdf',
            size: 0, // Unknown
          });
        }
      }

      // Recursively process children
      if (block.children) {
        block.children.forEach(processBlock);
      }
    };

    blocks.forEach(processBlock);
    return attachments.length > 0 ? attachments : undefined;
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Factory Function
// ============================================

export function createNotionExtractor(apiKey: string, config?: Partial<NotionConfig>): NotionExtractor {
  return new NotionExtractor({
    apiKey,
    ...config,
  });
}
