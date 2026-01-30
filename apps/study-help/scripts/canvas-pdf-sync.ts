#!/usr/bin/env npx tsx
/**
 * Canvas PDF Sync
 * Downloads all PDFs from Canvas courses and uploads them to read-help API
 * 
 * Usage: npx tsx scripts/canvas-pdf-sync.ts
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

interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  'content-type': string;  // Canvas uses hyphen not underscore
  created_at: string;
  updated_at: string;
  mime_class?: string;
}

interface ModuleItem {
  id: number;
  title: string;
  type: string;
  content_id?: number;
  url?: string;
  external_url?: string;
}

interface Module {
  id: number;
  name: string;
  items?: ModuleItem[];
}

async function canvasGet<T>(endpoint: string): Promise<T> {
  const url = `${CANVAS_BASE_URL}/api/v1${endpoint}`;
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
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
    });
    req.on('error', reject);
  });
}

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, {
      headers: {
        'Authorization': `Bearer ${CANVAS_TOKEN}`,
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function uploadToReadHelp(fileBuffer: Buffer, filename: string, tags: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    
    const formData: Buffer[] = [];
    
    // Add file
    formData.push(Buffer.from(`--${boundary}\r\n`));
    formData.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
    formData.push(Buffer.from(`Content-Type: application/pdf\r\n\r\n`));
    formData.push(fileBuffer);
    formData.push(Buffer.from('\r\n'));
    
    // Add tags - send as comma-separated values
    formData.push(Buffer.from(`--${boundary}\r\n`));
    formData.push(Buffer.from(`Content-Disposition: form-data; name="tags"\r\n\r\n`));
    formData.push(Buffer.from(tags.join(',')));
    formData.push(Buffer.from('\r\n'));
    
    formData.push(Buffer.from(`--${boundary}--\r\n`));
    
    const body = Buffer.concat(formData);
    
    const req = http.request(`${API_BASE}/read-help/books`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          console.error(`Upload failed: ${res.statusCode} - ${data.slice(0, 200)}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`Upload error: ${e.message}`);
      resolve(false);
    });
    
    req.write(body);
    req.end();
  });
}

async function getExistingBooks(): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}/read-help/books`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const titles = new Set<string>(
            (json.data || json || []).map((b: { title: string }) => b.title.toLowerCase())
          );
          resolve(titles);
        } catch (e) {
          console.error('Failed to get existing books:', e);
          resolve(new Set());
        }
      });
    }).on('error', () => resolve(new Set()));
  });
}

async function getModulesForCourse(courseId: number): Promise<Module[]> {
  try {
    const modules = await canvasGet<Module[]>(`/courses/${courseId}/modules?include[]=items&per_page=100`);
    return modules;
  } catch (e) {
    console.error(`Failed to get modules for course ${courseId}:`, e);
    return [];
  }
}

async function getFileDetails(courseId: number, fileId: number): Promise<CanvasFile | null> {
  try {
    return await canvasGet<CanvasFile>(`/courses/${courseId}/files/${fileId}`);
  } catch (e) {
    console.error(`Failed to get file ${fileId}:`, e);
    return null;
  }
}

async function getCourseFiles(courseId: number): Promise<CanvasFile[]> {
  try {
    // Get all files in the course that are PDFs
    const files = await canvasGet<CanvasFile[]>(`/courses/${courseId}/files?content_types[]=application/pdf&per_page=100`);
    // Canvas API can return an error object or pagination info instead of array
    if (!Array.isArray(files)) {
      console.error(`  Course files returned non-array:`, typeof files);
      return [];
    }
    return files.filter(f => f['content-type'] === 'application/pdf' || f.mime_class === 'pdf');
  } catch (e) {
    console.error(`Failed to get files for course ${courseId}:`, e);
    return [];
  }
}

async function syncCourse(courseId: number, courseInfo: { id: string; tag: string }, existingBooks: Set<string>) {
  console.log(`\n📚 Syncing course: ${courseInfo.tag} (${courseId})`);
  
  let pdfCount = 0;
  let uploadedCount = 0;
  let skippedCount = 0;
  
  // Method 1: Get PDFs from modules
  const modules = await getModulesForCourse(courseId);
  
  for (const module of modules) {
    if (!module.items) continue;
    
    for (const item of module.items) {
      if (item.type === 'File' && item.content_id) {
        const file = await getFileDetails(courseId, item.content_id);
        
        if (file && (file['content-type'] === 'application/pdf' || file.mime_class === 'pdf')) {
          pdfCount++;
          
          // Check if already exists
          const normalizedTitle = file.display_name.replace('.pdf', '').toLowerCase();
          if (existingBooks.has(normalizedTitle)) {
            console.log(`  ⏭️  Skip (exists): ${file.display_name}`);
            skippedCount++;
            continue;
          }
          
          console.log(`  📄 Downloading: ${file.display_name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          
          try {
            const buffer = await downloadFile(file.url);
            const tags = [courseInfo.tag, 'canvas', 'preclass'];
            
            console.log(`  📤 Uploading: ${file.display_name}`);
            const success = await uploadToReadHelp(buffer, file.display_name, tags);
            
            if (success) {
              uploadedCount++;
              existingBooks.add(normalizedTitle);
              console.log(`  ✅ Uploaded: ${file.display_name}`);
            } else {
              console.log(`  ❌ Failed: ${file.display_name}`);
            }
          } catch (e) {
            console.error(`  ❌ Error downloading ${file.display_name}:`, e);
          }
          
          // Rate limiting
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  }
  
  // Method 2: Get all course files (might catch ones not in modules)
  const allFiles = await getCourseFiles(courseId);
  
  for (const file of allFiles) {
    const normalizedTitle = file.display_name.replace('.pdf', '').toLowerCase();
    if (existingBooks.has(normalizedTitle)) {
      continue; // Already processed or exists
    }
    
    pdfCount++;
    console.log(`  📄 Downloading (from files): ${file.display_name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    try {
      const buffer = await downloadFile(file.url);
      const tags = [courseInfo.tag, 'canvas'];
      
      console.log(`  📤 Uploading: ${file.display_name}`);
      const success = await uploadToReadHelp(buffer, file.display_name, tags);
      
      if (success) {
        uploadedCount++;
        existingBooks.add(normalizedTitle);
        console.log(`  ✅ Uploaded: ${file.display_name}`);
      } else {
        console.log(`  ❌ Failed: ${file.display_name}`);
      }
    } catch (e) {
      console.error(`  ❌ Error downloading ${file.display_name}:`, e);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`  📊 Summary: ${uploadedCount} uploaded, ${skippedCount} skipped, ${pdfCount} total PDFs found`);
  return { uploaded: uploadedCount, skipped: skippedCount, total: pdfCount };
}

async function main() {
  console.log('🎓 Canvas PDF Sync');
  console.log('==================');
  
  if (!CANVAS_TOKEN) {
    console.error('❌ CANVAS_TOKEN not found in hub/.env');
    process.exit(1);
  }
  
  console.log(`📡 Canvas: ${CANVAS_BASE_URL}`);
  console.log(`📡 API: ${API_BASE}`);
  
  // Get existing books to avoid duplicates
  console.log('\n📚 Checking existing books...');
  const existingBooks = await getExistingBooks();
  console.log(`Found ${existingBooks.size} existing books`);
  
  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalPdfs = 0;
  
  for (const [courseId, courseInfo] of Object.entries(COURSE_MAP)) {
    const result = await syncCourse(parseInt(courseId), courseInfo, existingBooks);
    totalUploaded += result.uploaded;
    totalSkipped += result.skipped;
    totalPdfs += result.total;
  }
  
  console.log('\n==================');
  console.log('📊 Final Summary');
  console.log(`  Total PDFs found: ${totalPdfs}`);
  console.log(`  Uploaded: ${totalUploaded}`);
  console.log(`  Skipped (already exist): ${totalSkipped}`);
  console.log('==================');
}

main().catch(console.error);
