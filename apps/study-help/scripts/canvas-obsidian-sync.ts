#!/usr/bin/env npx tsx
/**
 * Canvas → Obsidian Sync
 * Downloads all Canvas content and organizes it in Obsidian vault
 * 
 * Usage: npx tsx scripts/canvas-obsidian-sync.ts
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

// Get Obsidian vault path
function getVaultPath(): string {
  try {
    const result = execSync('obsidian-cli print-default --path-only', { encoding: 'utf-8' }).trim();
    return result;
  } catch {
    // Fallback
    return '/Users/jddavenport/Documents/Obsidian/JD Vault';
  }
}

const VAULT_PATH = getVaultPath();
const MBA_PATH = path.join(VAULT_PATH, 'MBA', 'Winter 2026');

// Course mappings
const COURSE_MAP: Record<number, { id: string; name: string; folder: string }> = {
  32991: { id: 'mba560', name: 'Business Analytics', folder: 'MBA 560 - Business Analytics' },
  33202: { id: 'mba580', name: 'Business Strategy', folder: 'MBA 580 - Business Strategy' },
  33259: { id: 'entre', name: 'Entrepreneurial Innovation', folder: 'Entrepreneurial Innovation' },
  34458: { id: 'mba677', name: 'Entrepreneurship Through Acquisition', folder: 'MBA 677R - ETA' },
  34634: { id: 'mba693r', name: 'Post-MBA Career Strategy', folder: 'MBA 693R - Career Strategy' },
  34638: { id: 'mba664', name: 'VC/Private Equity', folder: 'MBA 664 - Venture Capital' },
  34642: { id: 'mba654', name: 'Strategic Client Acquisition', folder: 'MBA 654 - Client Acquisition' },
};

interface Assignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  submission_types: string[];
}

interface Module {
  id: number;
  name: string;
  position: number;
  items?: ModuleItem[];
}

interface ModuleItem {
  id: number;
  title: string;
  type: string;
  html_url?: string;
  external_url?: string;
  page_url?: string;
}

interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  'content-type': string;
}

interface Page {
  page_id: number;
  url: string;
  title: string;
  body?: string;
}

// Rate limiting
async function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function canvasGet<T>(endpoint: string, paginate = false): Promise<T> {
  const allResults: any[] = [];
  let url = `${CANVAS_BASE_URL}/api/v1${endpoint}`;
  
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
            reject(new Error(`Failed to parse: ${data.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
    });
    
    if (paginate && Array.isArray(result.data)) {
      allResults.push(...result.data);
      url = result.nextUrl || '';
      if (url) await delay(200);
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
    
    // Skip if exists and has content
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      if (stats.size > 0) {
        return resolve(true);
      }
    }
    
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    
    const doDownload = (downloadUrl: string) => {
      protocol.get(downloadUrl, {
        headers: { 'Authorization': `Bearer ${CANVAS_TOKEN}` }
      }, (res) => {
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
      }).on('error', () => {
        fs.unlink(destPath, () => {});
        resolve(false);
      });
    };
    
    doDownload(url);
  });
}

// Convert HTML to Markdown (simple conversion)
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  return html
    // Remove style/script tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    // Headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
    // Bold/italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Lists
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    // Paragraphs
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Divs/spans
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    // Images (keep as links for now)
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    // Tables (basic)
    .replace(/<table[^>]*>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    .replace(/<tr[^>]*>/gi, '| ')
    .replace(/<\/tr>/gi, ' |\n')
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '$1 | ')
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '$1 | ')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Clean up
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Create safe filename
function safeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

// Create obsidian:// link
function obsidianLink(vaultName: string, filePath: string): string {
  const encodedVault = encodeURIComponent(vaultName);
  const encodedPath = encodeURIComponent(filePath);
  return `obsidian://open?vault=${encodedVault}&file=${encodedPath}`;
}

async function syncCourse(courseId: number, courseInfo: { id: string; name: string; folder: string }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📚 ${courseInfo.name}`);
  console.log('='.repeat(60));
  
  const courseDir = path.join(MBA_PATH, courseInfo.folder);
  const resourcesDir = path.join(courseDir, 'Resources');
  const assignmentsDir = path.join(courseDir, 'Assignments');
  const modulesDir = path.join(courseDir, 'Modules');
  
  // Create directories
  [courseDir, resourcesDir, assignmentsDir, modulesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  const stats = {
    syllabus: false,
    assignments: 0,
    files: 0,
    modules: 0,
    pages: 0,
  };
  
  // 1. Get syllabus
  console.log('📋 Fetching syllabus...');
  try {
    const course = await canvasGet<{ syllabus_body?: string }>(`/courses/${courseId}?include[]=syllabus_body`);
    if (course.syllabus_body) {
      const syllabusContent = `# ${courseInfo.name} - Syllabus

${htmlToMarkdown(course.syllabus_body)}

---
*Synced from Canvas: ${new Date().toISOString().split('T')[0]}*
`;
      fs.writeFileSync(path.join(courseDir, 'Syllabus.md'), syllabusContent);
      stats.syllabus = true;
      console.log('  ✅ Syllabus saved');
    }
  } catch (e) {
    console.log('  ⚠️  No syllabus');
  }
  await delay(200);
  
  // 2. Get assignments
  console.log('📝 Fetching assignments...');
  try {
    const assignments = await canvasGet<Assignment[]>(`/courses/${courseId}/assignments?order_by=due_at`, true);
    if (Array.isArray(assignments)) {
      for (const assignment of assignments) {
        const safeName = safeFilename(assignment.name);
        const dueStr = assignment.due_at 
          ? new Date(assignment.due_at).toLocaleDateString('en-US', { 
              weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit'
            })
          : 'No due date';
        
        const content = `# ${assignment.name}

> [!info] Assignment Info
> **Due:** ${dueStr}
> **Points:** ${assignment.points_possible || 'N/A'}
> **Canvas:** [Open in Canvas](${assignment.html_url})

## Description

${htmlToMarkdown(assignment.description) || '*No description provided*'}

---
*Synced from Canvas: ${new Date().toISOString().split('T')[0]}*
`;
        
        fs.writeFileSync(path.join(assignmentsDir, `${safeName}.md`), content);
        stats.assignments++;
      }
      console.log(`  ✅ ${stats.assignments} assignments saved`);
    }
  } catch (e) {
    console.log('  ⚠️  Could not fetch assignments');
  }
  await delay(200);
  
  // 3. Get files
  console.log('📎 Fetching files...');
  try {
    const files = await canvasGet<CanvasFile[]>(`/courses/${courseId}/files`, true);
    if (Array.isArray(files)) {
      for (const file of files) {
        const destPath = path.join(resourcesDir, file.display_name);
        
        // Skip if exists
        if (fs.existsSync(destPath)) {
          console.log(`  ⏭️  Skip: ${file.display_name}`);
          stats.files++;
          continue;
        }
        
        console.log(`  ⬇️  ${file.display_name}`);
        const success = await downloadFile(file.url, destPath);
        if (success) {
          stats.files++;
        }
        await delay(300);
      }
      console.log(`  ✅ ${stats.files} files`);
    }
  } catch (e) {
    console.log('  ⚠️  Could not fetch files');
  }
  await delay(200);
  
  // 4. Get modules
  console.log('📦 Fetching modules...');
  try {
    const modules = await canvasGet<Module[]>(`/courses/${courseId}/modules`, true);
    if (Array.isArray(modules) && modules.length > 0) {
      for (const mod of modules) {
        // Get module items
        const items = await canvasGet<ModuleItem[]>(`/courses/${courseId}/modules/${mod.id}/items`, true);
        mod.items = Array.isArray(items) ? items : [];
        await delay(100);
      }
      
      // Create module index
      let moduleContent = `# ${courseInfo.name} - Modules\n\n`;
      
      for (const mod of modules.sort((a, b) => a.position - b.position)) {
        moduleContent += `## ${mod.name}\n\n`;
        
        if (mod.items && mod.items.length > 0) {
          for (const item of mod.items) {
            const link = item.html_url || item.external_url || '';
            if (link) {
              moduleContent += `- [${item.title}](${link})\n`;
            } else {
              moduleContent += `- ${item.title}\n`;
            }
          }
        } else {
          moduleContent += '*No items*\n';
        }
        moduleContent += '\n';
        stats.modules++;
      }
      
      moduleContent += `---\n*Synced from Canvas: ${new Date().toISOString().split('T')[0]}*\n`;
      fs.writeFileSync(path.join(modulesDir, '_Index.md'), moduleContent);
      console.log(`  ✅ ${stats.modules} modules`);
    }
  } catch (e) {
    console.log('  ⚠️  Could not fetch modules');
  }
  await delay(200);
  
  // 5. Get pages
  console.log('📄 Fetching pages...');
  try {
    const pages = await canvasGet<Page[]>(`/courses/${courseId}/pages?published=true`, true);
    if (Array.isArray(pages) && pages.length > 0) {
      const pagesDir = path.join(courseDir, 'Pages');
      if (!fs.existsSync(pagesDir)) {
        fs.mkdirSync(pagesDir, { recursive: true });
      }
      
      for (const page of pages) {
        const fullPage = await canvasGet<Page>(`/courses/${courseId}/pages/${page.url}`);
        const safeName = safeFilename(page.title);
        
        const content = `# ${page.title}

${htmlToMarkdown(fullPage.body || '')}

---
*Synced from Canvas: ${new Date().toISOString().split('T')[0]}*
`;
        
        fs.writeFileSync(path.join(pagesDir, `${safeName}.md`), content);
        stats.pages++;
        await delay(100);
      }
      console.log(`  ✅ ${stats.pages} pages`);
    }
  } catch (e) {
    console.log('  ⚠️  Could not fetch pages');
  }
  
  // 6. Create course index
  const vaultName = path.basename(VAULT_PATH);
  const relativeCoursePath = path.relative(VAULT_PATH, courseDir);
  
  let indexContent = `# ${courseInfo.name}

> [!tip] Quick Links
> - [[Syllabus|📋 Syllabus]]
> - [[Assignments/_Index|📝 Assignments]]
> - [[Modules/_Index|📦 Modules]]
> - [[Resources/|📎 Resources]]

## Overview

| Item | Count |
|------|-------|
| Assignments | ${stats.assignments} |
| Modules | ${stats.modules} |
| Files | ${stats.files} |
| Pages | ${stats.pages} |

## Recent Assignments

`;

  // Add upcoming assignments
  try {
    const assignments = await canvasGet<Assignment[]>(`/courses/${courseId}/assignments?order_by=due_at`, true);
    const upcoming = (Array.isArray(assignments) ? assignments : [])
      .filter(a => a.due_at && new Date(a.due_at) > new Date())
      .slice(0, 5);
    
    if (upcoming.length > 0) {
      for (const a of upcoming) {
        const safeName = safeFilename(a.name);
        const due = new Date(a.due_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        indexContent += `- [[Assignments/${safeName}|${a.name}]] - Due ${due}\n`;
      }
    } else {
      indexContent += '*No upcoming assignments*\n';
    }
  } catch {
    indexContent += '*Could not load assignments*\n';
  }

  indexContent += `
## Resources

`;

  // List key resources (PDFs)
  const resourceFiles = fs.existsSync(resourcesDir) ? fs.readdirSync(resourcesDir) : [];
  const pdfs = resourceFiles.filter(f => f.toLowerCase().endsWith('.pdf')).slice(0, 10);
  
  if (pdfs.length > 0) {
    for (const pdf of pdfs) {
      indexContent += `- [[Resources/${pdf}|📄 ${pdf}]]\n`;
    }
    if (resourceFiles.length > pdfs.length) {
      indexContent += `\n*...and ${resourceFiles.length - pdfs.length} more files*\n`;
    }
  } else {
    indexContent += '*No resource files*\n';
  }

  indexContent += `
---
*Last synced: ${new Date().toISOString().split('T')[0]}*
`;

  fs.writeFileSync(path.join(courseDir, '_Index.md'), indexContent);

  // Create assignments index
  const assignmentFiles = fs.existsSync(assignmentsDir) ? fs.readdirSync(assignmentsDir).filter(f => f.endsWith('.md')) : [];
  if (assignmentFiles.length > 0) {
    let assignmentIndex = `# ${courseInfo.name} - Assignments\n\n`;
    for (const file of assignmentFiles.sort()) {
      const name = file.replace('.md', '');
      assignmentIndex += `- [[${name}]]\n`;
    }
    fs.writeFileSync(path.join(assignmentsDir, '_Index.md'), assignmentIndex);
  }
  
  console.log(`\n📊 Summary: ${stats.assignments} assignments, ${stats.modules} modules, ${stats.files} files, ${stats.pages} pages`);
  
  return stats;
}

async function main() {
  console.log('🎓 Canvas → Obsidian Sync');
  console.log('===========================');
  console.log(`📁 Vault: ${VAULT_PATH}`);
  console.log(`📁 MBA: ${MBA_PATH}`);
  console.log();
  
  if (!CANVAS_TOKEN) {
    console.error('❌ CANVAS_TOKEN not found');
    process.exit(1);
  }
  
  // Create MBA directory
  if (!fs.existsSync(MBA_PATH)) {
    fs.mkdirSync(MBA_PATH, { recursive: true });
  }
  
  const totals = {
    syllabus: 0,
    assignments: 0,
    files: 0,
    modules: 0,
    pages: 0,
  };
  
  for (const [courseIdStr, courseInfo] of Object.entries(COURSE_MAP)) {
    const courseId = parseInt(courseIdStr);
    try {
      const stats = await syncCourse(courseId, courseInfo);
      totals.syllabus += stats.syllabus ? 1 : 0;
      totals.assignments += stats.assignments;
      totals.files += stats.files;
      totals.modules += stats.modules;
      totals.pages += stats.pages;
    } catch (e) {
      console.error(`\n❌ Failed to sync ${courseInfo.name}:`, e);
    }
    await delay(1000);
  }
  
  // Create MBA index
  let mbaIndex = `# MBA Winter 2026

## Courses

`;

  for (const courseInfo of Object.values(COURSE_MAP)) {
    mbaIndex += `- [[${courseInfo.folder}/_Index|${courseInfo.name}]]\n`;
  }

  mbaIndex += `
## Quick Stats

| Item | Count |
|------|-------|
| Syllabi | ${totals.syllabus} |
| Assignments | ${totals.assignments} |
| Files | ${totals.files} |
| Modules | ${totals.modules} |
| Pages | ${totals.pages} |

---
*Last synced: ${new Date().toISOString().split('T')[0]}*
`;

  fs.writeFileSync(path.join(MBA_PATH, '_Index.md'), mbaIndex);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Syllabi: ${totals.syllabus}`);
  console.log(`Assignments: ${totals.assignments}`);
  console.log(`Files: ${totals.files}`);
  console.log(`Modules: ${totals.modules}`);
  console.log(`Pages: ${totals.pages}`);
  console.log(`\nOpen in Obsidian: ${MBA_PATH}`);
}

main().catch(console.error);
