/**
 * Canvas Materials Text Extraction Pipeline
 * 
 * Extracts text from all canvas_materials with NULL extracted_text.
 * Standalone script - creates its own DB connection to avoid env.ts issues.
 * 
 * Usage: npx tsx hub/src/scripts/extract-materials.ts [--dry-run] [--limit N]
 */

import pg from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

// Load env
// Try multiple paths to find .env
const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'hub/../.env'),
  '/Users/jddavenport/Projects/JD Agent/.env',
];
for (const p of candidates) {
  try {
    await fs.access(p);
    dotenv.config({ path: p });
    break;
  } catch { /* try next */ }
}

const CANVAS_BASE = 'https://byu.instructure.com';
const TOKEN = process.env.CANVAS_TOKEN!;
const DATABASE_URL = process.env.DATABASE_URL!;

if (!TOKEN) { console.error('Missing CANVAS_TOKEN'); process.exit(1); }
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : undefined;

// DB connection
const pool = new pg.Pool({ connectionString: DATABASE_URL });

// ============================================
// Canvas API helpers
// ============================================

async function canvasGet<T>(endpoint: string): Promise<T> {
  const url = `${CANVAS_BASE}/api/v1${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Canvas ${res.status}: ${await res.text().then(t => t.substring(0, 200))}`);
  return res.json() as Promise<T>;
}

async function canvasDownload(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ============================================
// Text extraction
// ============================================

async function extractFromPdf(data: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(data);
  return result.text?.trim() || '';
}

async function extractFromDocx(data: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value?.trim() || '';
}

async function extractFromHtml(html: string): Promise<string> {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

// Module items cache: courseId -> items[]
const moduleItemsCache = new Map<string, any[]>();

async function getAllModuleItems(courseId: string): Promise<any[]> {
  if (moduleItemsCache.has(courseId)) return moduleItemsCache.get(courseId)!;
  
  const allItems: any[] = [];
  try {
    const modules = await canvasGet<any[]>(`/courses/${courseId}/modules?per_page=100`);
    for (const mod of modules) {
      try {
        const items = await canvasGet<any[]>(`/courses/${courseId}/modules/${mod.id}/items?per_page=100`);
        allItems.push(...items);
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 100)); // rate limit
    }
  } catch (e) {
    console.log(`  Warning: couldn't fetch modules for course ${courseId}`);
  }
  moduleItemsCache.set(courseId, allItems);
  return allItems;
}

async function getPageContent(courseId: string, moduleItemId: string): Promise<string> {
  const items = await getAllModuleItems(courseId);
  const item = items.find((i: any) => String(i.id) === moduleItemId);
  if (item?.page_url) {
    const page = await canvasGet<any>(`/courses/${courseId}/pages/${item.page_url}`);
    return page.body || '';
  }
  return '';
}

async function downloadCanvasFile(fileId: string): Promise<Buffer | null> {
  try {
    const file = await canvasGet<any>(`/files/${fileId}`);
    if (!file.url) return null;
    return await canvasDownload(file.url);
  } catch (e: any) {
    console.error(`  Failed to download file ${fileId}: ${e.message}`);
    return null;
  }
}

// ============================================
// Main extraction per material
// ============================================

async function extractMaterial(m: any): Promise<string | null> {
  const { file_type, canvas_file_id, local_path, download_url, file_name, canvas_course_id } = m;

  // Pages - fetch HTML from Canvas
  if (file_type === 'page') {
    if (!canvas_course_id || !canvas_file_id) return null;
    console.log(`  Fetching page from Canvas...`);
    const html = await getPageContent(canvas_course_id, canvas_file_id);
    if (!html) return null;
    return await extractFromHtml(html);
  }

  // Links/URLs
  if (file_type === 'link' || file_type === 'url') {
    if (!download_url) return null;
    try {
      console.log(`  Fetching URL...`);
      const res = await fetch(download_url, { redirect: 'follow' });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('pdf')) {
        const data = Buffer.from(await res.arrayBuffer());
        return await extractFromPdf(data);
      }
      const html = await res.text();
      return await extractFromHtml(html);
    } catch { return null; }
  }

  // Files (file, pdf, document, book, packet)
  let data: Buffer | null = null;

  if (local_path) {
    try { data = await fs.readFile(local_path); } catch { /* fall through */ }
  }

  if (!data && canvas_file_id) {
    console.log(`  Downloading file ${canvas_file_id}...`);
    data = await downloadCanvasFile(canvas_file_id);
  }

  if (!data) return null;

  const ext = path.extname(file_name || '').toLowerCase();

  // Try PDF
  if (ext === '.pdf' || file_type === 'pdf' || data[0] === 0x25) {
    try { return await extractFromPdf(data); } catch { /* not PDF */ }
  }

  // Try DOCX
  if (ext === '.docx' || ext === '.doc') {
    try { return await extractFromDocx(data); } catch { /* not docx */ }
  }

  // Try HTML
  if (ext === '.html' || ext === '.htm') {
    return await extractFromHtml(data.toString('utf-8'));
  }

  // Fallback: try PDF then plain text
  try { return await extractFromPdf(data); } catch { /* nope */ }
  
  const text = data.toString('utf-8').trim();
  if (text && !text.includes('\x00') && text.length > 10) return text;

  return null;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('=== Canvas Materials Text Extraction Pipeline ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${LIMIT ? ` (limit: ${LIMIT})` : ''}\n`);

  // Query materials with NULL extracted_text, join with classes for canvas_course_id
  const q = `
    SELECT cm.*, c.canvas_course_id 
    FROM canvas_materials cm 
    LEFT JOIN classes c ON cm.course_id = c.id 
    WHERE cm.extracted_text IS NULL
    ORDER BY cm.created_at
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `;
  
  const { rows: materials } = await pool.query(q);
  console.log(`Found ${materials.length} materials with NULL extracted_text\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    console.log(`[${i + 1}/${materials.length}] ${m.file_name} (${m.file_type})`);

    if (DRY_RUN) {
      console.log(`  Would extract (dry run)\n`);
      continue;
    }

    try {
      const text = await extractMaterial(m);

      if (text && text.length > 10) {
        const truncated = text.substring(0, 100000);
        await pool.query(
          `UPDATE canvas_materials SET extracted_text = $1, updated_at = NOW() WHERE id = $2`,
          [truncated, m.id]
        );
        console.log(`  ✅ ${truncated.length} chars\n`);
        success++;
      } else {
        console.log(`  ⚠️ No text extracted\n`);
        failed++;
      }
    } catch (e: any) {
      console.log(`  ❌ ${e.message}\n`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Results ===`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${materials.length}`);

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
