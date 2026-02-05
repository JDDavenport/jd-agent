#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import postgres from "postgres";
import fs from "fs";
import path from "path";

// Database connection
const DB_URL = "postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DB_URL);

const PLAUD_SYNC_DIR = `${process.env.HOME}/Documents/PlaudSync`;

// Two different metadata formats exist in PlaudSync
interface PlaudMetadataV1 {
  id: string;
  title: string;
  duration: number; // milliseconds
  startTime: number; // unix timestamp ms
  endTime: number;
  detail: {
    id: string;
    filename: string;
    filesize: number;
    start_time: number;
    duration: number;
    scene: number;
    [key: string]: any;
  };
}

interface PlaudMetadataV2 {
  id: string;
  filename: string;
  duration: number; // milliseconds
  durationMinutes: number;
  startTime: string; // ISO date string
  isTranscribed: boolean;
  isSummarized: boolean;
  fileType: string;
  fileSize: number;
}

type PlaudMetadata = PlaudMetadataV1 | PlaudMetadataV2;

interface RecordingInsert {
  file_path: string;
  original_filename: string;
  duration_seconds: number;
  file_size_bytes: bigint;
  recording_type: 'class' | 'meeting' | 'conversation' | 'other';
  context: string | null;
  recorded_at: Date;
}

interface TranscriptInsert {
  recording_id: string;
  full_text: string;
  language: string;
  model_used?: string;
}

// Course schedule mapping (Winter 2026)
const COURSE_SCHEDULE = {
  // Monday
  1: {
    morning: 'MBA 560 - Business Analytics',
    afternoon: 'Other Classes'
  },
  // Tuesday - Friday approximations based on typical MBA schedule
  2: { morning: 'Entrepreneurial Innovation', afternoon: 'MBA 580 - Business Strategy' },
  3: { morning: 'MBA 693R - Post-MBA Career Strategy', afternoon: 'MBA 677R - Entrepreneurship Through Acquisition' },
  4: { morning: 'MBA 664 - Venture Capital/Private Equity', afternoon: 'MBA 654 - Strategic Client Acquisition/Retention' },
  5: { morning: 'General Sessions', afternoon: 'General Sessions' }
};

function isV1Metadata(metadata: any): metadata is PlaudMetadataV1 {
  return metadata.detail !== undefined && typeof metadata.startTime === 'number';
}

function isV2Metadata(metadata: any): metadata is PlaudMetadataV2 {
  return metadata.filename !== undefined && typeof metadata.startTime === 'string';
}

function getStartDate(metadata: PlaudMetadata): Date {
  if (isV1Metadata(metadata)) {
    return new Date(metadata.startTime);
  } else if (isV2Metadata(metadata)) {
    return new Date(metadata.startTime);
  }
  throw new Error('Unknown metadata format');
}

function getFilename(metadata: PlaudMetadata): string {
  if (isV1Metadata(metadata)) {
    return metadata.detail.filename;
  } else if (isV2Metadata(metadata)) {
    return metadata.filename;
  }
  throw new Error('Unknown metadata format');
}

function getFileSize(metadata: PlaudMetadata): number {
  if (isV1Metadata(metadata)) {
    return metadata.detail.filesize || 0;
  } else if (isV2Metadata(metadata)) {
    return metadata.fileSize || 0;
  }
  return 0;
}

function getDurationMs(metadata: PlaudMetadata): number {
  return metadata.duration || 0;
}

function determineRecordingType(metadata: PlaudMetadata): 'class' | 'meeting' | 'conversation' | 'other' {
  const startDate = getStartDate(metadata);
  const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = startDate.getHours();
  
  // Scene 1 might indicate class recordings (V1 format only)
  if (isV1Metadata(metadata) && metadata.detail.scene === 1) {
    return 'class';
  }
  
  // School hours during weekdays (Monday-Friday)
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 17) {
    return 'class';
  }
  
  return 'other';
}

function determineContext(metadata: PlaudMetadata): string | undefined {
  const startDate = getStartDate(metadata);
  const dayOfWeek = startDate.getDay();
  const hour = startDate.getHours();
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const schedule = COURSE_SCHEDULE[dayOfWeek as keyof typeof COURSE_SCHEDULE];
    if (schedule) {
      if (hour >= 8 && hour < 12) {
        return schedule.morning;
      } else if (hour >= 12 && hour <= 17) {
        return schedule.afternoon;
      }
    }
  }
  
  return undefined;
}

async function findTranscriptFiles(folderPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(folderPath);
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(entry).toLowerCase();
        const basename = path.basename(entry, ext).toLowerCase();
        
        // Look for transcript files
        if ((ext === '.txt' || ext === '.json') && 
            (basename.includes('transcript') || basename.includes('trans'))) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Folder doesn't exist or can't be read
  }
  
  return files;
}

async function readTranscriptFile(filePath: string): Promise<string> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // If it's a JSON file, try to extract text content
    if (path.extname(filePath).toLowerCase() === '.json') {
      try {
        const json = JSON.parse(content);
        // Common transcript JSON structures
        if (typeof json.text === 'string') return json.text;
        if (typeof json.transcript === 'string') return json.transcript;
        if (typeof json.full_text === 'string') return json.full_text;
        if (Array.isArray(json.segments)) {
          return json.segments.map((seg: any) => seg.text || seg.content || '').join(' ');
        }
        return JSON.stringify(json, null, 2); // Fallback to formatted JSON
      } catch {
        return content; // Not valid JSON, return as text
      }
    }
    
    return content;
  } catch (error) {
    console.error(`Error reading transcript file ${filePath}:`, error);
    return '';
  }
}

async function processPlaudRecordings(dryRun: boolean = false) {
  console.log(`🎯 Starting Plaud recordings migration${dryRun ? ' (DRY RUN)' : ''}...`);
  
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalWithTranscripts = 0;
  let errors: string[] = [];
  
  try {
    // Get all recording folders
    const folders = fs.readdirSync(PLAUD_SYNC_DIR)
      .filter(name => name.startsWith('2026-') && !name.startsWith('.'))
      .map(name => path.join(PLAUD_SYNC_DIR, name))
      .filter(folderPath => fs.statSync(folderPath).isDirectory());
    
    console.log(`📁 Found ${folders.length} recording folders`);
    
    for (const folderPath of folders) {
      const folderName = path.basename(folderPath);
      totalProcessed++;
      
      try {
        // Read metadata.json
        const metadataPath = path.join(folderPath, 'metadata.json');
        if (!fs.existsSync(metadataPath)) {
          console.warn(`⚠️  No metadata.json in ${folderName}, skipping`);
          totalSkipped++;
          continue;
        }
        
        const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
        const metadata: PlaudMetadata = JSON.parse(metadataContent);
        
        const filename = getFilename(metadata);
        const fileSize = getFileSize(metadata);
        const durationMs = getDurationMs(metadata);
        const startDate = getStartDate(metadata);
        
        // Check if recording already exists
        const existing = await sql`
          SELECT id FROM recordings 
          WHERE original_filename = ${filename}
          OR file_path = ${folderPath}
        `;
        
        if (existing.length > 0) {
          console.log(`⏭️  Recording ${filename} already exists, skipping`);
          totalSkipped++;
          continue;
        }
        
        // Prepare recording data, ensuring no undefined values
        const context = determineContext(metadata);
        const recordingData: RecordingInsert = {
          file_path: folderPath,
          original_filename: filename,
          duration_seconds: Math.round(durationMs / 1000),
          file_size_bytes: BigInt(fileSize),
          recording_type: determineRecordingType(metadata),
          context: context || null,
          recorded_at: startDate
        };
        
        let insertedRecording: any = null;
        
        if (dryRun) {
          console.log(`🔍 Would insert: ${filename} (${recordingData.recording_type}${recordingData.context ? ` - ${recordingData.context}` : ''}) - ${Math.round(durationMs/1000/60)}min, ${(fileSize/1024/1024).toFixed(1)}MB`);
          totalInserted++;
          // Create a mock recording object for dry run
          insertedRecording = {
            id: 'mock-id',
            original_filename: filename,
            recording_type: recordingData.recording_type,
            context: recordingData.context
          };
        } else {
          // Insert recording
          [insertedRecording] = await sql`
            INSERT INTO recordings ${sql(recordingData, 'file_path', 'original_filename', 'duration_seconds', 'file_size_bytes', 'recording_type', 'context', 'recorded_at')}
            RETURNING id, original_filename, recording_type, context
          `;
          
          console.log(`✅ Inserted: ${insertedRecording.original_filename} (${insertedRecording.recording_type}${insertedRecording.context ? ` - ${insertedRecording.context}` : ''})`);
          totalInserted++;
        }
        
        // Check for transcript files
        const transcriptFiles = await findTranscriptFiles(folderPath);
        
        if (transcriptFiles.length > 0) {
          totalWithTranscripts++;
          
          if (dryRun) {
            console.log(`  📝 Would add ${transcriptFiles.length} transcript file(s): ${transcriptFiles.map(f => path.basename(f)).join(', ')}`);
          } else {
            for (const transcriptFile of transcriptFiles) {
              try {
                const transcriptText = await readTranscriptFile(transcriptFile);
                
                if (transcriptText.trim()) {
                  const transcriptData: TranscriptInsert = {
                    recording_id: insertedRecording.id,
                    full_text: transcriptText,
                    language: 'en',
                    model_used: 'plaud_device'
                  };
                  
                  await sql`
                    INSERT INTO transcripts ${sql(transcriptData, 'recording_id', 'full_text', 'language', 'model_used')}
                  `;
                  
                  console.log(`  📝 Added transcript from ${path.basename(transcriptFile)}`);
                }
              } catch (error) {
                console.error(`  ❌ Error processing transcript ${transcriptFile}:`, error);
                errors.push(`Transcript error in ${folderName}: ${error}`);
              }
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${folderName}:`, error);
        errors.push(`Processing error in ${folderName}: ${error}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    errors.push(`Fatal error: ${error}`);
  }
  
  // Final report
  console.log('\n📊 Migration Summary:');
  console.log(`Total folders processed: ${totalProcessed}`);
  console.log(`Recordings inserted: ${totalInserted}`);
  console.log(`Recordings skipped: ${totalSkipped}`);
  console.log(`Recordings with transcripts: ${totalWithTranscripts}`);
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(error => console.log(`  - ${error}`));
  }
  
  console.log('\n🎉 Migration complete!');
}

// Run the migration
if (import.meta.main) {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  processPlaudRecordings(dryRun)
    .catch(error => {
      console.error('💥 Uncaught error:', error);
      process.exit(1);
    })
    .finally(() => {
      sql.end();
    });
}