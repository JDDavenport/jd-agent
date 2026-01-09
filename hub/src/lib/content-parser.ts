/**
 * Content Parser - Convert various formats to clean Markdown
 *
 * Handles:
 * - HTML → Markdown
 * - Notion rich text → Markdown
 * - Notion blocks → Markdown
 * - Plain text normalization
 */

import TurndownService from 'turndown';

// ============================================
// Configuration
// ============================================

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

// Custom rules for better Markdown conversion
turndownService.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`,
});

turndownService.addRule('highlight', {
  filter: ['mark'],
  replacement: (content) => `==${content}==`,
});

// ============================================
// Parser Class
// ============================================

export class ContentParser {
  /**
   * Convert HTML to Markdown
   */
  htmlToMarkdown(html: string): string {
    if (!html || html.trim() === '') return '';

    try {
      const markdown = turndownService.turndown(html);
      return this.cleanMarkdown(markdown);
    } catch (error) {
      console.error('Error converting HTML to Markdown:', error);
      // Fallback: strip HTML tags
      return html.replace(/<[^>]*>/g, '').trim();
    }
  }

  /**
   * Convert Notion rich text array to Markdown
   */
  notionRichTextToMarkdown(richText: any[]): string {
    if (!richText || richText.length === 0) return '';

    let markdown = '';

    for (const text of richText) {
      let content = text.plain_text || '';

      // Apply annotations
      if (text.annotations) {
        const { bold, italic, strikethrough, underline, code } = text.annotations;

        if (code) content = `\`${content}\``;
        if (bold) content = `**${content}**`;
        if (italic) content = `_${content}_`;
        if (strikethrough) content = `~~${content}~~`;
        if (underline) content = `<u>${content}</u>`; // HTML fallback
      }

      // Handle links
      if (text.href) {
        content = `[${content}](${text.href})`;
      }

      markdown += content;
    }

    return markdown;
  }

  /**
   * Convert Notion blocks to Markdown (recursive)
   */
  notionBlocksToMarkdown(blocks: any[]): string {
    if (!blocks || blocks.length === 0) return '';

    let markdown = '';

    for (const block of blocks) {
      const blockType = block.type;
      const blockContent = block[blockType];

      switch (blockType) {
        case 'paragraph':
          markdown += this.notionRichTextToMarkdown(blockContent.rich_text) + '\n\n';
          break;

        case 'heading_1':
          markdown += `# ${this.notionRichTextToMarkdown(blockContent.rich_text)}\n\n`;
          break;

        case 'heading_2':
          markdown += `## ${this.notionRichTextToMarkdown(blockContent.rich_text)}\n\n`;
          break;

        case 'heading_3':
          markdown += `### ${this.notionRichTextToMarkdown(blockContent.rich_text)}\n\n`;
          break;

        case 'bulleted_list_item':
          markdown += `- ${this.notionRichTextToMarkdown(blockContent.rich_text)}\n`;
          break;

        case 'numbered_list_item':
          markdown += `1. ${this.notionRichTextToMarkdown(blockContent.rich_text)}\n`;
          break;

        case 'to_do':
          const checked = blockContent.checked ? 'x' : ' ';
          markdown += `- [${checked}] ${this.notionRichTextToMarkdown(blockContent.rich_text)}\n`;
          break;

        case 'toggle':
          markdown += `<details>\n<summary>${this.notionRichTextToMarkdown(blockContent.rich_text)}</summary>\n\n`;
          if (block.children) {
            markdown += this.notionBlocksToMarkdown(block.children);
          }
          markdown += `</details>\n\n`;
          break;

        case 'code':
          const language = blockContent.language || '';
          const code = this.notionRichTextToMarkdown(blockContent.rich_text);
          markdown += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
          break;

        case 'quote':
          const quoteText = this.notionRichTextToMarkdown(blockContent.rich_text);
          markdown += `> ${quoteText}\n\n`;
          break;

        case 'callout':
          const calloutText = this.notionRichTextToMarkdown(blockContent.rich_text);
          const emoji = blockContent.icon?.emoji || '💡';
          markdown += `${emoji} **Note:** ${calloutText}\n\n`;
          break;

        case 'divider':
          markdown += `---\n\n`;
          break;

        case 'table':
          // Basic table support - could be enhanced
          markdown += `[Table with ${blockContent.table_width} columns]\n\n`;
          break;

        case 'image':
          const imageUrl = blockContent.file?.url || blockContent.external?.url;
          const caption = this.notionRichTextToMarkdown(blockContent.caption || []);
          if (imageUrl) {
            markdown += `![${caption}](${imageUrl})\n\n`;
          }
          break;

        case 'file':
          const fileUrl = blockContent.file?.url || blockContent.external?.url;
          const fileName = blockContent.name || 'file';
          if (fileUrl) {
            markdown += `[${fileName}](${fileUrl})\n\n`;
          }
          break;

        case 'bookmark':
          const bookmarkUrl = blockContent.url;
          markdown += `[🔖 Bookmark](${bookmarkUrl})\n\n`;
          break;

        case 'link_preview':
          markdown += `[🔗 Link](${blockContent.url})\n\n`;
          break;

        case 'equation':
          markdown += `$$${blockContent.expression}$$\n\n`;
          break;

        default:
          // For unsupported block types, try to extract any rich text
          if (blockContent?.rich_text) {
            markdown += this.notionRichTextToMarkdown(blockContent.rich_text) + '\n\n';
          }
      }

      // Handle nested children (for all block types)
      if (block.children && blockType !== 'toggle') {
        markdown += this.notionBlocksToMarkdown(block.children);
      }
    }

    return markdown;
  }

  /**
   * Clean and normalize Markdown
   */
  cleanMarkdown(markdown: string): string {
    return markdown
      // Remove excessive newlines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Remove leading/trailing whitespace
      .trim()
      // Normalize line endings
      .replace(/\r\n/g, '\n');
  }

  /**
   * Extract plain text from Markdown (for search indexing)
   */
  extractPlainText(markdown: string): string {
    return markdown
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bold/italic markers
      .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
      // Remove strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove list markers
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^---$/gm, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect and extract metadata from content
   */
  extractMetadata(content: string): {
    hasCodeBlocks: boolean;
    hasImages: boolean;
    hasLinks: boolean;
    wordCount: number;
    headings: string[];
  } {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const imageRegex = /!\[.*?\]\(.*?\)/g;
    const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
    const headingRegex = /^#{1,6}\s+(.+)$/gm;

    const headings: string[] = [];
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1]);
    }

    const plainText = this.extractPlainText(content);
    const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;

    return {
      hasCodeBlocks: codeBlockRegex.test(content),
      hasImages: imageRegex.test(content),
      hasLinks: linkRegex.test(content),
      wordCount,
      headings,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const contentParser = new ContentParser();
