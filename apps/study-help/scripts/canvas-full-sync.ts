#!/usr/bin/env npx tsx
/**
 * Canvas Full Content Sync
 * Downloads EVERYTHING from Canvas courses: syllabus, assignments, pages, files, modules
 * Creates a local data directory that the study-help app can use
 * 
 * Usage: npx tsx scripts/canvas-full-sync.ts
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
const DATA_DIR = path.join(__dirname, '../public/data');
const FILES_DIR = path.join(DATA_DIR, 'files');

// Course mappings
const COURSE_MAP: Record<number, { id: string; name: string; tag: string }> = {
  33259: { id: 'entrepreneurial-innovation', name: 'Entrepreneurial Innovation', tag: 'ENTRE' },
  32991: { id: 'mba560', name: 'Business Analytics', tag: 'MBA560' },
  33202: { id: 'mba580', name: 'Business Strategy', tag: 'MBA580' },
  34638: { id: 'mba664', name: 'VC/Private Equity', tag: 'MBA664' },
  34458: { id: 'mba677', name: 'Entrepreneurship Through Acquisition', tag: 'MBA677R' },
  34642: { id: 'mba654', name: 'Strategic Client Acquisition', tag: 'MBA654' },
  34634: { id: 'mba693r', name: 'Post-MBA Career Strategy', tag: 'MBA693R' },
};

interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  'content-type': string;
  created_at: string;
  updated_at: string;
  folder_id?: number;
}

interface Assignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  submission_types: string[];
  created_at: string;
  updated_at: string;
}

interface Page {
  page_id: number;
  url: string;
  title: string;
  body?: string;
  created_at: string;
  updated_at: string;
  published: boolean;
}

interface ModuleItem {
  id: number;
  title: string;
  type: string;
  content_id?: number;
  url?: string;
  external_url?: string;
  page_url?: string;
  html_url?: string;
  indent?: number;
}

interface Module {
  id: number;
  name: string;
  position: number;
  unlock_at?: string;
  items?: ModuleItem[];
  items_count: number;
  items_url: string;
}

interface Folder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id?: number;
}

interface CourseData {
  id: number;
  slug: string;
  name: string;
  tag: string;
  syllabus?: string;
  assignments: Assignment[];
  pages: PageWithBody[];
  modules: ModuleWithItems[];
  files: FileInfo[];
  folders: Folder[];
}

interface PageWithBody extends Page {
  body: string;
}

interface ModuleWithItems extends Module {
  items: ModuleItem[];
}

interface FileInfo {
  id: number;
  name: string;
  url: string;
  size: number;
  contentType: string;
  localPath?: string;
  folder?: string;
}

// Rate limiting helper
async function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function canvasGet<T>(endpoint: string, paginate = false): Promise<T> {
  const allResults: any[] = [];
  let url = `${CANVAS_BASE_URL}/api/v1${endpoint}`;
  
  // Add per_page if paginating
  if (paginate && !url.includes('per_page')) {
    url += url.includes('?') ? '&per_page=100' : '?per_page=100';
  }
  
  while (url) {
    const result = await new Promise<{ data: any; nextUrl: string | null }>((resolve, reject) => {
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
            const json = JSON.parse(data);
            
            // Parse Link header for pagination
            let nextUrl: string | null = null;
            const linkHeader = res.headers.link;
            if (linkHeader) {
              const links = linkHeader.split(',');
              for (const link of links) {
                const match = link.match(/<([^>]+)>;\s*rel="next"/);
                if (match) {
                  nextUrl = match[1];
                  break;
                }
              }
            }
            
            resolve({ data: json, nextUrl });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
    });
    
    if (paginate && Array.isArray(result.data)) {
      allResults.push(...result.data);
      url = result.nextUrl || '';
      if (url) await delay(200); // Rate limiting between pages
    } else {
      return result.data as T;
    }
  }
  
  return allResults as T;
}

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    
    const doDownload = (downloadUrl: string) => {
      protocol.get(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${CANVAS_TOKEN}`,
        }
      }, (res) => {
        // Follow redirects
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            doDownload(redirectUrl);
            return;
          }
        }
        
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      }).on('error', (e) => {
        fs.unlink(destPath, () => {});
        console.error(`Download error: ${e.message}`);
        resolve(false);
      });
    };
    
    doDownload(url);
  });
}

async function getCourse(courseId: number): Promise<{ syllabus_body?: string; name: string } | null> {
  try {
    return await canvasGet(`/courses/${courseId}?include[]=syllabus_body`);
  } catch (e) {
    console.error(`Failed to get course ${courseId}:`, e);
    return null;
  }
}

async function getAssignments(courseId: number): Promise<Assignment[]> {
  try {
    const assignments = await canvasGet<Assignment[]>(`/courses/${courseId}/assignments?order_by=due_at`, true);
    return Array.isArray(assignments) ? assignments : [];
  } catch (e) {
    console.error(`Failed to get assignments for course ${courseId}:`, e);
    return [];
  }
}

async function getPages(courseId: number): Promise<PageWithBody[]> {
  try {
    const pages = await canvasGet<Page[]>(`/courses/${courseId}/pages?published=true`, true);
    if (!Array.isArray(pages)) return [];
    
    // Fetch body for each page
    const pagesWithBody: PageWithBody[] = [];
    for (const page of pages) {
      try {
        const fullPage = await canvasGet<PageWithBody>(`/courses/${courseId}/pages/${page.url}`);
        pagesWithBody.push(fullPage);
        await delay(100);
      } catch (e) {
        console.error(`Failed to get page ${page.title}:`, e);
      }
    }
    return pagesWithBody;
  } catch (e) {
    console.error(`Failed to get pages for course ${courseId}:`, e);
    return [];
  }
}

async function getModules(courseId: number): Promise<ModuleWithItems[]> {
  try {
    const modules = await canvasGet<Module[]>(`/courses/${courseId}/modules`, true);
    if (!Array.isArray(modules)) return [];
    
    // Fetch items for each module
    const modulesWithItems: ModuleWithItems[] = [];
    for (const mod of modules) {
      try {
        const items = await canvasGet<ModuleItem[]>(`/courses/${courseId}/modules/${mod.id}/items`, true);
        modulesWithItems.push({
          ...mod,
          items: Array.isArray(items) ? items : []
        });
        await delay(100);
      } catch (e) {
        console.error(`Failed to get items for module ${mod.name}:`, e);
        modulesWithItems.push({ ...mod, items: [] });
      }
    }
    return modulesWithItems;
  } catch (e) {
    console.error(`Failed to get modules for course ${courseId}:`, e);
    return [];
  }
}

async function getFolders(courseId: number): Promise<Folder[]> {
  try {
    const folders = await canvasGet<Folder[]>(`/courses/${courseId}/folders`, true);
    return Array.isArray(folders) ? folders : [];
  } catch (e) {
    console.error(`Failed to get folders for course ${courseId}:`, e);
    return [];
  }
}

async function getFiles(courseId: number): Promise<CanvasFile[]> {
  try {
    const files = await canvasGet<CanvasFile[]>(`/courses/${courseId}/files`, true);
    return Array.isArray(files) ? files : [];
  } catch (e) {
    console.error(`Failed to get files for course ${courseId}:`, e);
    return [];
  }
}

async function syncCourse(courseId: number, courseInfo: { id: string; name: string; tag: string }): Promise<CourseData> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 ${courseInfo.name} (${courseInfo.tag})`);
  console.log('='.repeat(60));
  
  const courseDir = path.join(FILES_DIR, courseInfo.id);
  if (!fs.existsSync(courseDir)) {
    fs.mkdirSync(courseDir, { recursive: true });
  }
  
  const courseData: CourseData = {
    id: courseId,
    slug: courseInfo.id,
    name: courseInfo.name,
    tag: courseInfo.tag,
    assignments: [],
    pages: [],
    modules: [],
    files: [],
    folders: [],
  };
  
  // 1. Get course details + syllabus
  console.log('📋 Fetching syllabus...');
  const course = await getCourse(courseId);
  if (course?.syllabus_body) {
    courseData.syllabus = course.syllabus_body;
    fs.writeFileSync(path.join(courseDir, 'syllabus.html'), course.syllabus_body);
    console.log('  ✅ Syllabus saved');
  } else {
    console.log('  ⚠️  No syllabus found');
  }
  await delay(200);
  
  // 2. Get assignments
  console.log('📝 Fetching assignments...');
  courseData.assignments = await getAssignments(courseId);
  console.log(`  ✅ Found ${courseData.assignments.length} assignments`);
  
  // Save assignments with full descriptions
  if (courseData.assignments.length > 0) {
    fs.writeFileSync(
      path.join(courseDir, 'assignments.json'),
      JSON.stringify(courseData.assignments, null, 2)
    );
  }
  await delay(200);
  
  // 3. Get pages
  console.log('📄 Fetching pages...');
  courseData.pages = await getPages(courseId);
  console.log(`  ✅ Found ${courseData.pages.length} pages`);
  
  // Save pages
  if (courseData.pages.length > 0) {
    const pagesDir = path.join(courseDir, 'pages');
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }
    
    for (const page of courseData.pages) {
      const safeFilename = page.url.replace(/[^a-z0-9-]/gi, '_');
      fs.writeFileSync(
        path.join(pagesDir, `${safeFilename}.html`),
        `<h1>${page.title}</h1>\n${page.body || ''}`
      );
    }
    
    fs.writeFileSync(
      path.join(courseDir, 'pages.json'),
      JSON.stringify(courseData.pages.map(p => ({ ...p, body: undefined })), null, 2)
    );
  }
  await delay(200);
  
  // 4. Get modules
  console.log('📦 Fetching modules...');
  courseData.modules = await getModules(courseId);
  console.log(`  ✅ Found ${courseData.modules.length} modules`);
  
  // Save modules
  if (courseData.modules.length > 0) {
    fs.writeFileSync(
      path.join(courseDir, 'modules.json'),
      JSON.stringify(courseData.modules, null, 2)
    );
  }
  await delay(200);
  
  // 5. Get folders
  console.log('📁 Fetching folders...');
  courseData.folders = await getFolders(courseId);
  console.log(`  ✅ Found ${courseData.folders.length} folders`);
  
  // Create folder lookup
  const folderMap = new Map<number, string>();
  for (const folder of courseData.folders) {
    folderMap.set(folder.id, folder.full_name);
  }
  await delay(200);
  
  // 6. Get and download files
  console.log('📎 Fetching files...');
  const files = await getFiles(courseId);
  console.log(`  📊 Found ${files.length} files`);
  
  for (const file of files) {
    const folderName = file.folder_id ? folderMap.get(file.folder_id) || '' : '';
    const safeFolder = folderName.replace(/[^a-z0-9-/]/gi, '_').replace(/^_+|_+$/g, '');
    const fileDir = safeFolder ? path.join(courseDir, safeFolder) : courseDir;
    const localPath = path.join(fileDir, file.display_name);
    const relativePath = path.relative(DATA_DIR, localPath);
    
    const fileInfo: FileInfo = {
      id: file.id,
      name: file.display_name,
      url: file.url,
      size: file.size,
      contentType: file['content-type'],
      folder: folderName,
      localPath: relativePath,
    };
    
    // Check if already downloaded
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size === file.size) {
        console.log(`  ⏭️  Skip: ${file.display_name}`);
        courseData.files.push(fileInfo);
        continue;
      }
    }
    
    console.log(`  ⬇️  Downloading: ${file.display_name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const success = await downloadFile(file.url, localPath);
    if (success) {
      console.log(`  ✅ Downloaded: ${file.display_name}`);
    } else {
      console.log(`  ❌ Failed: ${file.display_name}`);
      fileInfo.localPath = undefined;
    }
    
    courseData.files.push(fileInfo);
    await delay(300);
  }
  
  // Save file manifest
  fs.writeFileSync(
    path.join(courseDir, 'files.json'),
    JSON.stringify(courseData.files, null, 2)
  );
  
  // Save course summary
  const summary = {
    id: courseId,
    slug: courseInfo.id,
    name: courseInfo.name,
    tag: courseInfo.tag,
    hasSyllabus: !!courseData.syllabus,
    assignmentCount: courseData.assignments.length,
    pageCount: courseData.pages.length,
    moduleCount: courseData.modules.length,
    fileCount: courseData.files.length,
    syncedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(courseDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log(`\n📊 Course Summary:`);
  console.log(`   Syllabus: ${summary.hasSyllabus ? '✅' : '❌'}`);
  console.log(`   Assignments: ${summary.assignmentCount}`);
  console.log(`   Pages: ${summary.pageCount}`);
  console.log(`   Modules: ${summary.moduleCount}`);
  console.log(`   Files: ${summary.fileCount}`);
  
  return courseData;
}

async function main() {
  console.log('🎓 Canvas Full Content Sync');
  console.log('===========================');
  console.log(`📡 Canvas: ${CANVAS_BASE_URL}`);
  console.log(`📁 Data dir: ${DATA_DIR}`);
  console.log();
  
  if (!CANVAS_TOKEN) {
    console.error('❌ CANVAS_TOKEN not found in hub/.env');
    process.exit(1);
  }
  
  // Create directories
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
  
  const allCourses: CourseData[] = [];
  
  for (const [courseIdStr, courseInfo] of Object.entries(COURSE_MAP)) {
    const courseId = parseInt(courseIdStr);
    try {
      const courseData = await syncCourse(courseId, courseInfo);
      allCourses.push(courseData);
    } catch (e) {
      console.error(`\n❌ Failed to sync ${courseInfo.name}:`, e);
    }
    
    // Rate limit between courses
    await delay(1000);
  }
  
  // Create master index
  const index = {
    courses: allCourses.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      tag: c.tag,
      hasSyllabus: !!c.syllabus,
      assignmentCount: c.assignments.length,
      pageCount: c.pages.length,
      moduleCount: c.modules.length,
      fileCount: c.files.length,
    })),
    syncedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'index.json'),
    JSON.stringify(index, null, 2)
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total courses: ${allCourses.length}`);
  console.log(`Total assignments: ${allCourses.reduce((sum, c) => sum + c.assignments.length, 0)}`);
  console.log(`Total pages: ${allCourses.reduce((sum, c) => sum + c.pages.length, 0)}`);
  console.log(`Total modules: ${allCourses.reduce((sum, c) => sum + c.modules.length, 0)}`);
  console.log(`Total files: ${allCourses.reduce((sum, c) => sum + c.files.length, 0)}`);
  console.log(`\nData saved to: ${DATA_DIR}`);
}

main().catch(console.error);
