import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { config } from '../config.js';
import type { PlaudRecording, Content } from '../types.js';
import { parse, format, getDay, isWithinInterval, addMinutes } from 'date-fns';

const PLAUD_DIR = config.plaud.syncDir;
const SCHEDULE = config.classSchedule;

// Day name to number (0 = Sunday)
const dayMap: Record<string, number> = {
  'Su': 0, 'M': 1, 'Tu': 2, 'W': 3, 'Th': 4, 'F': 5, 'Sa': 6
};

function parseRecordingDate(folderName: string): { date: Date; time: string } | null {
  // Formats: 2026-01-14_2026-01-14_094107_xxx or 2026-01-14_xxx
  const match = folderName.match(/(\d{4}-\d{2}-\d{2})_.*?(\d{2})(\d{2})(\d{2})_/);
  if (match) {
    const [, dateStr, hours, mins] = match;
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    date.setHours(parseInt(hours), parseInt(mins), 0);
    return { date, time: `${hours}:${mins}` };
  }
  
  // Try simpler format
  const simpleMatch = folderName.match(/(\d{4}-\d{2}-\d{2})/);
  if (simpleMatch) {
    const date = parse(simpleMatch[1], 'yyyy-MM-dd', new Date());
    return { date, time: '00:00' };
  }
  
  return null;
}

function matchRecordingToCourse(date: Date, time: string): { courseId: string; className: string } | null {
  const dayOfWeek = getDay(date);
  
  for (const cls of SCHEDULE) {
    // Check if this day matches any class day
    const classesOnDay = cls.days.some(d => dayMap[d] === dayOfWeek);
    if (!classesOnDay) continue;
    
    // Parse class time
    const [classHour, classMin] = cls.time.split(':').map(Number);
    const classStart = new Date(date);
    classStart.setHours(classHour, classMin, 0);
    const classEnd = addMinutes(classStart, cls.duration);
    
    // Parse recording time
    const [recHour, recMin] = time.split(':').map(Number);
    const recTime = new Date(date);
    recTime.setHours(recHour, recMin, 0);
    
    // Check if recording started within class window (allow 15 min buffer before/after)
    const windowStart = addMinutes(classStart, -15);
    const windowEnd = addMinutes(classEnd, 15);
    
    if (isWithinInterval(recTime, { start: windowStart, end: windowEnd })) {
      return { courseId: cls.courseId, className: cls.name };
    }
  }
  
  return null;
}

async function findTranscript(folderPath: string): Promise<string | null> {
  try {
    const files = await readdir(folderPath);
    // Look for markdown or txt transcript
    const transcriptFile = files.find(f => 
      f.endsWith('.md') || f.endsWith('.txt') || f.includes('transcript')
    );
    
    if (transcriptFile) {
      const content = await readFile(join(folderPath, transcriptFile), 'utf-8');
      return content;
    }
  } catch {
    // No transcript found
  }
  return null;
}

async function findAudioFile(folderPath: string): Promise<string | null> {
  try {
    const files = await readdir(folderPath);
    const audioFile = files.find(f => 
      f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav')
    );
    return audioFile ? join(folderPath, audioFile) : null;
  } catch {
    return null;
  }
}

export async function fetchPlaudRecordings(): Promise<PlaudRecording[]> {
  const recordings: PlaudRecording[] = [];
  
  try {
    const folders = await readdir(PLAUD_DIR);
    
    for (const folder of folders) {
      const folderPath = join(PLAUD_DIR, folder);
      const folderStat = await stat(folderPath);
      
      if (!folderStat.isDirectory()) continue;
      
      const parsed = parseRecordingDate(folder);
      if (!parsed) continue;
      
      const transcript = await findTranscript(folderPath);
      const audioPath = await findAudioFile(folderPath);
      const match = matchRecordingToCourse(parsed.date, parsed.time);
      
      recordings.push({
        id: `plaud-${folder}`,
        folderName: folder,
        date: format(parsed.date, 'yyyy-MM-dd'),
        time: parsed.time,
        transcript,
        audioPath,
        matchedCourseId: match?.courseId || null,
        matchedClassName: match?.className || null,
      });
    }
  } catch (e) {
    console.error('Error reading Plaud directory:', e);
  }
  
  return recordings;
}

export function plaudToContent(recordings: PlaudRecording[]): Content[] {
  return recordings.map(rec => ({
    id: `plaud-content-${rec.id}`,
    courseId: rec.matchedCourseId || 'unmatched',
    title: rec.matchedClassName 
      ? `${rec.matchedClassName} - ${rec.date}`
      : `Recording - ${rec.date} ${rec.time}`,
    type: 'recording' as const,
    url: null,
    sourceType: 'plaud' as const,
    rawId: rec.id,
    transcript: rec.transcript || undefined,
    filePath: rec.audioPath || undefined,
    createdAt: rec.date,
  }));
}
