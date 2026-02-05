import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { config } from '../config.js';
import type { RemarkableNote, Content } from '../types.js';

const execAsync = promisify(exec);
const REMARKABLE_CLI = config.remarkable.cliPath;
const STORAGE_DIR = config.remarkable.storageDir;

// Course folder name patterns to course IDs
const folderToCourse: Record<string, string> = {
  'entrepreneurial innovation': '33259',
  'ent innovation': '33259',
  'business analytics': '32991',
  'mba 560': '32991',
  'analytics': '32991',
  'business strategy': '33202',
  'mba 580': '33202',
  'strategy': '33202',
  'career strategy': '34634',
  'post-mba': '34634',
  'eta': '34458',
  'mba 677r': '34458',
  'acquisition': '34458',
  'venture capital': '34638',
  'vc': '34638',
  'pe': '34638',
  'mba 664': '34638',
  'client acquisition': '34642',
  'mba 654': '34642',
  'retention': '34642',
};

function matchFolderToCourse(folderName: string): string | null {
  const lower = folderName.toLowerCase();
  for (const [pattern, courseId] of Object.entries(folderToCourse)) {
    if (lower.includes(pattern)) {
      return courseId;
    }
  }
  return null;
}

async function runRemarkableCli(args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${REMARKABLE_CLI} ${args}`, {
      env: { ...process.env, REMARKABLE_DEVICE_TOKEN: config.remarkable.token }
    });
    return stdout;
  } catch (e) {
    console.error('Remarkable CLI error:', e);
    return '';
  }
}

async function loadNotesFromStorage(): Promise<RemarkableNote[]> {
  const notes: RemarkableNote[] = [];
  
  try {
    // Check if storage dir exists and has content
    const storageStat = await stat(STORAGE_DIR);
    if (!storageStat.isDirectory()) return notes;
    
    // Walk through storage directory
    async function walkDir(dir: string, parentFolder: string = '') {
      const items = await readdir(dir);
      
      for (const item of items) {
        const itemPath = join(dir, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          await walkDir(itemPath, parentFolder ? `${parentFolder}/${item}` : item);
        } else if (item.endsWith('.md') || item.endsWith('.txt') || item.endsWith('.pdf')) {
          const content = item.endsWith('.pdf') 
            ? null 
            : await readFile(itemPath, 'utf-8').catch(() => null);
          
          const matchedCourse = matchFolderToCourse(parentFolder || item);
          
          notes.push({
            id: `remarkable-${Buffer.from(itemPath).toString('base64').slice(0, 16)}`,
            name: item.replace(/\.(md|txt|pdf)$/, ''),
            folder: parentFolder || 'root',
            modifiedAt: itemStat.mtime.toISOString(),
            content,
            matchedCourseId: matchedCourse,
          });
        }
      }
    }
    
    await walkDir(STORAGE_DIR);
  } catch (e) {
    // Storage dir doesn't exist yet, that's fine
    console.log('Remarkable storage not found, will sync on first run');
  }
  
  return notes;
}

export async function fetchRemarkableNotes(): Promise<RemarkableNote[]> {
  // First try to sync (if CLI is available)
  console.log('  Syncing Remarkable notes...');
  await runRemarkableCli('sync');
  
  // Then load from storage
  return loadNotesFromStorage();
}

export function remarkableToContent(notes: RemarkableNote[]): Content[] {
  return notes.map(note => ({
    id: `remarkable-content-${note.id}`,
    courseId: note.matchedCourseId || 'unmatched',
    title: note.name,
    type: 'note' as const,
    url: null,
    sourceType: 'remarkable' as const,
    rawId: note.id,
    filePath: note.folder,
    updatedAt: note.modifiedAt,
  }));
}
