/**
 * Canvas Materials Service
 *
 * Canvas Complete Phase 2: Downloads and manages course materials
 * - Downloads files from Canvas (PDFs, slides, documents)
 * - Organizes by course and material type
 * - Creates Vault entries for searchability
 * - Tracks reading progress
 */

import { db } from '../db/client';
import { canvasMaterials, classes, vaultPages, canvasItems } from '../db/schema';
import { eq, and, inArray, isNull, desc, asc } from 'drizzle-orm';
import { CanvasIntegration } from '../integrations/canvas';
import * as path from 'path';
import * as fs from 'fs/promises';

// Storage base path for Canvas materials
const STORAGE_BASE = path.join(process.cwd(), 'storage', 'canvas');

// Supported file types for download
const DOWNLOADABLE_TYPES = ['pdf', 'pptx', 'ppt', 'docx', 'doc', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'];

// Material type detection keywords
const MATERIAL_TYPE_KEYWORDS: Record<string, string[]> = {
  syllabus: ['syllabus', 'course outline', 'course overview'],
  case: ['case', 'case study', 'harvard', 'hbr', 'business case'],
  reading: ['reading', 'article', 'chapter', 'paper', 'journal'],
  lecture: ['lecture', 'slide', 'presentation', 'ppt', 'class notes'],
  template: ['template', 'worksheet', 'form', 'rubric'],
  data: ['data', 'dataset', 'excel', 'spreadsheet', 'csv'],
};

export interface CanvasMaterial {
  id: string;
  canvasItemId: string | null;
  canvasFileId: string | null;
  courseId: string;
  fileName: string;
  displayName: string | null;
  fileType: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  localPath: string | null;
  downloadUrl: string | null;
  canvasUrl: string | null;
  moduleName: string | null;
  modulePosition: number | null;
  materialType: string | null;
  pageCount: number | null;
  extractedText: string | null;
  aiSummary: string | null;
  vaultPageId: string | null;
  readStatus: string;
  readProgress: number;
  lastReadAt: Date | null;
  relatedAssignmentIds: string[] | null;
  downloadedAt: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMaterialInput {
  canvasItemId?: string;
  canvasFileId?: string;
  courseId: string;
  fileName: string;
  displayName?: string;
  fileType: string;
  mimeType?: string;
  fileSizeBytes?: number;
  localPath?: string;
  downloadUrl?: string;
  canvasUrl?: string;
  moduleName?: string;
  modulePosition?: number;
  materialType?: string;
  relatedAssignmentIds?: string[];
}

export interface MaterialsFilter {
  courseId?: string;
  fileType?: string;
  materialType?: string;
  readStatus?: 'unread' | 'in_progress' | 'completed';
  hasVaultPage?: boolean;
}

export interface ReadingProgress {
  readStatus: 'unread' | 'in_progress' | 'completed';
  readProgress: number; // 0-100
}

class CanvasMaterialsService {
  private canvas: CanvasIntegration;

  constructor() {
    this.canvas = new CanvasIntegration();
  }

  /**
   * Ensure storage directory exists for a course
   */
  private async ensureStorageDir(courseCode: string): Promise<string> {
    const coursePath = path.join(STORAGE_BASE, this.sanitizeFilename(courseCode));
    await fs.mkdir(coursePath, { recursive: true });
    return coursePath;
  }

  /**
   * Sanitize filename for filesystem
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9-_. ]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 100);
  }

  /**
   * Get file extension from filename or content type
   */
  private getFileType(filename: string, contentType?: string): string {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    if (ext) return ext;

    // Fallback to content type
    if (contentType) {
      if (contentType.includes('pdf')) return 'pdf';
      if (contentType.includes('powerpoint') || contentType.includes('presentation')) return 'pptx';
      if (contentType.includes('word') || contentType.includes('document')) return 'docx';
      if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'xlsx';
    }

    return 'unknown';
  }

  /**
   * Detect material type from filename and context
   */
  private detectMaterialType(filename: string, moduleName?: string): string | null {
    const lowerName = (filename + ' ' + (moduleName || '')).toLowerCase();

    for (const [type, keywords] of Object.entries(MATERIAL_TYPE_KEYWORDS)) {
      if (keywords.some((kw) => lowerName.includes(kw))) {
        return type;
      }
    }

    return null;
  }

  /**
   * Download a file from Canvas
   */
  async downloadFile(
    canvasFileId: number,
    courseCode: string,
    filename: string
  ): Promise<{ localPath: string; fileSizeBytes: number } | null> {
    try {
      const downloadUrl = await this.canvas.getFileDownloadUrl(canvasFileId);
      if (!downloadUrl) return null;

      const storagePath = await this.ensureStorageDir(courseCode);
      const sanitizedName = this.sanitizeFilename(filename);
      const localPath = path.join(storagePath, sanitizedName);

      // Download the file
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.error(`Failed to download file: ${response.statusText}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(localPath, Buffer.from(buffer));

      return {
        localPath,
        fileSizeBytes: buffer.byteLength,
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }

  /**
   * Create a new material record
   */
  async createMaterial(input: CreateMaterialInput): Promise<CanvasMaterial> {
    const [material] = await db
      .insert(canvasMaterials)
      .values({
        canvasItemId: input.canvasItemId,
        canvasFileId: input.canvasFileId,
        courseId: input.courseId,
        fileName: input.fileName,
        displayName: input.displayName,
        fileType: input.fileType,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        localPath: input.localPath,
        downloadUrl: input.downloadUrl,
        canvasUrl: input.canvasUrl,
        moduleName: input.moduleName,
        modulePosition: input.modulePosition,
        materialType: input.materialType || this.detectMaterialType(input.fileName, input.moduleName),
        relatedAssignmentIds: input.relatedAssignmentIds,
        lastSyncedAt: new Date(),
      })
      .returning();

    return material as CanvasMaterial;
  }

  /**
   * Get material by ID
   */
  async getMaterial(id: string): Promise<CanvasMaterial | null> {
    const [material] = await db.select().from(canvasMaterials).where(eq(canvasMaterials.id, id));

    return (material as CanvasMaterial) || null;
  }

  /**
   * Get material by Canvas file ID
   */
  async getMaterialByCanvasFileId(canvasFileId: string): Promise<CanvasMaterial | null> {
    const [material] = await db
      .select()
      .from(canvasMaterials)
      .where(eq(canvasMaterials.canvasFileId, canvasFileId));

    return (material as CanvasMaterial) || null;
  }

  /**
   * List materials with filters
   */
  async listMaterials(filter?: MaterialsFilter): Promise<CanvasMaterial[]> {
    const conditions = [];

    if (filter?.courseId) {
      conditions.push(eq(canvasMaterials.courseId, filter.courseId));
    }
    if (filter?.fileType) {
      conditions.push(eq(canvasMaterials.fileType, filter.fileType));
    }
    if (filter?.materialType) {
      conditions.push(eq(canvasMaterials.materialType, filter.materialType));
    }
    if (filter?.readStatus) {
      conditions.push(eq(canvasMaterials.readStatus, filter.readStatus));
    }
    if (filter?.hasVaultPage !== undefined) {
      if (filter.hasVaultPage) {
        conditions.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (canvasMaterials.vaultPageId as any).isNotNull()
        );
      } else {
        conditions.push(isNull(canvasMaterials.vaultPageId));
      }
    }

    const query =
      conditions.length > 0
        ? db.select().from(canvasMaterials).where(and(...conditions))
        : db.select().from(canvasMaterials);

    const materials = await query.orderBy(asc(canvasMaterials.moduleName), asc(canvasMaterials.modulePosition));

    return materials as CanvasMaterial[];
  }

  /**
   * Get materials for a course grouped by module
   */
  async getMaterialsByCourse(courseId: string): Promise<Record<string, CanvasMaterial[]>> {
    const materials = await db
      .select()
      .from(canvasMaterials)
      .where(eq(canvasMaterials.courseId, courseId))
      .orderBy(asc(canvasMaterials.moduleName), asc(canvasMaterials.modulePosition));

    // Group by module
    const grouped: Record<string, CanvasMaterial[]> = {};
    for (const material of materials as CanvasMaterial[]) {
      const moduleName = material.moduleName || 'Other';
      if (!grouped[moduleName]) {
        grouped[moduleName] = [];
      }
      grouped[moduleName].push(material);
    }

    return grouped;
  }

  /**
   * Get materials related to an assignment
   */
  async getMaterialsForAssignment(canvasItemId: string): Promise<CanvasMaterial[]> {
    // Get materials where this assignment is in relatedAssignmentIds
    // Or where canvasItemId matches directly
    const materials = await db
      .select()
      .from(canvasMaterials)
      .where(eq(canvasMaterials.canvasItemId, canvasItemId));

    // Also find materials that reference this assignment
    const allMaterials = await db.select().from(canvasMaterials);
    const relatedMaterials = allMaterials.filter(
      (m) =>
        m.relatedAssignmentIds?.includes(canvasItemId) ||
        m.canvasItemId === canvasItemId
    );

    return relatedMaterials as CanvasMaterial[];
  }

  /**
   * Update reading progress for a material
   */
  async updateReadingProgress(id: string, progress: ReadingProgress): Promise<CanvasMaterial | null> {
    const [updated] = await db
      .update(canvasMaterials)
      .set({
        readStatus: progress.readStatus,
        readProgress: progress.readProgress,
        lastReadAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canvasMaterials.id, id))
      .returning();

    return (updated as CanvasMaterial) || null;
  }

  /**
   * Link material to a Vault page
   */
  async linkToVaultPage(materialId: string, vaultPageId: string): Promise<CanvasMaterial | null> {
    const [updated] = await db
      .update(canvasMaterials)
      .set({
        vaultPageId,
        updatedAt: new Date(),
      })
      .where(eq(canvasMaterials.id, materialId))
      .returning();

    return (updated as CanvasMaterial) || null;
  }

  /**
   * Mark material as downloaded
   */
  async markDownloaded(id: string, localPath: string, fileSizeBytes?: number): Promise<CanvasMaterial | null> {
    const [updated] = await db
      .update(canvasMaterials)
      .set({
        localPath,
        fileSizeBytes,
        downloadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canvasMaterials.id, id))
      .returning();

    return (updated as CanvasMaterial) || null;
  }

  /**
   * Store extracted text for search
   */
  async setExtractedText(id: string, extractedText: string, pageCount?: number): Promise<void> {
    await db
      .update(canvasMaterials)
      .set({
        extractedText,
        pageCount,
        updatedAt: new Date(),
      })
      .where(eq(canvasMaterials.id, id));
  }

  /**
   * Set AI-generated summary
   */
  async setAiSummary(id: string, summary: string): Promise<void> {
    await db
      .update(canvasMaterials)
      .set({
        aiSummary: summary,
        updatedAt: new Date(),
      })
      .where(eq(canvasMaterials.id, id));
  }

  /**
   * Sync files for a course from Canvas
   */
  async syncCourseFiles(canvasCourseId: number, courseId: string, courseCode: string): Promise<number> {
    let filesAdded = 0;

    try {
      const files = await this.canvas.getFiles(canvasCourseId);

      for (const file of files) {
        // Skip if already exists
        const existing = await this.getMaterialByCanvasFileId(String(file.id));
        if (existing) continue;

        const fileType = this.getFileType(file.filename, file.content_type);
        if (!DOWNLOADABLE_TYPES.includes(fileType)) continue;

        // Create material record
        const material = await this.createMaterial({
          canvasFileId: String(file.id),
          courseId,
          fileName: file.filename,
          displayName: file.display_name,
          fileType,
          mimeType: file.content_type,
          fileSizeBytes: file.size,
          downloadUrl: file.url,
        });

        // Download the file
        const downloaded = await this.downloadFile(file.id, courseCode, file.filename);
        if (downloaded) {
          await this.markDownloaded(material.id, downloaded.localPath, downloaded.fileSizeBytes);
        }

        filesAdded++;
      }

      return filesAdded;
    } catch (error) {
      console.error(`Error syncing files for course ${canvasCourseId}:`, error);
      return filesAdded;
    }
  }

  /**
   * Sync module files for a course (more context about where files belong)
   */
  async syncCourseModules(canvasCourseId: number, courseId: string, courseCode: string): Promise<number> {
    let filesAdded = 0;

    try {
      const modules = await this.canvas.getModules(canvasCourseId);

      for (const module of modules) {
        const items = await this.canvas.getModuleItems(canvasCourseId, module.id);

        for (const item of items) {
          if (item.type !== 'File' || !item.content_id) continue;

          // Skip if already exists
          const existing = await this.getMaterialByCanvasFileId(String(item.content_id));
          if (existing) {
            // Update module info if missing
            if (!existing.moduleName) {
              await db
                .update(canvasMaterials)
                .set({
                  moduleName: module.name,
                  modulePosition: module.position,
                  updatedAt: new Date(),
                })
                .where(eq(canvasMaterials.id, existing.id));
            }
            continue;
          }

          // Get file details
          const downloadUrl = await this.canvas.getFileDownloadUrl(item.content_id);

          // Create material record with module context
          const material = await this.createMaterial({
            canvasFileId: String(item.content_id),
            courseId,
            fileName: item.title,
            displayName: item.title,
            fileType: this.getFileType(item.title),
            canvasUrl: item.html_url,
            downloadUrl: downloadUrl || undefined,
            moduleName: module.name,
            modulePosition: module.position,
          });

          // Download the file
          if (item.content_id && downloadUrl) {
            const downloaded = await this.downloadFile(item.content_id, courseCode, item.title);
            if (downloaded) {
              await this.markDownloaded(material.id, downloaded.localPath, downloaded.fileSizeBytes);
            }
          }

          filesAdded++;
        }
      }

      return filesAdded;
    } catch (error) {
      console.error(`Error syncing modules for course ${canvasCourseId}:`, error);
      return filesAdded;
    }
  }

  /**
   * Get reading list (materials marked as readings)
   */
  async getReadingList(courseId?: string): Promise<CanvasMaterial[]> {
    const conditions = [eq(canvasMaterials.materialType, 'reading')];

    if (courseId) {
      conditions.push(eq(canvasMaterials.courseId, courseId));
    }

    const readings = await db
      .select()
      .from(canvasMaterials)
      .where(and(...conditions))
      .orderBy(desc(canvasMaterials.createdAt));

    return readings as CanvasMaterial[];
  }

  /**
   * Get unread materials count per course
   */
  async getUnreadCounts(): Promise<Record<string, number>> {
    const unreadMaterials = await db
      .select({
        courseId: canvasMaterials.courseId,
      })
      .from(canvasMaterials)
      .where(eq(canvasMaterials.readStatus, 'unread'));

    const counts: Record<string, number> = {};
    for (const m of unreadMaterials) {
      counts[m.courseId] = (counts[m.courseId] || 0) + 1;
    }

    return counts;
  }

  /**
   * Delete a material and its local file
   */
  async deleteMaterial(id: string): Promise<void> {
    const material = await this.getMaterial(id);
    if (!material) return;

    // Delete local file if exists
    if (material.localPath) {
      try {
        await fs.unlink(material.localPath);
      } catch {
        // Ignore if file doesn't exist
      }
    }

    await db.delete(canvasMaterials).where(eq(canvasMaterials.id, id));
  }

  /**
   * Get file path for serving
   */
  getFilePath(material: CanvasMaterial): string | null {
    return material.localPath;
  }

  /**
   * Create a Vault page for a material
   * This makes the material searchable and accessible in Vault
   */
  async createVaultPageForMaterial(materialId: string, parentPageId?: string): Promise<string | null> {
    const material = await this.getMaterial(materialId);
    if (!material) return null;

    // Get course info for context
    const [course] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, material.courseId));

    // Create a title based on material info
    const title = material.displayName || material.fileName;
    const icon = this.getMaterialIcon(material.fileType);

    // Create the vault page
    const [page] = await db
      .insert(vaultPages)
      .values({
        title,
        icon,
        parentId: parentPageId || null,
        paraType: 'resources', // Course materials are resources
      })
      .returning();

    if (!page) return null;

    // Link the material to the vault page
    await this.linkToVaultPage(materialId, page.id);

    // Create initial content blocks for the page
    // This would include metadata about the material
    // For now, we'll just create the page - blocks can be added via the Vault editor

    return page.id;
  }

  /**
   * Get material icon based on file type
   */
  private getMaterialIcon(fileType: string): string {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'pptx':
      case 'ppt':
        return '📊';
      case 'docx':
      case 'doc':
        return '📝';
      case 'xlsx':
      case 'xls':
        return '📈';
      case 'url':
        return '🔗';
      default:
        return '📎';
    }
  }

  /**
   * Bulk create Vault pages for all materials in a course
   */
  async createVaultPagesForCourse(courseId: string, parentPageId?: string): Promise<number> {
    const materials = await this.listMaterials({ courseId });
    let created = 0;

    for (const material of materials) {
      if (!material.vaultPageId) {
        const pageId = await this.createVaultPageForMaterial(material.id, parentPageId);
        if (pageId) created++;
      }
    }

    return created;
  }

  /**
   * Get or create a course materials folder in Vault
   */
  async getOrCreateCourseMaterialsFolder(courseId: string, courseName: string): Promise<string> {
    // First try to find existing folder
    const [existingFolder] = await db
      .select()
      .from(vaultPages)
      .where(
        and(
          eq(vaultPages.title, `${courseName} Materials`),
          eq(vaultPages.paraType, 'resources')
        )
      );

    if (existingFolder) {
      return existingFolder.id;
    }

    // Create new folder
    const [newFolder] = await db
      .insert(vaultPages)
      .values({
        title: `${courseName} Materials`,
        icon: '📚',
        paraType: 'resources',
      })
      .returning();

    return newFolder.id;
  }
}

export const canvasMaterialsService = new CanvasMaterialsService();
