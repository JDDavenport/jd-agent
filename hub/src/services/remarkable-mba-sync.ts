/**
 * Remarkable MBA Sync Service
 *
 * Syncs the BYU MBA folder structure from Remarkable Cloud to Vault pages.
 * Creates a 1:1 mapping of folders and documents with:
 * - PDF attachments for each document
 * - OCR text as formatted child pages
 * - Daily grouping of documents per class
 */

import { db } from '../db/client';
import { remarkableVaultSync, vaultPages, vaultBlocks } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { remarkableCloudSync } from './remarkable-cloud-sync';
import { vaultPageService } from './vault-page-service';
import { vaultBlockService } from './vault-block-service';
import { statSync } from 'fs';
import { basename } from 'path';

// ============================================
// Types
// ============================================

interface MbaSyncConfig {
  rootFolderName: string;
  storageBasePath: string;
}

interface SyncResult {
  success: boolean;
  foldersProcessed: number;
  documentsProcessed: number;
  pagesCreated: number;
  errors: string[];
}

interface ProcessedDocument {
  remarkableId: string;
  name: string;
  pdfPath: string;
  pdfUrl: string;
  ocrText: string;
  lastModified: number;
}

// ============================================
// Service
// ============================================

export class RemarkableMbaSyncService {
  private config: MbaSyncConfig = {
    rootFolderName: 'BYU MBA',
    storageBasePath: 'storage/remarkable/mba',
  };

  /**
   * Sync the entire MBA folder structure to Vault
   */
  async syncMbaFolder(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      foldersProcessed: 0,
      documentsProcessed: 0,
      pagesCreated: 0,
      errors: [],
    };

    try {
      console.log('[MbaSync] Starting MBA folder sync...');

      // 1. Find BYU MBA folder in Remarkable
      const mbaFolder = remarkableCloudSync.findFolderByName(this.config.rootFolderName);
      if (!mbaFolder) {
        result.errors.push(`Root folder "${this.config.rootFolderName}" not found in Remarkable`);
        return result;
      }

      console.log(`[MbaSync] Found MBA folder: ${mbaFolder.name} (${mbaFolder.id})`);

      // 2. Ensure root Vault page exists
      const mbaVaultPage = await this.ensureVaultPageExists(
        this.config.rootFolderName,
        null,
        '📚',
        mbaFolder.id,
        'folder'
      );
      result.foldersProcessed++;

      // 3. Get semester folders (direct children of MBA folder)
      const semesterFolders = remarkableCloudSync.getChildren(mbaFolder.id)
        .filter(c => c.type === 'CollectionType');

      console.log(`[MbaSync] Found ${semesterFolders.length} semester folders`);

      for (const semesterFolder of semesterFolders) {
        try {
          await this.processSemesterFolder(semesterFolder, mbaVaultPage.id, result);
        } catch (error) {
          result.errors.push(`Failed to process semester ${semesterFolder.name}: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      console.log(`[MbaSync] Sync complete: ${result.foldersProcessed} folders, ${result.documentsProcessed} documents, ${result.pagesCreated} pages created`);

    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
      console.error('[MbaSync] Sync failed:', error);
    }

    return result;
  }

  /**
   * Process a semester folder (e.g., Winter2026)
   */
  private async processSemesterFolder(
    semesterFolder: { id: string; name: string; type: 'DocumentType' | 'CollectionType' },
    parentVaultPageId: string,
    result: SyncResult
  ): Promise<void> {
    console.log(`[MbaSync] Processing semester: ${semesterFolder.name}`);

    // Create Vault page for semester
    const semesterVaultPage = await this.ensureVaultPageExists(
      semesterFolder.name,
      parentVaultPageId,
      '📅',
      semesterFolder.id,
      'folder'
    );
    result.foldersProcessed++;

    // Get class folders
    const classFolders = remarkableCloudSync.getChildren(semesterFolder.id)
      .filter(c => c.type === 'CollectionType');

    console.log(`[MbaSync] Found ${classFolders.length} class folders in ${semesterFolder.name}`);

    for (const classFolder of classFolders) {
      try {
        await this.processClassFolder(classFolder, semesterVaultPage.id, semesterFolder.name, result);
      } catch (error) {
        result.errors.push(`Failed to process class ${classFolder.name}: ${error}`);
      }
    }
  }

  /**
   * Process a class folder (e.g., MGMT501)
   */
  private async processClassFolder(
    classFolder: { id: string; name: string; type: 'DocumentType' | 'CollectionType' },
    parentVaultPageId: string,
    semester: string,
    result: SyncResult
  ): Promise<void> {
    console.log(`[MbaSync] Processing class: ${classFolder.name}`);

    // Create Vault page for class
    const classVaultPage = await this.ensureVaultPageExists(
      classFolder.name,
      parentVaultPageId,
      '📖',
      classFolder.id,
      'folder'
    );
    result.foldersProcessed++;

    // Get all documents in this class folder
    const documents = remarkableCloudSync.getChildren(classFolder.id)
      .filter(c => c.type === 'DocumentType');

    console.log(`[MbaSync] Found ${documents.length} documents in ${classFolder.name}`);

    // Group documents by date
    const groupedByDate = this.groupDocumentsByDate(documents);

    for (const [dateStr, docs] of Array.from(groupedByDate.entries())) {
      try {
        await this.processClassDay(
          classVaultPage.id,
          classFolder.name,
          semester,
          dateStr,
          docs,
          result
        );
      } catch (error) {
        result.errors.push(`Failed to process ${classFolder.name} - ${dateStr}: ${error}`);
      }
    }
  }

  /**
   * Process all documents for a single class day
   */
  private async processClassDay(
    classPageId: string,
    classCode: string,
    semester: string,
    dateStr: string,
    documents: Array<{ id: string; name: string; lastModified: number }>,
    result: SyncResult
  ): Promise<void> {
    console.log(`[MbaSync] Processing ${classCode} - ${dateStr} (${documents.length} documents)`);

    // Check if day page already exists
    const existingSync = await this.findSyncByClassDate(classCode, dateStr);

    // Create or get day page
    const dayPage = await this.ensureDayPageExists(
      dateStr,
      classPageId,
      existingSync?.vaultPageId || null
    );

    // Process each document - download, render PDF, extract OCR
    const processedDocs: ProcessedDocument[] = [];

    for (const doc of documents) {
      try {
        // Check if this specific document needs re-processing
        const docSync = await this.findSyncByRemarkableId(doc.id);
        if (docSync && docSync.remarkableLastModified &&
            Number(docSync.remarkableLastModified) >= doc.lastModified) {
          console.log(`[MbaSync] Skipping ${doc.name} - already synced`);
          continue;
        }

        console.log(`[MbaSync] Rendering ${doc.name}...`);
        const { pdfPath, pdfUrl, ocrText } = await remarkableCloudSync.downloadAndRenderPdf(doc.id);

        processedDocs.push({
          remarkableId: doc.id,
          name: doc.name,
          pdfPath,
          pdfUrl,
          ocrText,
          lastModified: doc.lastModified,
        });

        result.documentsProcessed++;
      } catch (error) {
        result.errors.push(`Failed to process document ${doc.name}: ${error}`);
      }
    }

    if (processedDocs.length === 0) {
      console.log(`[MbaSync] No new documents to process for ${dateStr}`);
      return;
    }

    // Update day page with file blocks for each PDF
    await this.updateDayPageWithPdfs(dayPage.id, processedDocs);

    // Create or update OCR child page
    const combinedOcr = this.formatOcrText(processedDocs);
    if (combinedOcr) {
      const ocrPage = await this.ensureOcrChildPage(dayPage.id, combinedOcr);

      // Update sync records for each document
      for (const doc of processedDocs) {
        await this.upsertSyncRecord({
          remarkableId: doc.remarkableId,
          remarkableType: 'document',
          remarkablePath: `${this.config.rootFolderName}/${semester}/${classCode}`,
          remarkableName: doc.name,
          vaultPageId: dayPage.id,
          semester,
          classCode,
          noteDate: dateStr,
          pdfStoragePath: doc.pdfUrl,
          ocrText: doc.ocrText,
          ocrPageId: ocrPage.id,
          remarkableLastModified: doc.lastModified,
        });
      }
    }

    result.pagesCreated++;
  }

  /**
   * Group documents by date
   */
  private groupDocumentsByDate(
    documents: Array<{ id: string; name: string; lastModified: number }>
  ): Map<string, Array<{ id: string; name: string; lastModified: number }>> {
    const groups = new Map<string, typeof documents>();

    for (const doc of documents) {
      // Try to extract date from document name (e.g., "2026-01-12 Lecture Notes")
      const dateMatch = doc.name.match(/(\d{4}-\d{2}-\d{2})/);
      const dateStr = dateMatch
        ? dateMatch[1]
        : new Date(doc.lastModified).toISOString().split('T')[0];

      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)!.push(doc);
    }

    return groups;
  }

  /**
   * Format OCR text from multiple documents into markdown
   */
  private formatOcrText(docs: ProcessedDocument[]): string {
    if (docs.length === 0) return '';

    const sections = docs
      .filter(d => d.ocrText && d.ocrText.trim())
      .map(d => `## ${d.name}\n\n${d.ocrText}`);

    if (sections.length === 0) return '';

    return sections.join('\n\n---\n\n');
  }

  /**
   * Ensure a Vault page exists, creating if necessary
   */
  private async ensureVaultPageExists(
    title: string,
    parentId: string | null,
    icon: string,
    remarkableId: string,
    remarkableType: 'folder' | 'document'
  ): Promise<{ id: string }> {
    // Check sync table for existing mapping
    const existingSync = await this.findSyncByRemarkableId(remarkableId);
    if (existingSync?.vaultPageId) {
      // Verify the page still exists
      const page = await this.getVaultPage(existingSync.vaultPageId);
      if (page) return { id: existingSync.vaultPageId };
    }

    // Check if a page with this title already exists under the parent
    const existingPage = await this.findVaultPageByTitle(title, parentId);
    if (existingPage) {
      // Update sync record
      await this.upsertSyncRecord({
        remarkableId,
        remarkableType,
        remarkablePath: title,
        remarkableName: title,
        vaultPageId: existingPage.id,
      });
      return existingPage;
    }

    // Create new page
    const newPage = await vaultPageService.create({
      title,
      parentId,
      icon,
    });

    // Create sync record
    await this.upsertSyncRecord({
      remarkableId,
      remarkableType,
      remarkablePath: title,
      remarkableName: title,
      vaultPageId: newPage.id,
    });

    console.log(`[MbaSync] Created Vault page: ${title}`);
    return newPage;
  }

  /**
   * Ensure day page exists
   */
  private async ensureDayPageExists(
    dateStr: string,
    parentId: string,
    existingPageId: string | null
  ): Promise<{ id: string }> {
    if (existingPageId) {
      const page = await this.getVaultPage(existingPageId);
      if (page) return { id: existingPageId };
    }

    // Check if page with this title exists
    const existingPage = await this.findVaultPageByTitle(dateStr, parentId);
    if (existingPage) return existingPage;

    // Create new page
    const newPage = await vaultPageService.create({
      title: dateStr,
      parentId,
      icon: '📝',
    });

    console.log(`[MbaSync] Created day page: ${dateStr}`);
    return newPage;
  }

  /**
   * Ensure OCR child page exists
   */
  private async ensureOcrChildPage(
    parentPageId: string,
    ocrContent: string
  ): Promise<{ id: string }> {
    // Check if OCR page already exists
    const existingPage = await this.findVaultPageByTitle('OCR Text', parentPageId);

    if (existingPage) {
      // Update existing page content - clear old blocks and add new
      await db.delete(vaultBlocks).where(eq(vaultBlocks.pageId, existingPage.id));

      await vaultBlockService.create(existingPage.id, {
        type: 'text',
        content: { text: ocrContent },
      });

      return existingPage;
    }

    // Create new OCR page
    const ocrPage = await vaultPageService.create({
      title: 'OCR Text',
      parentId: parentPageId,
      icon: '📄',
    });

    await vaultBlockService.create(ocrPage.id, {
      type: 'text',
      content: { text: ocrContent },
    });

    console.log(`[MbaSync] Created OCR child page`);
    return ocrPage;
  }

  /**
   * Update day page with PDF file blocks
   */
  private async updateDayPageWithPdfs(
    pageId: string,
    docs: ProcessedDocument[]
  ): Promise<void> {
    for (const doc of docs) {
      try {
        const fileSize = statSync(doc.pdfPath).size;

        await vaultBlockService.create(pageId, {
          type: 'file',
          content: {
            url: doc.pdfUrl,
            filename: `${doc.name}.pdf`,
            mimeType: 'application/pdf',
            size: fileSize,
          },
        });

        console.log(`[MbaSync] Added PDF block for ${doc.name}`);
      } catch (error) {
        console.error(`[MbaSync] Failed to add PDF block for ${doc.name}:`, error);
      }
    }
  }

  // ============================================
  // Database Helpers
  // ============================================

  private async findSyncByRemarkableId(remarkableId: string) {
    const [sync] = await db
      .select()
      .from(remarkableVaultSync)
      .where(eq(remarkableVaultSync.remarkableId, remarkableId))
      .limit(1);
    return sync;
  }

  private async findSyncByClassDate(classCode: string, noteDate: string) {
    const [sync] = await db
      .select()
      .from(remarkableVaultSync)
      .where(
        and(
          eq(remarkableVaultSync.classCode, classCode),
          eq(remarkableVaultSync.noteDate, noteDate)
        )
      )
      .limit(1);
    return sync;
  }

  private async upsertSyncRecord(data: {
    remarkableId: string;
    remarkableType: string;
    remarkablePath?: string;
    remarkableName: string;
    vaultPageId?: string;
    semester?: string;
    classCode?: string;
    noteDate?: string;
    pdfStoragePath?: string;
    ocrText?: string;
    ocrPageId?: string;
    remarkableLastModified?: number;
  }) {
    const existing = await this.findSyncByRemarkableId(data.remarkableId);

    if (existing) {
      await db
        .update(remarkableVaultSync)
        .set({
          remarkablePath: data.remarkablePath,
          remarkableName: data.remarkableName,
          vaultPageId: data.vaultPageId,
          semester: data.semester,
          classCode: data.classCode,
          noteDate: data.noteDate,
          pdfStoragePath: data.pdfStoragePath,
          ocrText: data.ocrText,
          ocrPageId: data.ocrPageId,
          remarkableLastModified: data.remarkableLastModified ? BigInt(data.remarkableLastModified) : null,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date(),
        })
        .where(eq(remarkableVaultSync.id, existing.id));
    } else {
      await db.insert(remarkableVaultSync).values({
        remarkableId: data.remarkableId,
        remarkableType: data.remarkableType,
        remarkablePath: data.remarkablePath,
        remarkableName: data.remarkableName,
        vaultPageId: data.vaultPageId,
        semester: data.semester,
        classCode: data.classCode,
        noteDate: data.noteDate,
        pdfStoragePath: data.pdfStoragePath,
        ocrText: data.ocrText,
        ocrPageId: data.ocrPageId,
        remarkableLastModified: data.remarkableLastModified ? BigInt(data.remarkableLastModified) : null,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      });
    }
  }

  private async findVaultPageByTitle(title: string, parentId: string | null) {
    const condition = parentId
      ? and(eq(vaultPages.title, title), eq(vaultPages.parentId, parentId))
      : and(eq(vaultPages.title, title), eq(vaultPages.parentId, parentId));

    const [page] = await db
      .select()
      .from(vaultPages)
      .where(condition)
      .limit(1);

    return page;
  }

  private async getVaultPage(pageId: string) {
    const [page] = await db
      .select()
      .from(vaultPages)
      .where(eq(vaultPages.id, pageId))
      .limit(1);
    return page;
  }

  // ============================================
  // Status Methods
  // ============================================

  /**
   * Get sync status for MBA folder
   */
  async getStatus(): Promise<{
    configured: boolean;
    mbaFolderFound: boolean;
    folderStructure: ReturnType<typeof remarkableCloudSync.getFolderTree>;
    syncedDocuments: number;
    pendingDocuments: number;
  }> {
    const mbaFolder = remarkableCloudSync.findFolderByName(this.config.rootFolderName);

    const [syncStats] = await db
      .select({
        synced: db.$count(remarkableVaultSync, eq(remarkableVaultSync.syncStatus, 'synced')),
        pending: db.$count(remarkableVaultSync, eq(remarkableVaultSync.syncStatus, 'pending')),
      })
      .from(remarkableVaultSync);

    return {
      configured: remarkableCloudSync.isConfigured(),
      mbaFolderFound: !!mbaFolder,
      folderStructure: mbaFolder ? remarkableCloudSync.getFolderTree(mbaFolder.id) : [],
      syncedDocuments: syncStats?.synced || 0,
      pendingDocuments: syncStats?.pending || 0,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const remarkableMbaSyncService = new RemarkableMbaSyncService();
