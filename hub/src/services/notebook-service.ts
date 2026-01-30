/**
 * JD Agent - Notebook Service
 *
 * Business logic for Jupyter notebook integration:
 * - Parse .ipynb files to extract content
 * - Sync notebooks to vault for search
 * - Track notebook metadata and changes
 * - Generate embeddings for semantic search
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { createHash } from 'crypto';
import { eq, desc, asc, sql, and, or, like } from 'drizzle-orm';
import { db } from '../db/client';
import { jupyterNotebooks, vaultPages, vaultEntries } from '../db/schema';
import { VaultPageService } from './vault-page-service';
import { vaultEmbeddingService } from './vault-embedding-service';

// ============================================
// Types
// ============================================

export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[];
  outputs?: NotebookOutput[];
  execution_count?: number | null;
  metadata?: Record<string, unknown>;
}

export interface NotebookOutput {
  output_type: string;
  text?: string[];
  data?: Record<string, unknown>;
  name?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface NotebookJSON {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: {
      name?: string;
      display_name?: string;
      language?: string;
    };
    language_info?: {
      name?: string;
      version?: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

export interface ParsedNotebook {
  filename: string;
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  notebookModifiedAt: Date;
  kernelName: string | null;
  kernelDisplayName: string | null;
  cellCount: number;
  codeCellCount: number;
  markdownCellCount: number;
  extractedText: string;
  extractedCode: string;
  extractedMarkdown: string;
}

export interface NotebookRecord {
  id: string;
  filename: string;
  filePath: string;
  fileHash: string;
  kernelName: string | null;
  kernelDisplayName: string | null;
  cellCount: number | null;
  codeCellCount: number | null;
  markdownCellCount: number | null;
  extractedText: string | null;
  vaultPageId: string | null;
  syncStatus: string;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
  fileSizeBytes: number | null;
  notebookModifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotebookStats {
  totalNotebooks: number;
  syncedCount: number;
  pendingCount: number;
  errorCount: number;
  totalCells: number;
  totalCodeCells: number;
  totalMarkdownCells: number;
  kernelBreakdown: Record<string, number>;
}

export interface SyncResult {
  success: boolean;
  notebookId?: string;
  vaultPageId?: string;
  isNew?: boolean;
  error?: string;
}

// ============================================
// Notebook Service
// ============================================

export class NotebookService {
  private vaultPageService: VaultPageService;
  private notebookDir: string;

  constructor() {
    this.vaultPageService = new VaultPageService();
    this.notebookDir = process.env.JUPYTER_NOTEBOOK_DIR || './storage/notebooks';
  }

  // ============================================
  // Parsing
  // ============================================

  /**
   * Parse a .ipynb file and extract all content
   */
  parseNotebook(filePath: string): ParsedNotebook | null {
    if (!existsSync(filePath)) {
      console.error(`[NotebookService] File not found: ${filePath}`);
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const notebook: NotebookJSON = JSON.parse(content);
      const stats = statSync(filePath);

      // Calculate file hash for change detection
      const fileHash = createHash('sha256').update(content).digest('hex');

      // Extract cell counts
      const cells = notebook.cells || [];
      const codeCells = cells.filter(c => c.cell_type === 'code');
      const markdownCells = cells.filter(c => c.cell_type === 'markdown');

      // Extract text content
      const extractedCode = this.extractCodeContent(codeCells);
      const extractedMarkdown = this.extractMarkdownContent(markdownCells);
      const extractedText = this.combineExtractedContent(extractedMarkdown, extractedCode);

      // Kernel info
      const kernelSpec = notebook.metadata?.kernelspec;

      return {
        filename: basename(filePath),
        filePath,
        fileHash,
        fileSizeBytes: stats.size,
        notebookModifiedAt: stats.mtime,
        kernelName: kernelSpec?.name || null,
        kernelDisplayName: kernelSpec?.display_name || null,
        cellCount: cells.length,
        codeCellCount: codeCells.length,
        markdownCellCount: markdownCells.length,
        extractedText,
        extractedCode,
        extractedMarkdown,
      };
    } catch (error) {
      console.error(`[NotebookService] Failed to parse ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract text content from code cells
   */
  private extractCodeContent(cells: NotebookCell[]): string {
    return cells
      .map(cell => {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        // Include output text if available
        const outputs = (cell.outputs || [])
          .filter(o => o.text || o.data?.['text/plain'])
          .map(o => {
            if (o.text) return Array.isArray(o.text) ? o.text.join('') : o.text;
            if (o.data?.['text/plain']) {
              const text = o.data['text/plain'];
              return Array.isArray(text) ? text.join('') : text;
            }
            return '';
          })
          .join('\n');

        return outputs ? `${source}\n# Output:\n${outputs}` : source;
      })
      .join('\n\n');
  }

  /**
   * Extract text content from markdown cells
   */
  private extractMarkdownContent(cells: NotebookCell[]): string {
    return cells
      .map(cell => {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        return source;
      })
      .join('\n\n');
  }

  /**
   * Combine markdown and code into searchable text
   */
  private combineExtractedContent(markdown: string, code: string): string {
    const parts: string[] = [];
    if (markdown.trim()) {
      parts.push('## Documentation\n' + markdown);
    }
    if (code.trim()) {
      parts.push('## Code\n' + code);
    }
    return parts.join('\n\n');
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Get all tracked notebooks
   */
  async list(): Promise<NotebookRecord[]> {
    const results = await db
      .select()
      .from(jupyterNotebooks)
      .orderBy(desc(jupyterNotebooks.updatedAt));

    return results as NotebookRecord[];
  }

  /**
   * Get a notebook by ID
   */
  async getById(id: string): Promise<NotebookRecord | null> {
    const [result] = await db
      .select()
      .from(jupyterNotebooks)
      .where(eq(jupyterNotebooks.id, id))
      .limit(1);

    return (result as NotebookRecord) || null;
  }

  /**
   * Get a notebook by file path
   */
  async getByPath(filePath: string): Promise<NotebookRecord | null> {
    const [result] = await db
      .select()
      .from(jupyterNotebooks)
      .where(eq(jupyterNotebooks.filePath, filePath))
      .limit(1);

    return (result as NotebookRecord) || null;
  }

  /**
   * Search notebooks by content
   */
  async search(query: string): Promise<NotebookRecord[]> {
    const searchPattern = `%${query.toLowerCase()}%`;

    const results = await db
      .select()
      .from(jupyterNotebooks)
      .where(
        or(
          like(sql`lower(${jupyterNotebooks.filename})`, searchPattern),
          like(sql`lower(${jupyterNotebooks.extractedText})`, searchPattern)
        )
      )
      .orderBy(desc(jupyterNotebooks.updatedAt));

    return results as NotebookRecord[];
  }

  /**
   * Get notebook statistics
   */
  async getStats(): Promise<NotebookStats> {
    const all = await this.list();

    const kernelBreakdown: Record<string, number> = {};
    let totalCells = 0;
    let totalCodeCells = 0;
    let totalMarkdownCells = 0;

    for (const nb of all) {
      totalCells += nb.cellCount || 0;
      totalCodeCells += nb.codeCellCount || 0;
      totalMarkdownCells += nb.markdownCellCount || 0;

      const kernel = nb.kernelName || 'unknown';
      kernelBreakdown[kernel] = (kernelBreakdown[kernel] || 0) + 1;
    }

    return {
      totalNotebooks: all.length,
      syncedCount: all.filter(n => n.syncStatus === 'synced').length,
      pendingCount: all.filter(n => n.syncStatus === 'pending').length,
      errorCount: all.filter(n => n.syncStatus === 'error').length,
      totalCells,
      totalCodeCells,
      totalMarkdownCells,
      kernelBreakdown,
    };
  }

  // ============================================
  // Sync Operations
  // ============================================

  /**
   * Process a notebook file and sync to vault
   */
  async processNotebook(filePath: string): Promise<SyncResult> {
    console.log(`[NotebookService] Processing: ${filePath}`);

    // Parse the notebook
    const parsed = this.parseNotebook(filePath);
    if (!parsed) {
      return { success: false, error: 'Failed to parse notebook' };
    }

    try {
      // Check if we already have this notebook
      const existing = await this.getByPath(filePath);

      if (existing) {
        // Check if file has changed
        if (existing.fileHash === parsed.fileHash) {
          console.log(`[NotebookService] No changes detected for: ${filePath}`);
          return { success: true, notebookId: existing.id, isNew: false };
        }

        // Update existing record
        return await this.updateNotebook(existing.id, parsed);
      } else {
        // Create new record
        return await this.createNotebook(parsed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[NotebookService] Sync failed for ${filePath}:`, error);

      // Record the error
      if (existing) {
        await db
          .update(jupyterNotebooks)
          .set({
            syncStatus: 'error',
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(jupyterNotebooks.id, existing.id));
      }

      return { success: false, error: message };
    }
  }

  /**
   * Create a new notebook record and vault entry
   */
  private async createNotebook(parsed: ParsedNotebook): Promise<SyncResult> {
    // Create vault page for the notebook
    const vaultPage = await this.vaultPageService.create({
      title: parsed.filename.replace('.ipynb', ''),
      icon: '📓',
    });

    // Add content block with notebook summary
    const summaryContent = this.generateNotebookSummary(parsed);

    // Create the notebook record
    const [notebook] = await db
      .insert(jupyterNotebooks)
      .values({
        filename: parsed.filename,
        filePath: parsed.filePath,
        fileHash: parsed.fileHash,
        kernelName: parsed.kernelName,
        kernelDisplayName: parsed.kernelDisplayName,
        cellCount: parsed.cellCount,
        codeCellCount: parsed.codeCellCount,
        markdownCellCount: parsed.markdownCellCount,
        extractedText: parsed.extractedText,
        extractedCode: parsed.extractedCode,
        extractedMarkdown: parsed.extractedMarkdown,
        vaultPageId: vaultPage.id,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        fileSizeBytes: parsed.fileSizeBytes,
        notebookModifiedAt: parsed.notebookModifiedAt,
        source: 'local',
      })
      .returning();

    // Generate embeddings for search
    if (parsed.extractedText.trim()) {
      // Create a temporary vault entry for embedding (we can enhance this later)
      const [entry] = await db
        .insert(vaultEntries)
        .values({
          title: parsed.filename,
          content: parsed.extractedText,
          contentType: 'notebook',
          context: 'data-analysis',
          source: 'jupyter',
          tags: ['notebook', parsed.kernelName || 'python'].filter(Boolean),
          filePath: parsed.filePath,
          fileType: 'ipynb',
        })
        .returning();

      // Update notebook with vault entry reference
      await db
        .update(jupyterNotebooks)
        .set({ vaultEntryId: entry.id })
        .where(eq(jupyterNotebooks.id, notebook.id));

      // Generate embeddings
      vaultEmbeddingService.generateEmbeddings(entry.id).catch(err => {
        console.error('[NotebookService] Failed to generate embeddings:', err);
      });
    }

    console.log(`[NotebookService] Created notebook: ${notebook.id}`);

    return {
      success: true,
      notebookId: notebook.id,
      vaultPageId: vaultPage.id,
      isNew: true,
    };
  }

  /**
   * Update an existing notebook record
   */
  private async updateNotebook(id: string, parsed: ParsedNotebook): Promise<SyncResult> {
    const existing = await this.getById(id);
    if (!existing) {
      return { success: false, error: 'Notebook not found' };
    }

    // Update the record
    await db
      .update(jupyterNotebooks)
      .set({
        fileHash: parsed.fileHash,
        kernelName: parsed.kernelName,
        kernelDisplayName: parsed.kernelDisplayName,
        cellCount: parsed.cellCount,
        codeCellCount: parsed.codeCellCount,
        markdownCellCount: parsed.markdownCellCount,
        extractedText: parsed.extractedText,
        extractedCode: parsed.extractedCode,
        extractedMarkdown: parsed.extractedMarkdown,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        errorMessage: null,
        fileSizeBytes: parsed.fileSizeBytes,
        notebookModifiedAt: parsed.notebookModifiedAt,
        updatedAt: new Date(),
      })
      .where(eq(jupyterNotebooks.id, id));

    // Update vault entry if exists
    if (existing.vaultEntryId) {
      await db
        .update(vaultEntries)
        .set({
          content: parsed.extractedText,
          updatedAt: new Date(),
        })
        .where(eq(vaultEntries.id, existing.vaultEntryId));

      // Regenerate embeddings
      vaultEmbeddingService.generateEmbeddings(existing.vaultEntryId).catch(err => {
        console.error('[NotebookService] Failed to regenerate embeddings:', err);
      });
    }

    console.log(`[NotebookService] Updated notebook: ${id}`);

    return {
      success: true,
      notebookId: id,
      vaultPageId: existing.vaultPageId || undefined,
      isNew: false,
    };
  }

  /**
   * Generate a summary of the notebook for vault display
   */
  private generateNotebookSummary(parsed: ParsedNotebook): string {
    const lines = [
      `**Kernel:** ${parsed.kernelDisplayName || parsed.kernelName || 'Unknown'}`,
      `**Cells:** ${parsed.cellCount} total (${parsed.codeCellCount} code, ${parsed.markdownCellCount} markdown)`,
      `**Size:** ${this.formatFileSize(parsed.fileSizeBytes)}`,
      `**Modified:** ${parsed.notebookModifiedAt.toISOString()}`,
    ];

    // Add a preview of markdown content if available
    if (parsed.extractedMarkdown.trim()) {
      const preview = parsed.extractedMarkdown.slice(0, 500);
      lines.push('\n---\n');
      lines.push(preview + (parsed.extractedMarkdown.length > 500 ? '...' : ''));
    }

    return lines.join('\n');
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Scan notebook directory and sync all notebooks
   */
  async syncAll(): Promise<{ processed: number; errors: number; results: SyncResult[] }> {
    console.log(`[NotebookService] Syncing all notebooks from: ${this.notebookDir}`);

    if (!existsSync(this.notebookDir)) {
      console.log(`[NotebookService] Directory does not exist: ${this.notebookDir}`);
      return { processed: 0, errors: 0, results: [] };
    }

    const results: SyncResult[] = [];
    let processed = 0;
    let errors = 0;

    // Find all .ipynb files recursively
    const notebooks = this.findNotebooks(this.notebookDir);
    console.log(`[NotebookService] Found ${notebooks.length} notebooks`);

    for (const filePath of notebooks) {
      const result = await this.processNotebook(filePath);
      results.push(result);

      if (result.success) {
        processed++;
      } else {
        errors++;
      }
    }

    console.log(`[NotebookService] Sync complete: ${processed} processed, ${errors} errors`);

    return { processed, errors, results };
  }

  /**
   * Find all .ipynb files in a directory (recursive)
   */
  private findNotebooks(dir: string): string[] {
    const notebooks: string[] = [];

    if (!existsSync(dir)) return notebooks;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and common non-notebook dirs
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          notebooks.push(...this.findNotebooks(fullPath));
        }
      } else if (entry.isFile() && extname(entry.name) === '.ipynb') {
        // Skip checkpoint files
        if (!entry.name.includes('.ipynb_checkpoints')) {
          notebooks.push(fullPath);
        }
      }
    }

    return notebooks;
  }

  /**
   * Delete a notebook record (and optionally the file)
   */
  async delete(id: string, deleteFile = false): Promise<{ success: boolean; error?: string }> {
    const notebook = await this.getById(id);
    if (!notebook) {
      return { success: false, error: 'Notebook not found' };
    }

    try {
      // Delete from database
      await db.delete(jupyterNotebooks).where(eq(jupyterNotebooks.id, id));

      // Optionally delete the file
      if (deleteFile && existsSync(notebook.filePath)) {
        const { unlinkSync } = await import('fs');
        unlinkSync(notebook.filePath);
      }

      console.log(`[NotebookService] Deleted notebook: ${id}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

// Export singleton instance
export const notebookService = new NotebookService();
