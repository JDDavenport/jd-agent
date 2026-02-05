#!/usr/bin/env bun

import fs from "fs";
import path from "path";

const PLAUD_SYNC_DIR = `${process.env.HOME}/Documents/PlaudSync`;

interface PlaudMetadataV1 {
  id: string;
  title: string;
  duration: number;
  startTime: number;
  endTime: number;
  detail: {
    filename: string;
    filesize: number;
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

async function scanPlaudRecordings() {
  console.log('🔍 Scanning Plaud recordings...');
  
  try {
    const folders = fs.readdirSync(PLAUD_SYNC_DIR)
      .filter(name => name.startsWith('2026-') && !name.startsWith('.'))
      .map(name => path.join(PLAUD_SYNC_DIR, name))
      .filter(folderPath => fs.statSync(folderPath).isDirectory());
    
    console.log(`📁 Found ${folders.length} recording folders`);
    
    let validMetadata = 0;
    let classRecordings = 0;
    let otherRecordings = 0;
    let totalDurationHours = 0;
    let largestFile = 0;
    
    // Process first 10 for testing
    for (const folderPath of folders.slice(0, 10)) {
      const folderName = path.basename(folderPath);
      
      try {
        const metadataPath = path.join(folderPath, 'metadata.json');
        if (!fs.existsSync(metadataPath)) {
          console.warn(`⚠️  No metadata.json in ${folderName}`);
          continue;
        }
        
        const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
        const metadata: PlaudMetadata = JSON.parse(metadataContent);
        
        validMetadata++;
        
        const recordingType = determineRecordingType(metadata);
        const startDate = getStartDate(metadata);
        const filename = getFilename(metadata);
        const fileSize = getFileSize(metadata);
        const durationHours = metadata.duration / (1000 * 60 * 60);
        
        totalDurationHours += durationHours;
        largestFile = Math.max(largestFile, fileSize);
        
        if (recordingType === 'class') {
          classRecordings++;
        } else {
          otherRecordings++;
        }
        
        const format = isV1Metadata(metadata) ? 'V1' : 'V2';
        console.log(`📝 ${filename} (${format})`);
        console.log(`   Type: ${recordingType}, Date: ${startDate.toLocaleString()}, Duration: ${(durationHours * 60).toFixed(1)}min, Size: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
        
      } catch (error) {
        console.error(`❌ Error processing ${folderName}:`, error);
      }
    }
    
    console.log('\n📊 Sample Statistics:');
    console.log(`Valid metadata files: ${validMetadata}`);
    console.log(`Class recordings: ${classRecordings}`);
    console.log(`Other recordings: ${otherRecordings}`);
    console.log(`Total duration: ${totalDurationHours.toFixed(1)} hours`);
    console.log(`Largest file: ${(largestFile / 1024 / 1024).toFixed(1)} MB`);
    
  } catch (error) {
    console.error('💥 Error scanning recordings:', error);
  }
}

if (import.meta.main) {
  scanPlaudRecordings();
}