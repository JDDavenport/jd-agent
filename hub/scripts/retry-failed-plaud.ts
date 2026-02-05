#!/usr/bin/env bun

import postgres from "postgres";
import fs from "fs";
import path from "path";

const DB_URL = "postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DB_URL);

// Failed folders from the previous run
const FAILED_FOLDERS = [
  "2026-02-01_2026-01-31_171521_0a2d6b1e",
  "2026-01-19_2026_01_18_22_40_53_af4a6396", 
  "2026-01-19_2026_01_18_22_40_48_9d531597",
  "2026-01-24_2026-01-24_012940_45e833a1",
  "2026-02-01_2026_01_31_17_15_21_0a2d6b1e",
  "2026-01-19_2026-01-18_224048_9d531597",
  "2026-01-14_Welcome_to_Plaudai_f0ff6d1a",
  "2026-01-14_Steve_Jobs_Bill_Gates_A_Conversation_That_Shaped_T_8e47e652",
  "2026-01-24_2026_01_24_01_29_40_45e833a1",
  "2026-01-19_2026-01-18_224053_af4a6396",
  "2026-01-24_2026_01_23_19_06_50_23db581b",
  "2026-01-24_2026-01-23_190650_23db581b",
  "2026-01-14_How_to_use_Plaud_82dd607f"
];

const PLAUD_SYNC_DIR = `${process.env.HOME}/Documents/PlaudSync`;

// Import the types and functions from the main script
interface PlaudMetadataV1 {
  id: string;
  title: string;
  duration: number;
  startTime: number;
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
  duration: number;
  durationMinutes: number;
  startTime: string;
  isTranscribed: boolean;
  isSummarized: boolean;
  fileType: string;
  fileSize: number;
}

type PlaudMetadata = PlaudMetadataV1 | PlaudMetadataV2;

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
  const dayOfWeek = startDate.getDay();
  const hour = startDate.getHours();
  
  if (isV1Metadata(metadata) && metadata.detail.scene === 1) {
    return 'class';
  }
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour <= 17) {
    return 'class';
  }
  
  return 'other';
}

function determineContext(metadata: PlaudMetadata): string | null {
  const startDate = getStartDate(metadata);
  const dayOfWeek = startDate.getDay();
  const hour = startDate.getHours();
  
  // Course schedule mapping (Winter 2026)
  const COURSE_SCHEDULE = {
    1: { morning: 'MBA 560 - Business Analytics', afternoon: 'Other Classes' },
    2: { morning: 'Entrepreneurial Innovation', afternoon: 'MBA 580 - Business Strategy' },
    3: { morning: 'MBA 693R - Post-MBA Career Strategy', afternoon: 'MBA 677R - Entrepreneurship Through Acquisition' },
    4: { morning: 'MBA 664 - Venture Capital/Private Equity', afternoon: 'MBA 654 - Strategic Client Acquisition/Retention' },
    5: { morning: 'General Sessions', afternoon: 'General Sessions' }
  };
  
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
  
  return null;
}

async function retryFailedRecordings() {
  console.log('🔧 Retrying failed Plaud recordings...');
  
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let errors: string[] = [];
  
  for (const folderName of FAILED_FOLDERS) {
    const folderPath = path.join(PLAUD_SYNC_DIR, folderName);
    totalProcessed++;
    
    try {
      console.log(`🔍 Processing ${folderName}...`);
      
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
      
      // Prepare recording data with explicit null handling
      const context = determineContext(metadata);
      const recordingData = {
        file_path: folderPath,
        original_filename: filename,
        duration_seconds: Math.round(durationMs / 1000),
        file_size_bytes: BigInt(fileSize),
        recording_type: determineRecordingType(metadata),
        context: context,
        recorded_at: startDate
      };
      
      console.log(`📝 Data to insert:`, {
        ...recordingData,
        file_size_bytes: recordingData.file_size_bytes.toString() + 'n'
      });
      
      // Insert recording - using explicit column list
      const [insertedRecording] = await sql`
        INSERT INTO recordings (file_path, original_filename, duration_seconds, file_size_bytes, recording_type, context, recorded_at)
        VALUES (${recordingData.file_path}, ${recordingData.original_filename}, ${recordingData.duration_seconds}, ${recordingData.file_size_bytes}, ${recordingData.recording_type}, ${recordingData.context}, ${recordingData.recorded_at})
        RETURNING id, original_filename, recording_type, context
      `;
      
      console.log(`✅ Inserted: ${insertedRecording.original_filename} (${insertedRecording.recording_type}${insertedRecording.context ? ` - ${insertedRecording.context}` : ''})`);
      totalInserted++;
      
    } catch (error) {
      console.error(`❌ Error processing ${folderName}:`, error);
      errors.push(`Processing error in ${folderName}: ${error}`);
    }
  }
  
  console.log('\n📊 Retry Summary:');
  console.log(`Total folders processed: ${totalProcessed}`);
  console.log(`Recordings inserted: ${totalInserted}`);
  console.log(`Recordings skipped: ${totalSkipped}`);
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(error => console.log(`  - ${error}`));
  }
  
  console.log('\n🎉 Retry complete!');
}

if (import.meta.main) {
  retryFailedRecordings()
    .catch(error => {
      console.error('💥 Uncaught error:', error);
      process.exit(1);
    })
    .finally(() => {
      sql.end();
    });
}