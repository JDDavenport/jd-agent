/**
 * Apple Notes Integration - Extract notes (macOS only)
 *
 * Provides:
 * - Full note extraction via AppleScript
 * - Folder hierarchy tracking
 * - HTML to Markdown conversion
 * - Attachment detection
 *
 * Note: Requires macOS and accessibility permissions
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { RawEntry } from '../types';
import { contentParser } from '../lib/content-parser';

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

export interface AppleNotesConfig {
  method?: 'applescript' | 'sqlite'; // Extraction method
  includeFolders?: string[]; // Only extract from these folders
  excludeFolders?: string[]; // Skip these folders
}

interface AppleNoteRaw {
  id: string;
  title: string;
  body: string;
  folder: string;
  created: string;
  modified: string;
}

// ============================================
// Apple Notes Extractor
// ============================================

export class AppleNotesExtractor {
  private config: AppleNotesConfig;

  constructor(config: AppleNotesConfig = {}) {
    this.config = {
      method: 'applescript',
      ...config,
    };

    // Check if running on macOS
    if (process.platform !== 'darwin') {
      throw new Error('Apple Notes extraction only works on macOS');
    }
  }

  /**
   * Extract all notes
   */
  async *extractAll(): AsyncGenerator<RawEntry> {
    console.log('Starting Apple Notes extraction...');

    try {
      const notes = await this.getAllNotes();
      console.log(`Found ${notes.length} Apple Notes`);

      for (const note of notes) {
        // Filter by folder if configured
        if (this.config.includeFolders && this.config.includeFolders.length > 0) {
          if (!this.config.includeFolders.includes(note.folder)) {
            continue;
          }
        }

        if (this.config.excludeFolders?.includes(note.folder)) {
          continue;
        }

        try {
          const entry = this.convertToEntry(note);
          if (entry) {
            yield entry;
          }
        } catch (error) {
          console.error(`Error processing note ${note.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in Apple Notes extraction:', error);
      throw error;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get all notes using AppleScript
   */
  private async getAllNotes(): Promise<AppleNoteRaw[]> {
    if (this.config.method === 'applescript') {
      return this.extractViaAppleScript();
    } else {
      throw new Error('SQLite extraction not yet implemented. Use applescript method.');
    }
  }

  /**
   * Extract notes via AppleScript
   */
  private async extractViaAppleScript(): Promise<AppleNoteRaw[]> {
    // Note: No indentation inside the script - AppleScript is whitespace-sensitive
    const script = `tell application "Notes"
set allNotes to every note
set output to ""

repeat with aNote in allNotes
try
set noteId to id of aNote
set noteTitle to name of aNote

set noteBody to ""
try
set noteBody to body of aNote
end try

set noteFolder to "Notes"
try
set noteFolder to name of container of aNote
end try

set noteCreated to creation date of aNote as string
set noteModified to modification date of aNote as string

set output to output & "---NOTE_START---" & return
set output to output & "ID:" & noteId & return
set output to output & "TITLE:" & noteTitle & return
set output to output & "FOLDER:" & noteFolder & return
set output to output & "CREATED:" & noteCreated & return
set output to output & "MODIFIED:" & noteModified & return
set output to output & "BODY_START" & return
set output to output & noteBody & return
set output to output & "BODY_END" & return
set output to output & "---NOTE_END---" & return
on error errMsg
end try
end repeat

return output
end tell`;

    try {
      console.log('Running AppleScript to extract notes...');

      // Write script to temp file to avoid shell escaping issues
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const tmpFile = path.join(os.tmpdir(), `apple-notes-extract-${Date.now()}.scpt`);
      fs.writeFileSync(tmpFile, script);
      console.log(`Wrote AppleScript to ${tmpFile}`);

      try {
        const { stdout, stderr } = await execAsync(`osascript "${tmpFile}"`, {
          maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large notes
          timeout: 600000, // 10 minute timeout for 900+ notes
        });

        if (stderr) {
          console.log('AppleScript stderr:', stderr);
        }
        console.log(`AppleScript output length: ${stdout.length} chars`);

        return this.parseAppleScriptOutput(stdout);
      } finally {
        // Clean up temp file
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error: any) {
      console.error('AppleScript error:', error.message);
      if (error.message.includes('is not allowed')) {
        throw new Error(
          'Permission denied. Please grant Terminal/iTerm/your app access to Notes in System Preferences > Privacy & Security > Automation'
        );
      }
      throw error;
    }
  }

  /**
   * Parse AppleScript output into note objects
   */
  private parseAppleScriptOutput(output: string): AppleNoteRaw[] {
    const notes: AppleNoteRaw[] = [];

    // AppleScript uses \r for return, normalize to \n
    const normalizedOutput = output.replace(/\r/g, '\n');
    const noteBlocks = normalizedOutput.split('---NOTE_START---').filter(block => block.includes('---NOTE_END---'));

    console.log(`Parsing ${noteBlocks.length} note blocks`);

    for (const block of noteBlocks) {
      try {
        const lines = block.split('\n');
        let id = '';
        let title = '';
        let folder = '';
        let created = '';
        let modified = '';
        let bodyLines: string[] = [];
        let inBody = false;

        for (const line of lines) {
          if (line.startsWith('ID:')) {
            id = line.substring(3).trim();
          } else if (line.startsWith('TITLE:')) {
            title = line.substring(6).trim();
          } else if (line.startsWith('FOLDER:')) {
            folder = line.substring(7).trim();
          } else if (line.startsWith('CREATED:')) {
            created = line.substring(8).trim();
          } else if (line.startsWith('MODIFIED:')) {
            modified = line.substring(9).trim();
          } else if (line === 'BODY_START') {
            inBody = true;
          } else if (line === 'BODY_END') {
            inBody = false;
          } else if (inBody) {
            bodyLines.push(line);
          }
        }

        if (id && title) {
          notes.push({
            id,
            title,
            body: bodyLines.join('\n'),
            folder,
            created,
            modified,
          });
        }
      } catch (error) {
        console.error('Error parsing note block:', error);
      }
    }

    return notes;
  }

  /**
   * Convert raw note to RawEntry
   */
  private convertToEntry(note: AppleNoteRaw): RawEntry {
    // Convert HTML body to Markdown
    const content = contentParser.htmlToMarkdown(note.body);

    return {
      title: note.title || 'Untitled',
      content,
      source: 'apple_notes',
      sourceId: note.id,
      sourcePath: note.folder || 'Notes',
      createdAt: this.parseAppleDate(note.created),
      modifiedAt: this.parseAppleDate(note.modified),
      rawMetadata: {
        folder: note.folder,
        rawBody: note.body,
      },
    };
  }

  /**
   * Parse Apple date format to JavaScript Date
   */
  private parseAppleDate(dateString: string): Date {
    try {
      // Apple dates are in format like: "Monday, January 6, 2026 at 11:30:00 AM"
      // Try parsing it directly
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch {
      // Ignore
    }

    // Fallback to current date if parsing fails
    return new Date();
  }

  /**
   * Check if Apple Notes is accessible
   */
  async checkAccess(): Promise<boolean> {
    try {
      const script = `
        tell application "Notes"
          return count of notes
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);
      return true;
    } catch (error: any) {
      if (error.message.includes('is not allowed')) {
        console.error('❌ No access to Apple Notes');
        console.error('Please grant access in System Preferences > Privacy & Security > Automation');
        return false;
      }
      throw error;
    }
  }

  /**
   * Get folder list
   */
  async getFolders(): Promise<string[]> {
    const script = `
      tell application "Notes"
        set folderList to {}
        repeat with aFolder in every folder
          set end of folderList to name of aFolder
        end repeat
        return folderList
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return stdout.trim().split(', ');
    } catch (error) {
      console.error('Error getting folders:', error);
      return [];
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createAppleNotesExtractor(config?: AppleNotesConfig): AppleNotesExtractor {
  return new AppleNotesExtractor(config);
}

// ============================================
// Utility: Quick test
// ============================================

/**
 * Test Apple Notes access and extraction
 */
export async function testAppleNotesAccess(): Promise<void> {
  try {
    const extractor = createAppleNotesExtractor();

    console.log('Testing Apple Notes access...');
    const hasAccess = await extractor.checkAccess();

    if (!hasAccess) {
      console.error('❌ Cannot access Apple Notes');
      return;
    }

    console.log('✅ Apple Notes access granted');

    console.log('\nAvailable folders:');
    const folders = await extractor.getFolders();
    folders.forEach(folder => console.log(`  - ${folder}`));

    console.log('\nExtracting first 3 notes...');
    let count = 0;
    for await (const entry of extractor.extractAll()) {
      console.log(`\n📝 ${entry.title}`);
      console.log(`   Folder: ${entry.sourcePath}`);
      console.log(`   Length: ${entry.content.length} chars`);
      count++;
      if (count >= 3) break;
    }

    console.log(`\n✅ Successfully extracted ${count} notes`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
