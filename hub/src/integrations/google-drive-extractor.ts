/**
 * Google Drive & Docs Integration - Extract files and documents
 *
 * Provides:
 * - Full file listing with filtering
 * - Google Docs export as Markdown
 * - Google Sheets, Slides reference
 * - PDF text extraction
 * - File download for attachments
 * - Folder hierarchy tracking
 */

import { google, drive_v3, docs_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { RawEntry } from '../types';
import { contentParser } from '../lib/content-parser';

// PDF parsing - loaded dynamically to handle ESM/CJS interop with Bun
let pdfParseLib: ((buffer: Buffer) => Promise<{ text: string }>) | null = null;
async function getPdfParse() {
  if (!pdfParseLib) {
    try {
      // Try dynamic require for Bun compatibility
      const mod = await import('pdf-parse');
      pdfParseLib = mod.default || mod;
    } catch {
      pdfParseLib = null;
    }
  }
  return pdfParseLib;
}

// ============================================
// Types
// ============================================

export interface GoogleDriveConfig {
  credentials: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  rootFolderId?: string; // Start from specific folder
  excludeFolderIds?: string[]; // Folders to skip
  fileTypes?: string[]; // MIME types to include
  downloadFiles?: boolean; // Download files for attachment storage
}

// ============================================
// Google Drive Extractor
// ============================================

export class GoogleDriveExtractor {
  private auth: OAuth2Client;
  private drive: drive_v3.Drive;
  private docs: docs_v1.Docs;
  private config: GoogleDriveConfig;

  constructor(config: GoogleDriveConfig) {
    this.config = {
      downloadFiles: true,
      ...config,
    };

    // Set up OAuth2 client
    this.auth = new google.auth.OAuth2(
      config.credentials.clientId,
      config.credentials.clientSecret
    );

    this.auth.setCredentials({
      refresh_token: config.credentials.refreshToken,
    });

    // Initialize API clients
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.docs = google.docs({ version: 'v1', auth: this.auth });
  }

  /**
   * Extract all files from Google Drive
   */
  async *extractAll(): AsyncGenerator<RawEntry> {
    console.log('Starting Google Drive extraction...');

    try {
      const files = await this.listAllFiles();
      console.log(`Found ${files.length} files in Google Drive`);

      for (const file of files) {
        try {
          const entry = await this.extractFile(file);
          if (entry) {
            yield entry;
          }
        } catch (error) {
          console.error(`Error extracting file ${file.id}:`, error);
          // Continue with next file
        }
      }
    } catch (error) {
      console.error('Error in Google Drive extraction:', error);
      throw error;
    }
  }

  /**
   * Extract a single file
   */
  async extractFile(file: drive_v3.Schema$File): Promise<RawEntry | null> {
    if (!file.id || !file.name) {
      return null;
    }

    const mimeType = file.mimeType || '';
    let content = '';
    let attachments: RawEntry['attachments'];

    try {
      // Handle different file types
      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Doc - export as Markdown
        content = await this.exportDocAsMarkdown(file.id);
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Sheet - create reference
        content = `# ${file.name}\n\n[View Google Sheet](${file.webViewLink})`;
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        // Google Slides - create reference
        content = `# ${file.name}\n\n[View Google Slides](${file.webViewLink})`;
      } else if (mimeType === 'application/pdf') {
        // PDF - extract text
        const pdfBuffer = await this.downloadFile(file.id);
        content = await this.extractPdfText(pdfBuffer);

        // Store PDF as attachment
        if (this.config.downloadFiles) {
          attachments = [{
            filename: file.name,
            data: pdfBuffer,
            mimeType: 'application/pdf',
            size: pdfBuffer.length,
          }];
        }
      } else if (mimeType.startsWith('text/') || mimeType.includes('markdown')) {
        // Plain text file
        const buffer = await this.downloadFile(file.id);
        content = buffer.toString('utf-8');
      } else if (this.shouldDownload(mimeType)) {
        // Other files - store as attachment
        content = `# ${file.name}\n\n[View file](${file.webViewLink})`;

        if (this.config.downloadFiles) {
          const buffer = await this.downloadFile(file.id);
          attachments = [{
            filename: file.name,
            data: buffer,
            mimeType,
            size: buffer.length,
          }];
        }
      } else {
        // Skip unsupported file types
        console.log(`Skipping unsupported file type: ${mimeType} (${file.name})`);
        return null;
      }

      // Get folder path
      const sourcePath = await this.getFolderPath(file.parents?.[0]);

      return {
        title: file.name,
        content,
        source: mimeType === 'application/vnd.google-apps.document' ? 'google_docs' : 'google_drive',
        sourceId: file.id,
        sourceUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}`,
        sourcePath,
        createdAt: file.createdTime ? new Date(file.createdTime) : new Date(),
        modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
        rawMetadata: {
          mimeType,
          size: file.size,
          owners: file.owners,
          starred: file.starred,
          trashed: file.trashed,
        },
        attachments,
      };
    } catch (error: any) {
      console.error(`Error processing file ${file.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Get files modified since a specific date (for incremental sync)
   */
  async *extractModifiedSince(since: Date): AsyncGenerator<RawEntry> {
    console.log(`Extracting Google Drive files modified since ${since.toISOString()}`);

    try {
      const query = `modifiedTime > '${since.toISOString()}' and trashed = false`;
      const files = await this.listFiles(query);

      for (const file of files) {
        try {
          const entry = await this.extractFile(file);
          if (entry) {
            yield entry;
          }
        } catch (error) {
          console.error(`Error extracting file ${file.id}:`, error);
        }
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
   * List all files in Drive
   */
  private async listAllFiles(): Promise<drive_v3.Schema$File[]> {
    const query = this.buildQuery();
    return this.listFiles(query);
  }

  /**
   * List files matching a query
   */
  private async listFiles(query: string): Promise<drive_v3.Schema$File[]> {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const response = await this.drive.files.list({
          q: query,
          fields: 'nextPageToken, files(id, name, mimeType, webViewLink, parents, createdTime, modifiedTime, size, owners, starred, trashed)',
          pageSize: 100,
          pageToken,
        });

        if (response.data.files) {
          files.push(...response.data.files);
        }

        pageToken = response.data.nextPageToken || undefined;

        // Rate limiting
        await this.sleep(100);
      } while (pageToken);
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }

    return files;
  }

  /**
   * Build query for file listing
   */
  private buildQuery(): string {
    const conditions: string[] = ['trashed = false'];

    // Filter by root folder if specified
    if (this.config.rootFolderId) {
      conditions.push(`'${this.config.rootFolderId}' in parents`);
    }

    // Exclude specific folders
    if (this.config.excludeFolderIds && this.config.excludeFolderIds.length > 0) {
      for (const folderId of this.config.excludeFolderIds) {
        conditions.push(`not '${folderId}' in parents`);
      }
    }

    // Filter by MIME types if specified
    if (this.config.fileTypes && this.config.fileTypes.length > 0) {
      const mimeConditions = this.config.fileTypes.map(type => `mimeType='${type}'`);
      conditions.push(`(${mimeConditions.join(' or ')})`);
    }

    return conditions.join(' and ');
  }

  /**
   * Export Google Doc as Markdown
   */
  private async exportDocAsMarkdown(fileId: string): Promise<string> {
    try {
      // Get the document content
      const doc = await this.docs.documents.get({ documentId: fileId });

      // Convert Google Docs structure to Markdown
      return this.googleDocToMarkdown(doc.data);
    } catch (error) {
      console.error(`Error exporting doc ${fileId}:`, error);

      // Fallback: export as HTML and convert
      try {
        const response = await this.drive.files.export({
          fileId,
          mimeType: 'text/html',
        }, { responseType: 'text' });

        return contentParser.htmlToMarkdown(response.data as string);
      } catch {
        // Last resort: just return a link
        return `[Google Doc - Failed to export](https://docs.google.com/document/d/${fileId})`;
      }
    }
  }

  /**
   * Convert Google Docs structure to Markdown
   */
  private googleDocToMarkdown(doc: docs_v1.Schema$Document): string {
    let markdown = '';

    if (!doc.body?.content) {
      return markdown;
    }

    for (const element of doc.body.content) {
      if (element.paragraph) {
        const para = element.paragraph;
        let paraText = '';

        if (para.elements) {
          for (const elem of para.elements) {
            if (elem.textRun) {
              let text = elem.textRun.content || '';
              const style = elem.textRun.textStyle;

              // Apply formatting
              if (style) {
                if (style.bold) text = `**${text}**`;
                if (style.italic) text = `_${text}_`;
                if (style.underline) text = `<u>${text}</u>`;
                if (style.strikethrough) text = `~~${text}~~`;
                if (style.link?.url) text = `[${text}](${style.link.url})`;
              }

              paraText += text;
            }
          }
        }

        // Apply paragraph styling
        const paraStyle = para.paragraphStyle?.namedStyleType;
        if (paraStyle === 'HEADING_1') {
          markdown += `# ${paraText}\n\n`;
        } else if (paraStyle === 'HEADING_2') {
          markdown += `## ${paraText}\n\n`;
        } else if (paraStyle === 'HEADING_3') {
          markdown += `### ${paraText}\n\n`;
        } else {
          markdown += `${paraText}\n\n`;
        }
      }
    }

    return contentParser.cleanMarkdown(markdown);
  }

  /**
   * Download a file
   */
  private async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error(`Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = await getPdfParse();
      if (!pdfParse) {
        return '[PDF - pdf-parse library not available]';
      }
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      return '[PDF - Text extraction failed]';
    }
  }

  /**
   * Get folder path for a file
   */
  private async getFolderPath(folderId?: string): Promise<string> {
    if (!folderId) return 'Root';

    const path: string[] = [];
    let currentId = folderId;

    try {
      while (currentId && path.length < 10) {
        const folder = await this.drive.files.get({
          fileId: currentId,
          fields: 'name, parents',
        });

        if (folder.data.name) {
          path.unshift(folder.data.name);
        }

        currentId = folder.data.parents?.[0] || '';

        // Rate limiting
        await this.sleep(100);
      }
    } catch (error) {
      console.error('Error building folder path:', error);
    }

    return path.length > 0 ? path.join(' / ') : 'Root';
  }

  /**
   * Determine if a file type should be downloaded
   */
  private shouldDownload(mimeType: string): boolean {
    // Download images, documents, archives, etc.
    const downloadableTypes = [
      'image/',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
    ];

    return downloadableTypes.some(type => mimeType.startsWith(type));
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

export function createGoogleDriveExtractor(config: GoogleDriveConfig): GoogleDriveExtractor {
  return new GoogleDriveExtractor(config);
}
