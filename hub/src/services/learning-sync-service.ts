/**
 * Learning Sync Service
 *
 * Unified orchestrator for all learning material sources:
 * - Plaud voice recordings
 * - Remarkable handwritten notes
 * - Canvas materials
 *
 * Handles sync → classification → Vault page creation pipeline
 */

import { vaultPageService, PARA_FOLDERS } from './vault-page-service';
import { vaultBlockService } from './vault-block-service';
import { plaudSyncService } from './plaud-sync-service';
import { remarkableCloudSync } from './remarkable-cloud-sync';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ============================================
// Types
// ============================================

interface SyncResult {
  source: 'plaud' | 'remarkable' | 'canvas';
  success: boolean;
  itemsProcessed: number;
  vaultPagesCreated: number;
  errors: string[];
  timestamp: string;
}

interface ClassDayPage {
  date: string;
  courseCode: string;
  courseName: string;
  vaultPageId: string;
}

interface SyncState {
  lastFullSync: string;
  lastPlaudSync: string;
  lastRemarkableSync: string;
  processedRecordings: Record<string, {
    syncedAt: string;
    vaultPageId?: string;
    classified: boolean;
    courseCode?: string;
  }>;
  processedNotes: Record<string, {
    syncedAt: string;
    vaultPageId?: string;
    classified: boolean;
    courseCode?: string;
  }>;
}

// ============================================
// Constants
// ============================================

const PLAUD_SYNC_PATH = process.env.PLAUD_SYNC_PATH || '/Users/jddavenport/Documents/PlaudSync';
const STATE_PATH = join(PLAUD_SYNC_PATH, '.learning-sync-state.json');

// MBA course mappings (Winter 2026)
const MBA_COURSES: Record<string, { code: string; name: string; canvasId?: string }> = {
  'business analytics': { code: 'MBA560', name: 'Business Analytics' },
  'analytics': { code: 'MBA560', name: 'Business Analytics' },
  'mba 560': { code: 'MBA560', name: 'Business Analytics' },
  'entrepreneurial innovation': { code: 'ENTINN', name: 'Entrepreneurial Innovation' },
  'innovation': { code: 'ENTINN', name: 'Entrepreneurial Innovation' },
  'business strategy': { code: 'MBA580', name: 'Business Strategy' },
  'strategy': { code: 'MBA580', name: 'Business Strategy' },
  'mba 580': { code: 'MBA580', name: 'Business Strategy' },
  'porter': { code: 'MBA580', name: 'Business Strategy' },
  'five forces': { code: 'MBA580', name: 'Business Strategy' },
  'career strategy': { code: 'MBA693R', name: 'Post-MBA Career Strategy' },
  'post-mba': { code: 'MBA693R', name: 'Post-MBA Career Strategy' },
  'mba 693': { code: 'MBA693R', name: 'Post-MBA Career Strategy' },
  'entrepreneurship through acquisition': { code: 'MBA677R', name: 'Entrepreneurship Through Acquisition' },
  'eta': { code: 'MBA677R', name: 'Entrepreneurship Through Acquisition' },
  'mba 677': { code: 'MBA677R', name: 'Entrepreneurship Through Acquisition' },
  'acquisition': { code: 'MBA677R', name: 'Entrepreneurship Through Acquisition' },
  'venture capital': { code: 'MBA664', name: 'Venture Capital/Private Equity' },
  'private equity': { code: 'MBA664', name: 'Venture Capital/Private Equity' },
  'vc/pe': { code: 'MBA664', name: 'Venture Capital/Private Equity' },
  'mba 664': { code: 'MBA664', name: 'Venture Capital/Private Equity' },
  'client acquisition': { code: 'MBA654', name: 'Strategic Client Acquisition/Retention' },
  'client retention': { code: 'MBA654', name: 'Strategic Client Acquisition/Retention' },
  'mba 654': { code: 'MBA654', name: 'Strategic Client Acquisition/Retention' },
};

// ============================================
// State Management
// ============================================

function loadState(): SyncState {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[LearningSync] Error loading state:', e);
  }
  return {
    lastFullSync: '',
    lastPlaudSync: '',
    lastRemarkableSync: '',
    processedRecordings: {},
    processedNotes: {},
  };
}

function saveState(state: SyncState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ============================================
// Learning Sync Service
// ============================================

export class LearningSyncService {
  private state: SyncState;

  constructor() {
    this.state = loadState();
  }

  // ============================================
  // Vault Structure Management
  // ============================================

  /**
   * Ensure the MBA project structure exists in Vault
   * Creates: Projects > MBA Winter 2026 > [Course folders]
   */
  async ensureMBAStructure(): Promise<{ projectId: string; coursePages: Record<string, string> }> {
    // Find or create Projects PARA folder
    let projectsFolder = await vaultPageService.findByTitleAndParent('Projects', null);
    if (!projectsFolder) {
      projectsFolder = await vaultPageService.create({
        title: 'Projects',
        icon: '📁',
      });
    }

    // Find or create MBA Winter 2026 project
    let mbaProject = await vaultPageService.findByTitleAndParent('MBA Winter 2026', projectsFolder.id);
    if (!mbaProject) {
      mbaProject = await vaultPageService.create({
        title: 'MBA Winter 2026',
        icon: '🎓',
        parentId: projectsFolder.id,
      });
    }

    // Create course pages
    const coursePages: Record<string, string> = {};
    const uniqueCourses = new Map<string, { code: string; name: string }>();

    for (const course of Object.values(MBA_COURSES)) {
      uniqueCourses.set(course.code, course);
    }

    for (const course of Array.from(uniqueCourses.values())) {
      let coursePage = await vaultPageService.findByTitleAndParent(
        `${course.code} - ${course.name}`,
        mbaProject.id
      );
      if (!coursePage) {
        coursePage = await vaultPageService.create({
          title: `${course.code} - ${course.name}`,
          icon: '📚',
          parentId: mbaProject.id,
        });
      }
      coursePages[course.code] = coursePage.id;
    }

    return { projectId: mbaProject.id, coursePages };
  }

  /**
   * Get or create a class day page
   * Structure: Course Page > Class Days > YYYY-MM-DD
   */
  async getOrCreateClassDayPage(
    coursePageId: string,
    date: string,
    courseCode: string,
    courseName: string
  ): Promise<string> {
    // Find or create Class Days folder under course
    let classDaysFolder = await vaultPageService.findByTitleAndParent('Class Days', coursePageId);
    if (!classDaysFolder) {
      classDaysFolder = await vaultPageService.create({
        title: 'Class Days',
        icon: '📅',
        parentId: coursePageId,
      });
    }

    // Find or create date page
    const dateTitle = date; // YYYY-MM-DD format
    let datePage = await vaultPageService.findByTitleAndParent(dateTitle, classDaysFolder.id);
    if (!datePage) {
      datePage = await vaultPageService.create({
        title: dateTitle,
        icon: '📝',
        parentId: classDaysFolder.id,
      });

      // Add header block
      await vaultBlockService.create(datePage.id, {
        type: 'heading',
        content: { text: `${courseName} - ${date}`, level: 1 },
        sortOrder: 0,
      });
    }

    return datePage.id;
  }

  // ============================================
  // Classification
  // ============================================

  /**
   * Classify content to determine which course it belongs to
   */
  classifyContent(text: string, filename?: string): { courseCode: string; courseName: string } | null {
    const searchText = `${filename || ''} ${text}`.toLowerCase();

    // Check each keyword mapping
    for (const [keyword, course] of Object.entries(MBA_COURSES)) {
      if (searchText.includes(keyword)) {
        return { courseCode: course.code, courseName: course.name };
      }
    }

    // Try to detect class context even without specific keywords
    const classIndicators = ['professor', 'lecture', 'class', 'assignment', 'exam', 'quiz'];
    const hasClassContext = classIndicators.some((ind) => searchText.includes(ind));

    if (hasClassContext) {
      // Return null but flag as class content (needs manual classification)
      return null;
    }

    return null;
  }

  // ============================================
  // Plaud Sync
  // ============================================

  /**
   * Sync Plaud recordings and create Vault pages
   */
  async syncPlaud(): Promise<SyncResult> {
    const result: SyncResult = {
      source: 'plaud',
      success: false,
      itemsProcessed: 0,
      vaultPagesCreated: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Check session health
      if (!plaudSyncService.hasSession()) {
        result.errors.push('No Plaud session. Run plaud-login.ts first.');
        return result;
      }

      // Run Plaud sync
      console.log('[LearningSync] Starting Plaud sync...');
      const syncResult = await plaudSyncService.sync();

      if (!syncResult.success) {
        result.errors.push(...syncResult.errors);
        return result;
      }

      // Process synced recordings
      console.log('[LearningSync] Processing synced recordings...');
      const { coursePages } = await this.ensureMBAStructure();

      // Read PlaudSync directory for recordings
      if (!existsSync(PLAUD_SYNC_PATH)) {
        result.errors.push(`Plaud sync path not found: ${PLAUD_SYNC_PATH}`);
        return result;
      }

      const dirs = readdirSync(PLAUD_SYNC_PATH, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name);

      for (const dir of dirs) {
        const recordingPath = join(PLAUD_SYNC_PATH, dir);
        const metadataPath = join(recordingPath, 'metadata.json');
        const transcriptPath = join(recordingPath, 'transcript.txt');

        if (!existsSync(metadataPath)) continue;

        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        const recordingId = metadata.id;

        // Skip if already processed
        if (this.state.processedRecordings[recordingId]?.vaultPageId) {
          continue;
        }

        result.itemsProcessed++;

        // Read transcript
        let transcript = '';
        if (existsSync(transcriptPath)) {
          transcript = readFileSync(transcriptPath, 'utf-8');
        } else {
          // Try JSON transcript
          const jsonTranscriptPath = join(recordingPath, 'transcript.json');
          if (existsSync(jsonTranscriptPath)) {
            try {
              const jsonTranscript = JSON.parse(readFileSync(jsonTranscriptPath, 'utf-8'));
              if (Array.isArray(jsonTranscript)) {
                transcript = jsonTranscript
                  .map((s: { speaker?: string; content: string }) => `[${s.speaker || 'Speaker'}]: ${s.content}`)
                  .join('\n\n');
              }
            } catch {}
          }
        }

        // Classify the recording
        const classification = this.classifyContent(transcript, metadata.filename);

        if (classification) {
          const coursePageId = coursePages[classification.courseCode];
          if (coursePageId) {
            // Extract date from metadata
            const date = metadata.startTime
              ? new Date(metadata.startTime).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0];

            // Get or create class day page
            const classDayPageId = await this.getOrCreateClassDayPage(
              coursePageId,
              date,
              classification.courseCode,
              classification.courseName
            );

            // Add transcript block
            const blockContent = `## 🎙️ Recording: ${metadata.filename}\n\n**Duration:** ${metadata.durationMinutes || Math.round(metadata.duration / 60000)} minutes\n\n### Transcript\n\n${transcript || '*No transcript available*'}`;

            await vaultBlockService.create(classDayPageId, {
              type: 'text',
              content: { text: blockContent },
              sortOrder: Date.now(), // Use timestamp for ordering
            });

            result.vaultPagesCreated++;

            // Update state
            this.state.processedRecordings[recordingId] = {
              syncedAt: new Date().toISOString(),
              vaultPageId: classDayPageId,
              classified: true,
              courseCode: classification.courseCode,
            };
          }
        } else {
          // Mark as processed but not classified
          this.state.processedRecordings[recordingId] = {
            syncedAt: new Date().toISOString(),
            classified: false,
          };
        }
      }

      this.state.lastPlaudSync = new Date().toISOString();
      saveState(this.state);

      result.success = true;
      console.log(`[LearningSync] Plaud sync complete. Processed: ${result.itemsProcessed}, Pages created: ${result.vaultPagesCreated}`);
    } catch (error) {
      result.errors.push(String(error));
      console.error('[LearningSync] Plaud sync failed:', error);
    }

    return result;
  }

  // ============================================
  // Remarkable Sync
  // ============================================

  /**
   * Sync Remarkable notes and create Vault pages
   */
  async syncRemarkable(): Promise<SyncResult> {
    const result: SyncResult = {
      source: 'remarkable',
      success: false,
      itemsProcessed: 0,
      vaultPagesCreated: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Check if configured
      if (!remarkableCloudSync.isConfigured()) {
        result.errors.push('Remarkable not configured. Set REMARKABLE_DEVICE_TOKEN.');
        return result;
      }

      console.log('[LearningSync] Starting Remarkable sync...');

      // Sync with Remarkable Cloud
      const syncResult = await remarkableCloudSync.sync();

      if (!syncResult.success) {
        result.errors.push(...syncResult.errors);
        return result;
      }

      console.log(`[LearningSync] Found ${syncResult.documentsFound} documents, ${syncResult.changes.length} changes`);

      // Process changed documents
      const { coursePages } = await this.ensureMBAStructure();

      for (const change of syncResult.changes) {
        const doc = change.document;

        // Skip folders
        if (doc.type === 'CollectionType') continue;

        // Skip if already processed (check by hash for updates)
        const existing = this.state.processedNotes[doc.id];
        if (existing?.syncedAt && change.changeType !== 'updated') {
          continue;
        }

        result.itemsProcessed++;

        try {
          // Download and render PDF
          console.log(`[LearningSync] Processing: ${doc.name}`);
          const rendered = await remarkableCloudSync.downloadAndRenderPdf(doc.id);

          // Classify based on document name and OCR text
          const classification = this.classifyContent(rendered.ocrText, doc.name);

          if (classification) {
            const coursePageId = coursePages[classification.courseCode];
            if (coursePageId) {
              // Extract date from modification time or use today
              const date = new Date(doc.lastModified).toISOString().split('T')[0];

              // Get or create class day page
              const classDayPageId = await this.getOrCreateClassDayPage(
                coursePageId,
                date,
                classification.courseCode,
                classification.courseName
              );

              // Add note block with PDF link and OCR text
              const blockContent = `## ✍️ Handwritten Notes: ${doc.name}\n\n**PDF:** [View Notes](${rendered.pdfUrl})\n\n### OCR Text\n\n${rendered.ocrText || '*OCR text not available*'}`;

              await vaultBlockService.create(classDayPageId, {
                type: 'text',
                content: { text: blockContent },
                sortOrder: Date.now(),
              });

              result.vaultPagesCreated++;

              // Update state
              this.state.processedNotes[doc.id] = {
                syncedAt: new Date().toISOString(),
                vaultPageId: classDayPageId,
                classified: true,
                courseCode: classification.courseCode,
              };
            }
          } else {
            // Store but don't create page (unclassified)
            this.state.processedNotes[doc.id] = {
              syncedAt: new Date().toISOString(),
              classified: false,
            };
          }
        } catch (docError) {
          console.error(`[LearningSync] Error processing ${doc.name}:`, docError);
          result.errors.push(`${doc.name}: ${String(docError)}`);
        }
      }

      this.state.lastRemarkableSync = new Date().toISOString();
      saveState(this.state);

      result.success = true;
      console.log(`[LearningSync] Remarkable sync complete. Processed: ${result.itemsProcessed}, Pages created: ${result.vaultPagesCreated}`);
    } catch (error) {
      result.errors.push(String(error));
      console.error('[LearningSync] Remarkable sync failed:', error);
    }

    return result;
  }

  // ============================================
  // Full Sync
  // ============================================

  /**
   * Run full sync of all sources
   */
  async syncAll(): Promise<{ plaud: SyncResult; remarkable: SyncResult }> {
    console.log('[LearningSync] Starting full sync...');

    const plaudResult = await this.syncPlaud();
    const remarkableResult = await this.syncRemarkable();

    this.state.lastFullSync = new Date().toISOString();
    saveState(this.state);

    return { plaud: plaudResult, remarkable: remarkableResult };
  }

  // ============================================
  // Status & Utils
  // ============================================

  /**
   * Get sync status
   */
  getStatus(): {
    lastFullSync: string;
    lastPlaudSync: string;
    lastRemarkableSync: string;
    plaudConfigured: boolean;
    remarkableConfigured: boolean;
    processedRecordings: number;
    processedNotes: number;
    classifiedRecordings: number;
    classifiedNotes: number;
  } {
    const classifiedRecordings = Object.values(this.state.processedRecordings).filter((r) => r.classified).length;
    const classifiedNotes = Object.values(this.state.processedNotes).filter((n) => n.classified).length;

    return {
      lastFullSync: this.state.lastFullSync || 'Never',
      lastPlaudSync: this.state.lastPlaudSync || 'Never',
      lastRemarkableSync: this.state.lastRemarkableSync || 'Never',
      plaudConfigured: plaudSyncService.hasSession(),
      remarkableConfigured: remarkableCloudSync.isConfigured(),
      processedRecordings: Object.keys(this.state.processedRecordings).length,
      processedNotes: Object.keys(this.state.processedNotes).length,
      classifiedRecordings,
      classifiedNotes,
    };
  }

  /**
   * Get unclassified items that need manual classification
   */
  getUnclassified(): {
    recordings: Array<{ id: string; path: string; syncedAt: string }>;
    notes: Array<{ id: string; name: string; syncedAt: string }>;
  } {
    const recordings: Array<{ id: string; path: string; syncedAt: string }> = [];
    const notes: Array<{ id: string; name: string; syncedAt: string }> = [];

    for (const [id, data] of Object.entries(this.state.processedRecordings)) {
      if (!data.classified) {
        recordings.push({ id, path: id, syncedAt: data.syncedAt });
      }
    }

    for (const [id, data] of Object.entries(this.state.processedNotes)) {
      if (!data.classified) {
        const doc = remarkableCloudSync.getDocument(id);
        notes.push({ id, name: doc?.name || id, syncedAt: data.syncedAt });
      }
    }

    return { recordings, notes };
  }

  /**
   * Manually classify an item
   */
  async classifyItem(
    type: 'recording' | 'note',
    id: string,
    courseCode: string
  ): Promise<boolean> {
    const course = Object.values(MBA_COURSES).find((c) => c.code === courseCode);
    if (!course) {
      console.error(`[LearningSync] Unknown course code: ${courseCode}`);
      return false;
    }

    const { coursePages } = await this.ensureMBAStructure();
    const coursePageId = coursePages[courseCode];
    if (!coursePageId) {
      console.error(`[LearningSync] Course page not found for: ${courseCode}`);
      return false;
    }

    if (type === 'recording') {
      const recordingData = this.state.processedRecordings[id];
      if (!recordingData) {
        console.error(`[LearningSync] Recording not found: ${id}`);
        return false;
      }

      // Find the recording directory
      const dirs = readdirSync(PLAUD_SYNC_PATH, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.includes(id.slice(0, 8)))
        .map((d) => d.name);

      if (dirs.length === 0) {
        console.error(`[LearningSync] Recording directory not found for: ${id}`);
        return false;
      }

      const recordingPath = join(PLAUD_SYNC_PATH, dirs[0]);
      const metadataPath = join(recordingPath, 'metadata.json');
      const transcriptPath = join(recordingPath, 'transcript.txt');

      if (!existsSync(metadataPath)) {
        console.error(`[LearningSync] Metadata not found: ${metadataPath}`);
        return false;
      }

      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      let transcript = '';
      if (existsSync(transcriptPath)) {
        transcript = readFileSync(transcriptPath, 'utf-8');
      }

      const date = metadata.startTime
        ? new Date(metadata.startTime).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const classDayPageId = await this.getOrCreateClassDayPage(
        coursePageId,
        date,
        course.code,
        course.name
      );

      const blockContent = `## 🎙️ Recording: ${metadata.filename}\n\n**Duration:** ${metadata.durationMinutes || Math.round(metadata.duration / 60000)} minutes\n\n### Transcript\n\n${transcript || '*No transcript available*'}`;

      await vaultBlockService.create(classDayPageId, {
        type: 'text',
        content: { text: blockContent },
        sortOrder: Date.now(),
      });

      this.state.processedRecordings[id] = {
        ...recordingData,
        vaultPageId: classDayPageId,
        classified: true,
        courseCode: course.code,
      };
      saveState(this.state);

      return true;
    } else {
      // Note classification
      const noteData = this.state.processedNotes[id];
      if (!noteData) {
        console.error(`[LearningSync] Note not found: ${id}`);
        return false;
      }

      const doc = remarkableCloudSync.getDocument(id);
      if (!doc) {
        console.error(`[LearningSync] Document not found: ${id}`);
        return false;
      }

      const rendered = await remarkableCloudSync.downloadAndRenderPdf(id);
      const date = new Date(doc.lastModified).toISOString().split('T')[0];

      const classDayPageId = await this.getOrCreateClassDayPage(
        coursePageId,
        date,
        course.code,
        course.name
      );

      const blockContent = `## ✍️ Handwritten Notes: ${doc.name}\n\n**PDF:** [View Notes](${rendered.pdfUrl})\n\n### OCR Text\n\n${rendered.ocrText || '*OCR text not available*'}`;

      await vaultBlockService.create(classDayPageId, {
        type: 'text',
        content: { text: blockContent },
        sortOrder: Date.now(),
      });

      this.state.processedNotes[id] = {
        ...noteData,
        vaultPageId: classDayPageId,
        classified: true,
        courseCode: course.code,
      };
      saveState(this.state);

      return true;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

export const learningSyncService = new LearningSyncService();

// ============================================
// CLI Runner
// ============================================

if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  const service = new LearningSyncService();

  switch (command) {
    case 'status':
      console.log('=== Learning Sync Status ===\n');
      console.log(JSON.stringify(service.getStatus(), null, 2));
      break;

    case 'plaud':
      service.syncPlaud().then((result) => {
        console.log('\n=== Plaud Sync Result ===');
        console.log(JSON.stringify(result, null, 2));
      });
      break;

    case 'remarkable':
      service.syncRemarkable().then((result) => {
        console.log('\n=== Remarkable Sync Result ===');
        console.log(JSON.stringify(result, null, 2));
      });
      break;

    case 'all':
      service.syncAll().then((results) => {
        console.log('\n=== Full Sync Results ===');
        console.log(JSON.stringify(results, null, 2));
      });
      break;

    case 'unclassified':
      console.log('=== Unclassified Items ===\n');
      console.log(JSON.stringify(service.getUnclassified(), null, 2));
      break;

    case 'structure':
      service.ensureMBAStructure().then((structure) => {
        console.log('=== MBA Vault Structure ===\n');
        console.log(JSON.stringify(structure, null, 2));
      });
      break;

    default:
      console.log(`
Learning Sync CLI

Usage: bun run src/services/learning-sync-service.ts <command>

Commands:
  status      Show sync status
  plaud       Sync Plaud recordings
  remarkable  Sync Remarkable notes
  all         Sync all sources
  unclassified  List items needing manual classification
  structure   Ensure MBA Vault structure exists
`);
  }
}
