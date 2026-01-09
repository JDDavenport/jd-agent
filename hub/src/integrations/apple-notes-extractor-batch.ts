/**
 * Apple Notes Batch Extractor - Extract notes in batches to avoid timeouts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { RawEntry } from '../types';
import { contentParser } from '../lib/content-parser';

const execAsync = promisify(exec);

export interface AppleNotesConfig {
  batchSize?: number; // Number of notes to extract per batch
  includeFolders?: string[];
  excludeFolders?: string[];
}

interface AppleNoteRaw {
  id: string;
  title: string;
  body: string;
  folder: string;
  created: string;
  modified: string;
}

export class AppleNotesExtractorBatch {
  private config: AppleNotesConfig;

  constructor(config: AppleNotesConfig = {}) {
    this.config = {
      batchSize: 50, // Process 50 notes at a time
      ...config,
    };
  }

  /**
   * Extract all notes in batches
   */
  async *extractAll(): AsyncGenerator<RawEntry> {
    console.log('Starting Apple Notes extraction (batch mode)...');

    try {
      // First, get total count
      const totalCount = await this.getTotalCount();
      console.log(`Found ${totalCount} Apple Notes`);

      if (totalCount === 0) {
        console.log('No notes found');
        return;
      }

      const batchSize = this.config.batchSize!;
      const totalBatches = Math.ceil(totalCount / batchSize);

      // Process in batches
      for (let batch = 0; batch < totalBatches; batch++) {
        const startIdx = batch * batchSize + 1; // AppleScript is 1-indexed
        const endIdx = Math.min((batch + 1) * batchSize, totalCount);

        console.log(`Extracting batch ${batch + 1}/${totalBatches} (notes ${startIdx}-${endIdx})...`);

        const notes = await this.extractBatch(startIdx, endIdx);

        for (const note of notes) {
          yield this.convertToRawEntry(note);
        }
      }

      console.log(`✅ Extracted all ${totalCount} Apple Notes`);
    } catch (error) {
      console.error('Error in Apple Notes extraction:', error);
      throw error;
    }
  }

  /**
   * Get total number of notes
   */
  private async getTotalCount(): Promise<number> {
    const script = `tell application "Notes" to count every note`;

    try {
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return parseInt(stdout.trim(), 10);
    } catch (error: any) {
      console.error('Error getting note count:', error.message);
      return 0;
    }
  }

  /**
   * Extract a batch of notes
   */
  private async extractBatch(startIdx: number, endIdx: number): Promise<AppleNoteRaw[]> {
    const script = `
      tell application "Notes"
        set allNotes to every note
        set output to ""

        repeat with i from ${startIdx} to ${endIdx}
          try
            set aNote to item i of allNotes
            set noteId to id of aNote
            set noteTitle to name of aNote
            set noteBody to body of aNote

            -- Try to get folder, use default if fails
            try
              set noteFolder to name of container of aNote
            on error
              set noteFolder to "Notes"
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
            -- Skip notes that cause errors
            log "Error processing note at index " & i & ": " & errMsg
          end try
        end repeat

        return output
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        timeout: 60000, // 60 second timeout per batch
      });

      return this.parseAppleScriptOutput(stdout);
    } catch (error: any) {
      if (error.message.includes('is not allowed')) {
        throw new Error(
          'Permission denied. Please grant Terminal access to Notes in System Preferences > Privacy & Security > Automation'
        );
      }
      console.error(`Error extracting batch ${startIdx}-${endIdx}:`, error.message);
      return []; // Return empty array, continue with next batch
    }
  }

  /**
   * Parse AppleScript output
   */
  private parseAppleScriptOutput(output: string): AppleNoteRaw[] {
    const notes: AppleNoteRaw[] = [];
    // AppleScript uses \r for newlines, normalize to \n
    const normalized = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const noteBlocks = normalized.split('---NOTE_START---').filter(block => block.includes('---NOTE_END---'));

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
   * Parse AppleScript date format to JavaScript Date
   * Example: "Tuesday, January 6, 2026 at 2:44:06 PM" -> Date
   */
  private parseAppleScriptDate(dateStr: string): Date {
    if (!dateStr) return new Date();

    try {
      // AppleScript format: "DayName, Month Day, Year at HH:MM:SS AM/PM"
      // Convert to ISO-ish format that JS can parse
      const match = dateStr.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+):(\d+)\s+(AM|PM)/);

      if (!match) {
        console.warn(`Could not parse date: ${dateStr}`);
        return new Date();
      }

      const [, , month, day, year, hour, minute, second, ampm] = match;

      // Convert to 24-hour format
      let hour24 = parseInt(hour, 10);
      if (ampm === 'PM' && hour24 !== 12) {
        hour24 += 12;
      } else if (ampm === 'AM' && hour24 === 12) {
        hour24 = 0;
      }

      // Create date string in format JS can parse
      const dateString = `${month} ${day}, ${year} ${hour24}:${minute}:${second}`;
      const parsed = new Date(dateString);

      if (isNaN(parsed.getTime())) {
        console.warn(`Invalid parsed date: ${dateString}`);
        return new Date();
      }

      return parsed;
    } catch (error) {
      console.warn(`Error parsing date "${dateStr}":`, error);
      return new Date();
    }
  }

  /**
   * Convert to RawEntry format
   */
  private convertToRawEntry(note: AppleNoteRaw): RawEntry {
    // Convert HTML body to markdown
    const content = contentParser.htmlToMarkdown(note.body);

    // Parse dates
    const createdAt = this.parseAppleScriptDate(note.created);
    const modifiedAt = this.parseAppleScriptDate(note.modified);

    return {
      title: note.title || 'Untitled',
      content,
      source: 'manual', // Apple Notes not in enum
      sourceId: note.id,
      sourcePath: `Apple Notes / ${note.folder}`,
      createdAt,
      modifiedAt,
      rawMetadata: {
        folder: note.folder,
        source: 'apple_notes',
      },
    };
  }
}

export function createAppleNotesExtractor(config?: AppleNotesConfig): AppleNotesExtractorBatch {
  return new AppleNotesExtractorBatch(config);
}
