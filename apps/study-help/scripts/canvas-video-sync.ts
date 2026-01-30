#!/usr/bin/env npx tsx
/**
 * Canvas YouTube Video Sync
 * Finds all YouTube links in Canvas modules and adds them to the video system
 * 
 * Usage: npx tsx scripts/canvas-video-sync.ts
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from hub
const envPath = path.join(__dirname, '../../../hub/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key) env[key.trim()] = value.join('=').trim();
});

const CANVAS_BASE_URL = env.CANVAS_BASE_URL || 'https://byu.instructure.com';
const CANVAS_TOKEN = env.CANVAS_TOKEN;
const API_BASE = 'http://localhost:3000/api';

// Course ID to app course mapping
const COURSE_MAP: Record<number, { id: string; tag: string }> = {
  33259: { id: 'entrepreneurial-innovation', tag: 'entrepreneurial-innovation' },
  32991: { id: 'mba560', tag: 'MBA560' },
  33202: { id: 'mba580', tag: 'MBA580' },
  34638: { id: 'mba664', tag: 'MBA664' },
  34458: { id: 'mba677', tag: 'MBA677R' },
  34642: { id: 'mba654', tag: 'MBA654' },
  34634: { id: 'mba693r', tag: 'MBA693R' },
};

interface ModuleItem {
  id: number;
  title: string;
  type: string;
  external_url?: string;
  module_id: number;
}

interface Module {
  id: number;
  name: string;
  items?: ModuleItem[];
}

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function canvasGet<T>(endpoint: string): Promise<T> {
  const url = `${CANVAS_BASE_URL}/api/v1${endpoint}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${CANVAS_TOKEN}`,
        'Accept': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function addVideoToSystem(
  url: string,
  title: string,
  canvasCourseId: string,
  moduleItemId: string,
  moduleName: string,
  tags: string[]
): Promise<boolean> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      url,
      canvasCourseId,
      canvasModuleItemId: moduleItemId,
      canvasModuleName: moduleName,
      tags,
    });
    
    const req = http.request(`${API_BASE}/read-help/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          console.error(`  ❌ API error: ${res.statusCode} - ${data.slice(0, 200)}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`  ❌ Request error: ${e.message}`);
      resolve(false);
    });
    
    req.write(body);
    req.end();
  });
}

async function getExistingVideos(): Promise<Set<string>> {
  return new Promise((resolve) => {
    http.get(`${API_BASE}/read-help/videos`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const youtubeIds = new Set<string>(
            (json.data || json || []).map((v: { youtubeId: string }) => v.youtubeId)
          );
          resolve(youtubeIds);
        } catch (e) {
          console.error('Failed to get existing videos:', e);
          resolve(new Set());
        }
      });
    }).on('error', () => resolve(new Set()));
  });
}

async function getModulesForCourse(courseId: number): Promise<Module[]> {
  try {
    return await canvasGet<Module[]>(`/courses/${courseId}/modules?include[]=items&per_page=100`);
  } catch (e) {
    console.error(`Failed to get modules for course ${courseId}:`, e);
    return [];
  }
}

async function syncCourse(
  courseId: number,
  courseInfo: { id: string; tag: string },
  existingVideos: Set<string>
) {
  console.log(`\n🎬 Syncing videos for course: ${courseInfo.tag} (${courseId})`);
  
  let videoCount = 0;
  let addedCount = 0;
  let skippedCount = 0;
  
  const modules = await getModulesForCourse(courseId);
  
  for (const module of modules) {
    if (!module.items) continue;
    
    for (const item of module.items) {
      if (item.type === 'ExternalUrl' && item.external_url) {
        const youtubeId = extractYouTubeId(item.external_url);
        
        if (youtubeId) {
          videoCount++;
          
          // Check if already exists
          if (existingVideos.has(youtubeId)) {
            console.log(`  ⏭️  Skip (exists): ${item.title}`);
            skippedCount++;
            continue;
          }
          
          console.log(`  🎬 Adding: ${item.title}`);
          console.log(`     URL: ${item.external_url}`);
          
          const success = await addVideoToSystem(
            item.external_url,
            item.title,
            String(courseId),
            String(item.id),
            module.name,
            [courseInfo.tag, 'canvas', 'video']
          );
          
          if (success) {
            addedCount++;
            existingVideos.add(youtubeId);
            console.log(`  ✅ Added: ${item.title}`);
          }
          
          // Rate limiting
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  }
  
  console.log(`  📊 Summary: ${addedCount} added, ${skippedCount} skipped, ${videoCount} total videos found`);
  return { added: addedCount, skipped: skippedCount, total: videoCount };
}

async function main() {
  console.log('🎬 Canvas YouTube Video Sync');
  console.log('============================');
  
  if (!CANVAS_TOKEN) {
    console.error('❌ CANVAS_TOKEN not found in hub/.env');
    process.exit(1);
  }
  
  console.log(`📡 Canvas: ${CANVAS_BASE_URL}`);
  console.log(`📡 API: ${API_BASE}`);
  
  // Get existing videos
  console.log('\n📚 Checking existing videos...');
  const existingVideos = await getExistingVideos();
  console.log(`Found ${existingVideos.size} existing videos`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalVideos = 0;
  
  for (const [courseId, courseInfo] of Object.entries(COURSE_MAP)) {
    const result = await syncCourse(parseInt(courseId), courseInfo, existingVideos);
    totalAdded += result.added;
    totalSkipped += result.skipped;
    totalVideos += result.total;
  }
  
  console.log('\n============================');
  console.log('📊 Final Summary');
  console.log(`  Total YouTube videos found: ${totalVideos}`);
  console.log(`  Added: ${totalAdded}`);
  console.log(`  Skipped (already exist): ${totalSkipped}`);
  console.log('============================');
}

main().catch(console.error);
