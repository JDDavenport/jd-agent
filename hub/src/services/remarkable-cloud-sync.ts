/**
 * Remarkable Cloud Sync Service
 *
 * Monitors Remarkable Cloud for document changes and sends notifications.
 * This enables a hybrid workflow where:
 * 1. Service detects new/updated notes automatically
 * 2. User gets notified and can one-tap export to Google Drive
 * 3. Google Drive sync picks up the exported PDFs
 *
 * Authentication flow:
 * - Device token (long-lived) stored in env or DB
 * - User token (3 hours) refreshed automatically
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================
// Types
// ============================================

interface RemarkableDocument {
  id: string;
  hash: string;
  name: string;
  type: 'DocumentType' | 'CollectionType';
  parent: string | null;
  lastModified: number;
  pageCount?: number;
  version: number;
}

interface SyncState {
  lastSyncAt: string;
  deviceToken: string | null;
  userToken: string | null;
  userTokenExpiresAt: number | null;
  documents: Record<string, {
    hash: string;
    name: string;
    type: 'DocumentType' | 'CollectionType';
    parent: string | null;
    lastModified: number;
    lastNotified: number | null;
    pageCount?: number;
  }>;
}

interface DocumentChange {
  document: RemarkableDocument;
  changeType: 'new' | 'updated';
  previousModified?: number;
}

interface SyncResult {
  success: boolean;
  documentsFound: number;
  changes: DocumentChange[];
  errors: string[];
}

// ============================================
// Constants
// ============================================

const REMARKABLE_AUTH_URL = 'https://webapp-prod.cloud.remarkable.engineering';
const REMARKABLE_SYNC_URL = 'https://eu.tectonic.remarkable.com';
const STATE_FILE = '.remarkable-cloud-state.json';
const USER_TOKEN_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

// ============================================
// State Management
// ============================================

function getStatePath(): string {
  const syncPath = process.env.REMARKABLE_SYNC_PATH || '/tmp';
  return join(syncPath, STATE_FILE);
}

function loadState(): SyncState {
  try {
    const statePath = getStatePath();
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {
    console.log('[RemarkableCloud] Could not load state, starting fresh');
  }
  return {
    lastSyncAt: new Date(0).toISOString(),
    deviceToken: null,
    userToken: null,
    userTokenExpiresAt: null,
    documents: {},
  };
}

function saveState(state: SyncState): void {
  try {
    const statePath = getStatePath();
    const dir = statePath.substring(0, statePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[RemarkableCloud] Could not save state:', e);
  }
}

// ============================================
// Remarkable Cloud Sync Service
// ============================================

export class RemarkableCloudSync {
  private state: SyncState;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    this.state = loadState();

    // Check for device token in env if not in state
    const envDeviceToken = process.env.REMARKABLE_DEVICE_TOKEN;
    if (envDeviceToken && !this.state.deviceToken) {
      this.state.deviceToken = envDeviceToken;
      saveState(this.state);
    }

    if (this.state.deviceToken) {
      console.log('[RemarkableCloud] Initialized with device token');
    } else {
      console.log('[RemarkableCloud] Not configured - missing device token');
    }
  }

  // ============================================
  // Configuration
  // ============================================

  isConfigured(): boolean {
    return !!this.state.deviceToken;
  }

  getStatus(): {
    configured: boolean;
    polling: boolean;
    lastSync: string | null;
    documentCount: number;
    hasValidUserToken: boolean;
  } {
    return {
      configured: this.isConfigured(),
      polling: this.isPolling,
      lastSync: this.state.lastSyncAt !== new Date(0).toISOString()
        ? this.state.lastSyncAt
        : null,
      documentCount: Object.keys(this.state.documents).length,
      hasValidUserToken: this.hasValidUserToken(),
    };
  }

  /**
   * Set the device token (obtained from Remarkable authentication)
   */
  setDeviceToken(token: string): void {
    this.state.deviceToken = token;
    this.state.userToken = null;
    this.state.userTokenExpiresAt = null;
    saveState(this.state);
    console.log('[RemarkableCloud] Device token set');
  }

  // ============================================
  // Authentication
  // ============================================

  private hasValidUserToken(): boolean {
    if (!this.state.userToken || !this.state.userTokenExpiresAt) {
      return false;
    }
    return Date.now() < (this.state.userTokenExpiresAt - USER_TOKEN_BUFFER_MS);
  }

  private async refreshUserToken(): Promise<boolean> {
    if (!this.state.deviceToken) {
      console.error('[RemarkableCloud] No device token available');
      return false;
    }

    try {
      const response = await fetch(
        `${REMARKABLE_AUTH_URL}/token/json/2/user/new`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.state.deviceToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('[RemarkableCloud] Failed to refresh user token:', response.status);
        return false;
      }

      const token = await response.text();

      // Decode JWT to get expiration - validate structure first
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error('[RemarkableCloud] Invalid JWT structure');
        return false;
      }
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString()
      );

      this.state.userToken = token;
      this.state.userTokenExpiresAt = payload.exp * 1000; // Convert to ms
      saveState(this.state);

      console.log('[RemarkableCloud] User token refreshed, expires:', new Date(this.state.userTokenExpiresAt).toISOString());
      return true;
    } catch (error) {
      console.error('[RemarkableCloud] Error refreshing user token:', error);
      return false;
    }
  }

  private async ensureAuthenticated(): Promise<boolean> {
    if (this.hasValidUserToken()) {
      return true;
    }
    return this.refreshUserToken();
  }

  // ============================================
  // Document Listing
  // ============================================

  /**
   * List all documents from Remarkable Cloud
   */
  async listDocuments(): Promise<RemarkableDocument[]> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    const documents: RemarkableDocument[] = [];

    try {
      // Get root hash
      const rootResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/root`,
        {
          headers: {
            'Authorization': `Bearer ${this.state.userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!rootResponse.ok) {
        throw new Error(`Failed to get root: ${rootResponse.status}`);
      }

      const rootData = await rootResponse.json();
      const rootHash = rootData.hash;

      // Get root index
      const indexResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/files/${rootHash}`,
        {
          headers: {
            'Authorization': `Bearer ${this.state.userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!indexResponse.ok) {
        throw new Error(`Failed to get root index: ${indexResponse.status}`);
      }

      const indexText = await indexResponse.text();
      const lines = indexText.split('\n').filter(l => l.trim());

      // Parse each document entry
      for (const line of lines.slice(1)) { // Skip header line
        const parts = line.split(':');
        if (parts.length < 5) continue;

        const [hash, type, id, version, size] = parts;

        // Get document metadata
        try {
          const doc = await this.getDocumentMetadata(hash, id, parseInt(version), parseInt(size));
          if (doc) {
            documents.push(doc);
          }
        } catch (e) {
          // Skip documents we can't read
        }

        // Rate limiting
        await this.sleep(50);
      }

      return documents;
    } catch (error) {
      console.error('[RemarkableCloud] Error listing documents:', error);
      throw error;
    }
  }

  private async getDocumentMetadata(
    hash: string,
    id: string,
    version: number,
    size: number
  ): Promise<RemarkableDocument | null> {
    try {
      // Get document's file index
      const indexResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/files/${hash}`,
        {
          headers: {
            'Authorization': `Bearer ${this.state.userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!indexResponse.ok) return null;

      const indexText = await indexResponse.text();
      const lines = indexText.split('\n');

      // Find metadata file hash
      const metadataLine = lines.find(l => l.includes('.metadata:'));
      if (!metadataLine) return null;

      const metadataHash = metadataLine.split(':')[0];

      // Fetch metadata
      const metadataResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/files/${metadataHash}`,
        {
          headers: {
            'Authorization': `Bearer ${this.state.userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!metadataResponse.ok) return null;

      const metadata = await metadataResponse.json();

      // Count .rm files for page count
      const pageCount = lines.filter(l => l.endsWith('.rm:0')).length ||
                        lines.filter(l => l.includes('.rm:')).length;

      return {
        id,
        hash,
        name: metadata.visibleName || 'Untitled',
        type: metadata.type || 'DocumentType',
        parent: metadata.parent || null,
        lastModified: parseInt(metadata.lastModified || '0'),
        pageCount,
        version,
      };
    } catch (error) {
      return null;
    }
  }

  // ============================================
  // Sync & Change Detection
  // ============================================

  /**
   * Sync with Remarkable Cloud and detect changes
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      documentsFound: 0,
      changes: [],
      errors: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Not configured - missing device token');
      return result;
    }

    console.log('[RemarkableCloud] Starting sync...');

    try {
      const documents = await this.listDocuments();
      result.documentsFound = documents.length;

      // Detect changes
      for (const doc of documents) {
        const existing = this.state.documents[doc.id];

        if (!existing) {
          // New document
          result.changes.push({
            document: doc,
            changeType: 'new',
          });
        } else if (doc.lastModified > existing.lastModified) {
          // Updated document
          result.changes.push({
            document: doc,
            changeType: 'updated',
            previousModified: existing.lastModified,
          });
        }

        // Update state with full metadata
        this.state.documents[doc.id] = {
          hash: doc.hash,
          name: doc.name,
          type: doc.type,
          parent: doc.parent,
          lastModified: doc.lastModified,
          lastNotified: existing?.lastNotified || null,
          pageCount: doc.pageCount,
        };
      }

      // Update sync time
      this.state.lastSyncAt = new Date().toISOString();
      saveState(this.state);

      result.success = true;
      console.log(`[RemarkableCloud] Sync complete: ${documents.length} documents, ${result.changes.length} changes`);

    } catch (error) {
      result.errors.push(String(error));
      console.error('[RemarkableCloud] Sync failed:', error);
    }

    return result;
  }

  /**
   * Get documents that have changes but haven't been notified yet
   */
  getPendingNotifications(): DocumentChange[] {
    const changes: DocumentChange[] = [];

    for (const [id, data] of Object.entries(this.state.documents)) {
      // If never notified or modified after last notification
      if (!data.lastNotified || data.lastModified > data.lastNotified) {
        changes.push({
          document: {
            id,
            hash: data.hash,
            name: data.name,
            type: 'DocumentType',
            parent: null,
            lastModified: data.lastModified,
            version: 0,
          },
          changeType: data.lastNotified ? 'updated' : 'new',
        });
      }
    }

    return changes;
  }

  /**
   * Mark documents as notified
   */
  markNotified(documentIds: string[]): void {
    const now = Date.now();
    for (const id of documentIds) {
      if (this.state.documents[id]) {
        this.state.documents[id].lastNotified = now;
      }
    }
    saveState(this.state);
  }

  // ============================================
  // Polling
  // ============================================

  /**
   * Start automatic polling
   */
  startPolling(intervalMinutes: number = 30): boolean {
    if (!this.isConfigured()) {
      console.log('[RemarkableCloud] Cannot start polling - not configured');
      return false;
    }

    if (this.isPolling) {
      console.log('[RemarkableCloud] Already polling');
      return true;
    }

    console.log(`[RemarkableCloud] Starting polling every ${intervalMinutes} minutes`);

    // Run initial sync
    this.sync().catch(e => console.error('[RemarkableCloud] Initial sync failed:', e));

    // Set up interval
    this.pollTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        console.error('[RemarkableCloud] Polling sync failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    this.isPolling = true;
    return true;
  }

  /**
   * Stop automatic polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    console.log('[RemarkableCloud] Stopped polling');
  }

  // ============================================
  // Document Download & PDF Rendering
  // ============================================

  /**
   * Download a complete document bundle to a local directory
   * Returns the path to the document directory
   */
  async downloadDocument(documentId: string): Promise<string> {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    const docData = this.state.documents[documentId];
    if (!docData) {
      throw new Error(`Document ${documentId} not found in state`);
    }

    console.log(`[RemarkableCloud] Downloading document: ${docData.name}`);

    // Create temp directory for this document
    const tempDir = join('/tmp', 'remarkable-downloads', documentId);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    try {
      // Get document's file index
      const indexResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/files/${docData.hash}`,
        {
          headers: {
            'Authorization': `Bearer ${this.state.userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!indexResponse.ok) {
        throw new Error(`Failed to get document index: ${indexResponse.status}`);
      }

      const indexText = await indexResponse.text();
      const lines = indexText.split('\n').filter(l => l.trim());

      // Download each file in the bundle
      let downloadedFiles = 0;
      for (const line of lines.slice(1)) { // Skip header line
        const parts = line.split(':');
        if (parts.length < 3) continue;

        const [fileHash, , filename] = parts;
        if (!filename) continue;

        try {
          const fileResponse = await fetch(
            `${REMARKABLE_SYNC_URL}/sync/v3/files/${fileHash}`,
            {
              headers: {
                'Authorization': `Bearer ${this.state.userToken}`,
                'rm-source': 'RoR-Browser',
              },
            }
          );

          if (fileResponse.ok) {
            const content = await fileResponse.arrayBuffer();
            const filePath = join(tempDir, filename);

            // Create subdirectories if needed (e.g., for uuid/0.rm files)
            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (fileDir !== tempDir && !existsSync(fileDir)) {
              mkdirSync(fileDir, { recursive: true });
            }

            writeFileSync(filePath, Buffer.from(content));
            downloadedFiles++;
          }
        } catch (e) {
          // Continue with other files
        }

        // Rate limiting
        await this.sleep(30);
      }

      console.log(`[RemarkableCloud] Downloaded ${downloadedFiles} files to ${tempDir}`);
      return tempDir;
    } catch (error) {
      console.error('[RemarkableCloud] Download failed:', error);
      throw error;
    }
  }

  /**
   * Render a downloaded document to PDF using rmc (v6) + cairosvg pipeline
   * rmc converts .rm files to SVG, cairosvg converts SVG to PDF
   * Returns the path to the generated PDF
   */
  async renderToPdf(documentPath: string, outputPath?: string): Promise<string> {
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');

    const pdfPath = outputPath || join(documentPath, 'output.pdf');
    // Use environment variable for rmc path, with fallback to common locations
    const rmcPath = process.env.RMC_BIN_PATH || '/usr/local/bin/rmc';

    // Try to get page order from .content file
    let pageOrder: string[] = [];
    const contentFiles = fs.readdirSync(documentPath).filter((f: string) => f.endsWith('.content'));
    if (contentFiles.length > 0) {
      try {
        const contentPath = path.join(documentPath, contentFiles[0]);
        const contentData = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
        if (contentData.cPages?.pages) {
          pageOrder = contentData.cPages.pages.map((p: { id: string }) => p.id);
          console.log(`[RemarkableCloud] Found ${pageOrder.length} pages in content file`);
        }
      } catch (e) {
        console.log(`[RemarkableCloud] Could not parse content file: ${e}`);
      }
    }

    // Find all .rm files in the document directory
    const findRmFiles = (dir: string): string[] => {
      const results: string[] = [];
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...findRmFiles(fullPath));
        } else if (item.endsWith('.rm')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const rmFiles = findRmFiles(documentPath);
    if (rmFiles.length === 0) {
      throw new Error('No .rm files found in document directory');
    }

    console.log(`[RemarkableCloud] Found ${rmFiles.length} .rm files`);

    // Sort .rm files by page order if available
    let sortedRmFiles = rmFiles;
    if (pageOrder.length > 0) {
      sortedRmFiles = pageOrder
        .map((pageId) => rmFiles.find((f) => f.includes(pageId)))
        .filter((f): f is string => f !== undefined);
      // Add any files not in pageOrder at the end
      const remaining = rmFiles.filter((f) => !sortedRmFiles.includes(f));
      sortedRmFiles = [...sortedRmFiles, ...remaining];
    }

    console.log(`[RemarkableCloud] Processing ${sortedRmFiles.length} pages in order`);

    // Process each page
    const pagePdfs: string[] = [];
    let successCount = 0;

    for (let i = 0; i < sortedRmFiles.length; i++) {
      const rmFile = sortedRmFiles[i];
      const pageNum = i + 1;
      const svgPath = join(documentPath, `page_${pageNum}.svg`);
      const pagePdfPath = join(documentPath, `page_${pageNum}.pdf`);

      try {
        const { execFileSync } = await import('child_process');

        // Step 1: Use rmc to convert .rm to SVG
        console.log(`[RemarkableCloud] Converting page ${pageNum}/${sortedRmFiles.length}...`);
        execFileSync(rmcPath, [rmFile, '-o', svgPath], {
          cwd: documentPath,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (!fs.existsSync(svgPath)) {
          console.log(`[RemarkableCloud] Page ${pageNum} produced no SVG output (may be empty)`);
          continue;
        }

        // Step 2: Use cairosvg to convert SVG to PDF (using execFileSync with args to avoid injection)
        execFileSync('python3', ['-c', `import cairosvg; import sys; cairosvg.svg2pdf(url=sys.argv[1], write_to=sys.argv[2])`, svgPath, pagePdfPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (fs.existsSync(pagePdfPath)) {
          pagePdfs.push(pagePdfPath);
          successCount++;
        }

        // Clean up SVG
        if (fs.existsSync(svgPath)) {
          fs.unlinkSync(svgPath);
        }
      } catch (error) {
        console.log(`[RemarkableCloud] Page ${pageNum} failed: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other pages
      }
    }

    if (pagePdfs.length === 0) {
      throw new Error('No pages could be converted to PDF');
    }

    console.log(`[RemarkableCloud] Successfully converted ${successCount}/${sortedRmFiles.length} pages`);

    // Combine all page PDFs into one
    if (pagePdfs.length === 1) {
      // Just rename the single page PDF
      fs.renameSync(pagePdfs[0], pdfPath);
    } else {
      const { execFileSync } = await import('child_process');

      // Use pdfunite to combine PDFs (using execFileSync with args array to avoid injection)
      console.log(`[RemarkableCloud] Combining ${pagePdfs.length} pages into single PDF`);
      try {
        execFileSync('pdfunite', [...pagePdfs, pdfPath], { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        // Fallback: use Python's PyPDF2 with safe argument passing
        console.log(`[RemarkableCloud] pdfunite failed, trying PyPDF2...`);
        const pyScript = `
import sys
from PyPDF2 import PdfMerger
merger = PdfMerger()
for pdf in sys.argv[1:-1]:
    merger.append(pdf)
merger.write(sys.argv[-1])
merger.close()
`;
        const scriptPath = join(documentPath, 'merge_pdfs.py');
        fs.writeFileSync(scriptPath, pyScript);
        // Use execFileSync with args array to avoid command injection
        execFileSync('python3', [scriptPath, ...pagePdfs, pdfPath], { stdio: ['pipe', 'pipe', 'pipe'] });
        fs.unlinkSync(scriptPath);
      }

      // Clean up individual page PDFs
      for (const pagePdf of pagePdfs) {
        if (fs.existsSync(pagePdf)) {
          fs.unlinkSync(pagePdf);
        }
      }
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF combining failed');
    }

    const pdfStats = fs.statSync(pdfPath);
    console.log(`[RemarkableCloud] PDF rendered: ${pdfPath} (${pdfStats.size} bytes, ${pagePdfs.length} pages)`);

    return pdfPath;
  }

  /**
   * Extract text from PDF using Apple Vision OCR (macOS)
   * Falls back to Tesseract if Vision fails
   * Returns extracted text or empty string if OCR fails
   */
  async extractTextFromPdf(pdfPath: string): Promise<string> {
    const { execFileSync } = await import('child_process');
    const fs = await import('fs');

    try {
      console.log(`[RemarkableCloud] Running Apple Vision OCR on ${pdfPath}`);

      // Swift code for Apple Vision OCR
      const swiftCode = `
import Vision
import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count > 1 else { exit(1) }

let imagePath = args[1]
guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    exit(1)
}

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

do {
    try requestHandler.perform([request])
    guard let observations = request.results else { exit(0) }
    for observation in observations {
        if let topCandidate = observation.topCandidates(1).first {
            print(topCandidate.string)
        }
    }
} catch { exit(1) }
`;

      // Write Swift code to temp file
      const swiftPath = '/tmp/remarkable_ocr_vision.swift';
      fs.writeFileSync(swiftPath, swiftCode);

      // Python script that takes PDF path as command-line argument (safe from injection)
      const ocrScript = `
import subprocess
from pdf2image import convert_from_path
import os
import sys

pdf_path = sys.argv[1]
images = convert_from_path(pdf_path, dpi=200)
all_text = []

for i, image in enumerate(images):
    img_path = f'/tmp/remarkable_ocr_page_{i}.png'
    image.save(img_path, 'PNG')

    try:
        result = subprocess.run(
            ['swift', '/tmp/remarkable_ocr_vision.swift', img_path],
            capture_output=True, text=True, timeout=60
        )
        if result.stdout.strip():
            if len(images) > 1:
                all_text.append(f"--- Page {i + 1} ---")
            all_text.append(result.stdout.strip())
    except Exception as e:
        pass
    finally:
        if os.path.exists(img_path):
            os.remove(img_path)

print('\\n'.join(all_text))
`;

      // Write Python script to temp file and execute with safe argument passing
      const ocrScriptPath = '/tmp/remarkable_ocr_script.py';
      fs.writeFileSync(ocrScriptPath, ocrScript);

      const result = execFileSync('python3', [ocrScriptPath, pdfPath], {
        encoding: 'utf-8',
        timeout: 180000, // 3 minute timeout for OCR
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large documents
      });

      const extractedText = result.trim();
      console.log(`[RemarkableCloud] Apple Vision OCR extracted ${extractedText.length} characters`);
      return extractedText;
    } catch (error) {
      console.error('[RemarkableCloud] Apple Vision OCR failed, trying Tesseract fallback:', error);

      // Fallback to Tesseract - using safe argument passing
      try {
        const { execFileSync } = await import('child_process');
        const fs = await import('fs');

        const fallbackScript = `
import sys
from pdf2image import convert_from_path
import pytesseract

pdf_path = sys.argv[1]
images = convert_from_path(pdf_path, dpi=150)
all_text = []
for i, image in enumerate(images):
    text = pytesseract.image_to_string(image)
    if text.strip():
        all_text.append(text.strip())
print('\\n'.join(all_text))
`;
        const fallbackScriptPath = '/tmp/remarkable_ocr_tesseract.py';
        fs.writeFileSync(fallbackScriptPath, fallbackScript);

        const fallbackResult = execFileSync('python3', [fallbackScriptPath, pdfPath], {
          encoding: 'utf-8',
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });
        console.log(`[RemarkableCloud] Tesseract fallback extracted ${fallbackResult.trim().length} characters`);
        return fallbackResult.trim();
      } catch {
        return ''; // Return empty string on complete failure
      }
    }
  }

  /**
   * Download a document, render it to PDF, extract text via OCR, and save to permanent storage
   * Returns both the local file path and the API URL for serving
   */
  async downloadAndRenderPdf(documentId: string): Promise<{
    pdfPath: string;
    pdfUrl: string;
    documentName: string;
    ocrText: string;
  }> {
    const docData = this.state.documents[documentId];
    if (!docData) {
      throw new Error(`Document ${documentId} not found`);
    }

    const documentPath = await this.downloadDocument(documentId);
    const tempPdfPath = await this.renderToPdf(documentPath);

    // Extract text via OCR
    const ocrText = await this.extractTextFromPdf(tempPdfPath);

    // Copy PDF to permanent storage
    const fs = await import('fs');
    const path = await import('path');

    // Create safe filename from document name
    const safeName = docData.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const pdfFilename = `${safeName}_${documentId}.pdf`;
    const storagePath = path.join(process.cwd(), 'storage', 'remarkable', pdfFilename);

    // Ensure storage directory exists
    const storageDir = path.dirname(storagePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Copy file to permanent storage
    fs.copyFileSync(tempPdfPath, storagePath);
    console.log(`[RemarkableCloud] Saved PDF to storage: ${storagePath}`);

    // Build the API URL for serving
    const pdfUrl = `/api/vault/files/remarkable/${pdfFilename}`;

    return {
      pdfPath: storagePath,
      pdfUrl,
      documentName: docData.name,
      ocrText,
    };
  }

  // ============================================
  // Utilities
  // ============================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): RemarkableDocument | null {
    const data = this.state.documents[id];
    if (!data) return null;

    return {
      id,
      hash: data.hash,
      name: data.name,
      type: data.type || 'DocumentType',
      parent: data.parent || null,
      lastModified: data.lastModified,
      pageCount: data.pageCount,
      version: 0,
    };
  }

  /**
   * Get all tracked documents
   */
  getAllDocuments(): RemarkableDocument[] {
    return Object.entries(this.state.documents).map(([id, data]) => ({
      id,
      hash: data.hash,
      name: data.name,
      type: data.type || 'DocumentType',
      parent: data.parent || null,
      lastModified: data.lastModified,
      pageCount: data.pageCount,
      version: 0,
    }));
  }

  /**
   * Get all folders (CollectionType documents)
   */
  getFolders(): RemarkableDocument[] {
    return this.getAllDocuments().filter(doc => doc.type === 'CollectionType');
  }

  /**
   * Get documents (not folders) - actual notebooks/PDFs
   */
  getNotebooks(): RemarkableDocument[] {
    return this.getAllDocuments().filter(doc => doc.type === 'DocumentType');
  }

  /**
   * Find a folder by name (case-insensitive)
   */
  findFolderByName(name: string): RemarkableDocument | null {
    const normalizedName = name.toLowerCase();
    return this.getFolders().find(f => f.name.toLowerCase() === normalizedName) || null;
  }

  /**
   * Get direct children of a folder (or root if parentId is null)
   */
  getChildren(parentId: string | null): RemarkableDocument[] {
    return this.getAllDocuments().filter(doc => doc.parent === parentId);
  }

  /**
   * Get folder tree starting from a specific folder
   */
  getFolderTree(rootFolderId?: string): {
    id: string;
    name: string;
    type: 'DocumentType' | 'CollectionType';
    children: RemarkableDocument[];
    subfolders: ReturnType<typeof this.getFolderTree>[];
  }[] {
    const children = this.getChildren(rootFolderId || null);
    const folders = children.filter(c => c.type === 'CollectionType');
    const documents = children.filter(c => c.type === 'DocumentType');

    return folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: folder.type,
      children: this.getChildren(folder.id).filter(c => c.type === 'DocumentType'),
      subfolders: this.getFolderTree(folder.id),
    }));
  }

  /**
   * Find folder by path (e.g., ['BYU MBA', 'Winter2026', 'MGMT501'])
   */
  findFolderByPath(pathParts: string[]): RemarkableDocument | null {
    let currentParentId: string | null = null;

    for (const part of pathParts) {
      const normalizedPart = part.toLowerCase();
      const folder = this.getChildren(currentParentId).find(
        c => c.type === 'CollectionType' && c.name.toLowerCase() === normalizedPart
      );
      if (!folder) return null;
      currentParentId = folder.id;
    }

    // Return the final folder
    if (!currentParentId) return null;
    return this.getDocument(currentParentId);
  }

  /**
   * Get full path of a document/folder as array
   */
  getDocumentPath(docId: string): string[] {
    const path: string[] = [];
    let currentDoc = this.getDocument(docId);

    while (currentDoc) {
      path.unshift(currentDoc.name);
      if (!currentDoc.parent) break;
      currentDoc = this.getDocument(currentDoc.parent);
    }

    return path;
  }

  /**
   * Clear all tracked documents (force fresh sync)
   */
  clearState(): void {
    this.state.documents = {};
    this.state.lastSyncAt = new Date(0).toISOString();
    saveState(this.state);
    console.log('[RemarkableCloud] State cleared');
  }
}

// ============================================
// Singleton Instance
// ============================================

export const remarkableCloudSync = new RemarkableCloudSync();
