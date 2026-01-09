/**
 * Smart Data Recovery Migration
 *
 * Recovers corrupted data from Apple Notes, Notion, Todoist, and Google Drive
 * with intelligent categorization into organized buckets.
 *
 * Buckets:
 * - Reference
 *   - Sites (usernames, passwords, credentials)
 *   - Family (Sam, JD, Ava, John info)
 *   - People (contacts database)
 *   - Documents (important docs)
 * - Archive
 *   - Old Journal (pre-2026 journal entries)
 *   - Todoist Archive (old tasks)
 *   - Notes Archive (ambiguous notes)
 *   - Notion Archive (ambiguous notion)
 *   - Work Archive (old work items)
 * - MBA
 *   - Winter 2026 (current semester)
 *   - School Archive (older semesters)
 * - Professional
 *   - Resumes
 *   - Job Applications
 *   - Career Planning
 * - Personal
 *   - Journal (2026+ entries)
 *   - Health & Fitness
 *   - Travel & Trips
 *   - Goals & Plans
 * - Inbox (needs review)
 *
 * Usage:
 *   bun run src/migration/smart-data-recovery.ts --dry-run
 *   bun run src/migration/smart-data-recovery.ts --execute
 *   bun run src/migration/smart-data-recovery.ts --execute --source=apple-notes
 *   bun run src/migration/smart-data-recovery.ts --execute --source=google-drive
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables from root .env file
function loadEnv() {
  const rootEnvPath = join(import.meta.dir, '../../../.env');
  if (existsSync(rootEnvPath)) {
    const envContent = readFileSync(rootEnvPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    console.log('Loaded environment from root .env');
  }
}
loadEnv();

import { db } from '../db/client';
import { vaultEntries } from '../db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import OpenAI from 'openai';

// ============================================
// Configuration
// ============================================

const isDryRun = !process.argv.includes('--execute');
const sourceFilter = process.argv.find(a => a.startsWith('--source='))?.split('=')[1];

// Family member names for detection
const FAMILY_NAMES = ['sam', 'samantha', 'jd', 'ava', 'john', 'davenport'];

// Class/MBA keywords
const MBA_KEYWORDS = [
  'mba', 'byu', 'marriott', 'finance', 'accounting', 'strategy',
  'economics', 'marketing', 'operations', 'mgmt', 'management',
  'syllabus', 'midterm', 'final', 'homework', 'assignment',
  'lecture', 'case study', 'harvard business', 'gmat', 'mgsm',
  'business school', 'semester', 'quarter', 'credit', 'grade'
];

// Professional keywords
const PROFESSIONAL_KEYWORDS = [
  'resume', 'cv', 'curriculum vitae', 'cover letter', 'job',
  'career', 'interview', 'salary', 'offer letter', 'linkedin',
  'application', 'portfolio', 'reference', 'recommendation',
  'hire', 'hiring', 'position', 'employment', 'work history'
];

// Credential/site keywords
const CREDENTIAL_KEYWORDS = [
  'password', 'login', 'username', 'credential', 'account',
  'ssn', 'social security', 'pin', 'security', 'secret',
  'api key', 'token', 'auth', 'access code', '2fa', 'mfa'
];

// Health keywords
const HEALTH_KEYWORDS = [
  'gym', 'workout', 'exercise', 'fitness', 'health', 'doctor',
  'medical', 'prescription', 'vitamin', 'weight', 'diet',
  'sleep', 'mental health', 'therapy', 'dentist', 'potty'
];

// ============================================
// Bucket Structure
// ============================================

interface BucketDefinition {
  title: string;
  context: string;
  children?: BucketDefinition[];
}

const BUCKET_STRUCTURE: BucketDefinition[] = [
  {
    title: 'Reference',
    context: 'Reference',
    children: [
      { title: 'Sites & Credentials', context: 'Reference' },
      { title: 'Family', context: 'Reference', children: [
        { title: 'Sam', context: 'Reference' },
        { title: 'JD', context: 'Reference' },
        { title: 'Ava', context: 'Reference' },
        { title: 'John', context: 'Reference' },
      ]},
      { title: 'People', context: 'Reference' },
      { title: 'Documents', context: 'Reference' },
    ]
  },
  {
    title: 'Archive',
    context: 'Archive',
    children: [
      { title: 'Old Journal', context: 'Archive' },
      { title: 'Todoist Archive', context: 'Archive' },
      { title: 'Notes Archive', context: 'Archive' },
      { title: 'Notion Archive', context: 'Archive' },
      { title: 'Work Archive', context: 'Archive' },
    ]
  },
  {
    title: 'MBA',
    context: 'School',
    children: [
      { title: '2026 Winter Semester', context: 'School' },
      { title: 'School Archive', context: 'School' },
    ]
  },
  {
    title: 'Professional',
    context: 'Professional',
    children: [
      { title: 'Resumes', context: 'Professional' },
      { title: 'Job Applications', context: 'Professional' },
      { title: 'Career Planning', context: 'Professional' },
    ]
  },
  {
    title: 'Personal',
    context: 'Personal',
    children: [
      { title: 'Journal', context: 'Personal' },
      { title: 'Health & Fitness', context: 'Personal' },
      { title: 'Travel & Trips', context: 'Personal' },
      { title: 'Goals & Plans', context: 'Personal' },
    ]
  },
  {
    title: 'Inbox',
    context: 'Inbox',
  }
];

// ============================================
// Bucket IDs (populated during creation)
// ============================================

const bucketIds: Record<string, string> = {};

// ============================================
// Statistics
// ============================================

interface MigrationStats {
  foldersCreated: number;
  entriesProcessed: number;
  entriesCategorized: Record<string, number>;
  errors: string[];
  sources: Record<string, number>;
}

const stats: MigrationStats = {
  foldersCreated: 0,
  entriesProcessed: 0,
  entriesCategorized: {},
  errors: [],
  sources: {},
};

// ============================================
// Smart Categorization
// ============================================

interface CategorizeResult {
  bucket: string;
  subBucket?: string;
  contentType: string;
  tags: string[];
  confidence: number;
}

function categorizeEntry(
  title: string,
  content: string,
  source: string,
  sourcePath: string,
  createdAt: Date
): CategorizeResult {
  const lowerTitle = title.toLowerCase();
  const lowerContent = (content || '').toLowerCase();
  const lowerPath = (sourcePath || '').toLowerCase();
  const combined = `${lowerTitle} ${lowerContent} ${lowerPath}`;

  // ----------------------------------------
  // 1. CREDENTIALS & SITES
  // ----------------------------------------
  if (CREDENTIAL_KEYWORDS.some(kw => combined.includes(kw))) {
    return {
      bucket: 'Reference',
      subBucket: 'Sites & Credentials',
      contentType: 'reference',
      tags: ['credential', 'security', 'important'],
      confidence: 0.9,
    };
  }

  // ----------------------------------------
  // 2. FAMILY MEMBERS
  // ----------------------------------------
  for (const name of FAMILY_NAMES) {
    // Check if it's about a family member (not just mentioning them)
    const titleHasName = lowerTitle.includes(name);
    const pathHasName = lowerPath.includes(name);
    const isFamilyFolder = lowerPath.includes('family');

    if (titleHasName || (pathHasName && isFamilyFolder)) {
      const displayName = name === 'sam' || name === 'samantha' ? 'Sam' :
                          name === 'jd' ? 'JD' :
                          name === 'ava' ? 'Ava' :
                          name === 'john' ? 'John' : name;
      return {
        bucket: 'Reference',
        subBucket: displayName,
        contentType: 'reference',
        tags: ['family', name, 'personal'],
        confidence: 0.85,
      };
    }
  }

  // ----------------------------------------
  // 3. PROFESSIONAL & RESUMES
  // ----------------------------------------
  if (PROFESSIONAL_KEYWORDS.some(kw => combined.includes(kw))) {
    // Specific sub-bucket detection
    if (lowerTitle.includes('resume') || lowerTitle.includes('cv') ||
        lowerContent.includes('experience') && lowerContent.includes('education') && lowerContent.includes('skills')) {
      return {
        bucket: 'Professional',
        subBucket: 'Resumes',
        contentType: 'resume',
        tags: ['resume', 'career', 'important'],
        confidence: 0.95,
      };
    }
    if (lowerTitle.includes('application') || lowerTitle.includes('cover letter') ||
        lowerTitle.includes('job') || lowerPath.includes('job')) {
      return {
        bucket: 'Professional',
        subBucket: 'Job Applications',
        contentType: 'document',
        tags: ['job-search', 'career', 'application'],
        confidence: 0.85,
      };
    }
    return {
      bucket: 'Professional',
      subBucket: 'Career Planning',
      contentType: 'note',
      tags: ['career', 'planning'],
      confidence: 0.75,
    };
  }

  // ----------------------------------------
  // 4. MBA & SCHOOL
  // ----------------------------------------
  if (MBA_KEYWORDS.some(kw => combined.includes(kw)) ||
      lowerPath.includes('class') || lowerPath.includes('school')) {

    // Is it current (2026) or archive?
    const is2026 = lowerTitle.includes('2026') || lowerPath.includes('2026') ||
                   lowerContent.includes('2026') || (createdAt >= new Date('2026-01-01'));
    const isWinter = lowerTitle.includes('winter') || lowerPath.includes('winter');

    if (is2026 || isWinter) {
      return {
        bucket: 'MBA',
        subBucket: '2026 Winter Semester',
        contentType: 'class_notes',
        tags: ['mba', 'school', 'current'],
        confidence: 0.9,
      };
    }
    return {
      bucket: 'MBA',
      subBucket: 'School Archive',
      contentType: 'class_notes',
      tags: ['mba', 'school', 'archive'],
      confidence: 0.8,
    };
  }

  // ----------------------------------------
  // 5. HEALTH & FITNESS
  // ----------------------------------------
  if (HEALTH_KEYWORDS.some(kw => combined.includes(kw))) {
    return {
      bucket: 'Personal',
      subBucket: 'Health & Fitness',
      contentType: 'note',
      tags: ['health', 'fitness', 'personal'],
      confidence: 0.8,
    };
  }

  // ----------------------------------------
  // 6. JOURNAL ENTRIES
  // ----------------------------------------
  if (lowerTitle.includes('journal') || lowerPath.includes('journal') ||
      lowerTitle.match(/^\d{4}-\d{2}-\d{2}/) || // Date format title
      lowerContent.includes('today i') || lowerContent.includes('i feel')) {

    // Old vs new journal
    if (createdAt < new Date('2026-01-01')) {
      return {
        bucket: 'Archive',
        subBucket: 'Old Journal',
        contentType: 'journal',
        tags: ['journal', 'personal', 'archive'],
        confidence: 0.85,
      };
    }
    return {
      bucket: 'Personal',
      subBucket: 'Journal',
      contentType: 'journal',
      tags: ['journal', 'personal', 'reflection'],
      confidence: 0.85,
    };
  }

  // ----------------------------------------
  // 7. TRAVEL & TRIPS
  // ----------------------------------------
  if (lowerTitle.includes('trip') || lowerTitle.includes('travel') ||
      lowerTitle.includes('vacation') || lowerTitle.includes('itinerary') ||
      lowerTitle.includes('hotel') || lowerTitle.includes('flight')) {
    return {
      bucket: 'Personal',
      subBucket: 'Travel & Trips',
      contentType: 'note',
      tags: ['travel', 'planning', 'personal'],
      confidence: 0.8,
    };
  }

  // ----------------------------------------
  // 8. GOALS & PLANS
  // ----------------------------------------
  if (lowerTitle.includes('goal') || lowerTitle.includes('plan') ||
      lowerTitle.includes('objective') || lowerContent.includes('i want to')) {
    return {
      bucket: 'Personal',
      subBucket: 'Goals & Plans',
      contentType: 'note',
      tags: ['goals', 'planning', 'personal'],
      confidence: 0.75,
    };
  }

  // ----------------------------------------
  // 9. PEOPLE / CONTACTS
  // ----------------------------------------
  if (lowerTitle.includes('[person]') || lowerPath.includes('people') ||
      lowerTitle.includes('contact') || lowerTitle.includes('doctor') ||
      /^\d{10,}$/.test(title.replace(/\D/g, ''))) {
    return {
      bucket: 'Reference',
      subBucket: 'People',
      contentType: 'reference',
      tags: ['contact', 'people', 'reference'],
      confidence: 0.8,
    };
  }

  // ----------------------------------------
  // 10. SOURCE-BASED ARCHIVE
  // ----------------------------------------
  if (source === 'todoist' || source === 'manual' && lowerPath.includes('todoist')) {
    return {
      bucket: 'Archive',
      subBucket: 'Todoist Archive',
      contentType: 'task_archive',
      tags: ['todoist', 'tasks', 'archive'],
      confidence: 0.7,
    };
  }

  if (source === 'notion') {
    // Only ambiguous notion content goes to archive
    return {
      bucket: 'Archive',
      subBucket: 'Notion Archive',
      contentType: 'note',
      tags: ['notion', 'imported', 'needs-review'],
      confidence: 0.5,
    };
  }

  if (source === 'apple_notes') {
    return {
      bucket: 'Archive',
      subBucket: 'Notes Archive',
      contentType: 'note',
      tags: ['apple-notes', 'imported', 'needs-review'],
      confidence: 0.5,
    };
  }

  // ----------------------------------------
  // 11. WORK ITEMS (historical)
  // ----------------------------------------
  if (lowerPath.includes('work') || lowerTitle.includes('meeting') ||
      lowerTitle.includes('standup') || lowerTitle.includes('sprint')) {
    return {
      bucket: 'Archive',
      subBucket: 'Work Archive',
      contentType: 'meeting_notes',
      tags: ['work', 'archive', 'historical'],
      confidence: 0.7,
    };
  }

  // ----------------------------------------
  // 12. REFERENCE DOCUMENTS
  // ----------------------------------------
  if (lowerTitle.includes('document') || lowerTitle.includes('important') ||
      lowerPath.includes('documents') || lowerPath.includes('important')) {
    return {
      bucket: 'Reference',
      subBucket: 'Documents',
      contentType: 'document',
      tags: ['document', 'reference', 'important'],
      confidence: 0.7,
    };
  }

  // ----------------------------------------
  // DEFAULT: Inbox for manual review
  // ----------------------------------------
  return {
    bucket: 'Inbox',
    contentType: 'note',
    tags: ['needs-review', 'imported', 'uncategorized'],
    confidence: 0.3,
  };
}

// ============================================
// AI-Enhanced Categorization (optional)
// ============================================

async function aiCategorize(
  title: string,
  content: string,
  source: string,
  openai: OpenAI
): Promise<CategorizeResult | null> {
  try {
    const prompt = `You are categorizing content for a personal knowledge vault.

**Buckets available:**
1. Reference/Sites & Credentials - passwords, logins, accounts
2. Reference/Family/[Sam|JD|Ava|John] - family member info
3. Reference/People - contacts, doctors, other people
4. Reference/Documents - important documents
5. Archive/Old Journal - pre-2026 journal entries
6. Archive/Todoist Archive - old tasks
7. Archive/Notes Archive - ambiguous apple notes
8. Archive/Notion Archive - ambiguous notion content
9. Archive/Work Archive - old work items
10. MBA/2026 Winter Semester - current school
11. MBA/School Archive - old school content
12. Professional/Resumes - CVs and resumes
13. Professional/Job Applications - job apps, cover letters
14. Professional/Career Planning - career planning
15. Personal/Journal - 2026+ journal entries
16. Personal/Health & Fitness - health, gym, medical
17. Personal/Travel & Trips - travel planning
18. Personal/Goals & Plans - goals, objectives
19. Inbox - needs manual review

**Content:**
Title: ${title}
Source: ${source}
Content preview: ${content.substring(0, 500)}

**Return JSON only:**
{
  "bucket": "parent bucket name",
  "subBucket": "child bucket name or null",
  "contentType": "note|document|resume|journal|class_notes|meeting_notes|reference|task_archive",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 256,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    if (result.bucket) {
      return result as CategorizeResult;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// ============================================
// Create Bucket Structure
// ============================================

async function createBucketStructure(
  buckets: BucketDefinition[],
  parentId: string | null = null,
  depth = 0
): Promise<void> {
  const indent = '  '.repeat(depth);

  // In dry run mode with a fake parent, skip database queries
  const isDryRunParent = parentId?.startsWith('dry-run-') ?? false;

  for (const bucket of buckets) {
    if (isDryRun && isDryRunParent) {
      // In dry run with fake parent, just print and continue
      console.log(`${indent}[WOULD CREATE] ${bucket.title}`);
      bucketIds[bucket.title] = `dry-run-${bucket.title}`;
    } else {
      // Check if exists
      const whereClause = parentId
        ? and(eq(vaultEntries.title, bucket.title), eq(vaultEntries.parentId, parentId))
        : and(eq(vaultEntries.title, bucket.title), isNull(vaultEntries.parentId));

      const existing = await db.select({ id: vaultEntries.id })
        .from(vaultEntries)
        .where(whereClause)
        .limit(1);

      if (existing.length > 0) {
        bucketIds[bucket.title] = existing[0].id;
        console.log(`${indent}[EXISTS] ${bucket.title} (${existing[0].id})`);
      } else if (isDryRun) {
        console.log(`${indent}[WOULD CREATE] ${bucket.title}`);
        bucketIds[bucket.title] = `dry-run-${bucket.title}`;
      } else {
        const [created] = await db.insert(vaultEntries)
          .values({
            title: bucket.title,
            content: `# ${bucket.title}\n\nOrganization bucket for ${bucket.context.toLowerCase()} content.`,
            context: bucket.context,
            contentType: 'note',
            source: 'manual',
            parentId,
            tags: ['folder', 'organization', 'bucket'],
          })
          .returning({ id: vaultEntries.id });

        bucketIds[bucket.title] = created.id;
        stats.foldersCreated++;
        console.log(`${indent}[CREATED] ${bucket.title} (${created.id})`);
      }
    }

    // Create children
    if (bucket.children) {
      await createBucketStructure(bucket.children, bucketIds[bucket.title], depth + 1);
    }
  }
}

// ============================================
// Import Helpers
// ============================================

interface RawEntry {
  title: string;
  content: string;
  source: string;
  sourceId: string;
  sourceUrl?: string;
  sourcePath?: string;
  createdAt: Date;
  modifiedAt: Date;
}

async function importEntry(entry: RawEntry): Promise<void> {
  // Categorize
  const category = categorizeEntry(
    entry.title,
    entry.content,
    entry.source,
    entry.sourcePath || '',
    entry.createdAt
  );

  // Get bucket ID
  const parentId = category.subBucket
    ? bucketIds[category.subBucket]
    : bucketIds[category.bucket];

  if (!parentId && !isDryRun) {
    stats.errors.push(`No bucket found for: ${entry.title} -> ${category.bucket}/${category.subBucket}`);
    return;
  }

  // Track stats
  const bucketKey = category.subBucket || category.bucket;
  stats.entriesCategorized[bucketKey] = (stats.entriesCategorized[bucketKey] || 0) + 1;
  stats.sources[entry.source] = (stats.sources[entry.source] || 0) + 1;
  stats.entriesProcessed++;

  if (isDryRun) {
    if (stats.entriesProcessed <= 20) {
      console.log(`  [WOULD IMPORT] "${entry.title.substring(0, 50)}..." -> ${category.bucket}/${category.subBucket || ''}`);
    }
    return;
  }

  // Check for duplicate
  const existing = await db.select({ id: vaultEntries.id })
    .from(vaultEntries)
    .where(and(
      eq(vaultEntries.title, entry.title),
      eq(vaultEntries.source, entry.source)
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db.update(vaultEntries)
      .set({
        parentId,
        context: category.bucket,
        contentType: category.contentType,
        tags: category.tags,
        updatedAt: new Date(),
      })
      .where(eq(vaultEntries.id, existing[0].id));
  } else {
    // Insert new
    await db.insert(vaultEntries).values({
      title: entry.title,
      content: entry.content,
      parentId,
      context: category.bucket,
      contentType: category.contentType,
      source: entry.source,
      sourceId: entry.sourceId,
      sourceUrl: entry.sourceUrl,
      sourcePath: entry.sourcePath,
      tags: category.tags,
      needsReview: category.confidence < 0.6,
      importedAt: new Date(),
    });
  }
}

// ============================================
// Source Extractors
// ============================================

async function* extractAppleNotes(): AsyncGenerator<RawEntry> {
  console.log('\n  Extracting Apple Notes...');

  try {
    const { createAppleNotesExtractor } = await import('../integrations/apple-notes-extractor');
    const extractor = createAppleNotesExtractor({});

    const hasAccess = await extractor.checkAccess();
    if (!hasAccess) {
      console.log('  [WARN] No access to Apple Notes - skipping');
      return;
    }

    let count = 0;
    for await (const entry of extractor.extractAll()) {
      count++;
      yield {
        title: entry.title,
        content: entry.content,
        source: 'apple_notes',
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        sourcePath: entry.sourcePath,
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      };
    }
    console.log(`  Extracted ${count} Apple Notes`);
  } catch (error: any) {
    console.log(`  [ERROR] Apple Notes: ${error.message}`);
  }
}

async function* extractNotion(): AsyncGenerator<RawEntry> {
  console.log('\n  Extracting Notion...');

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.log('  [WARN] No NOTION_API_KEY - skipping');
    return;
  }

  try {
    const { createNotionExtractor } = await import('../integrations/notion');
    const extractor = createNotionExtractor(apiKey, { includeArchived: true });

    let count = 0;
    for await (const entry of extractor.extractAll()) {
      count++;
      yield {
        title: entry.title,
        content: entry.content,
        source: 'notion',
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        sourcePath: entry.sourcePath,
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      };
    }
    console.log(`  Extracted ${count} Notion pages`);
  } catch (error: any) {
    console.log(`  [ERROR] Notion: ${error.message}`);
  }
}

async function* extractTodoist(): AsyncGenerator<RawEntry> {
  console.log('\n  Extracting Todoist...');

  const apiKey = process.env.TODOIST_API_KEY;
  if (!apiKey) {
    console.log('  [WARN] No TODOIST_API_KEY - skipping');
    return;
  }

  try {
    const { createTodoistExtractor } = await import('../integrations/todoist-extractor-v2');
    const extractor = createTodoistExtractor(apiKey, {});

    let count = 0;
    for await (const entry of extractor.extractAll()) {
      count++;
      yield {
        title: entry.title,
        content: entry.content,
        source: 'todoist',
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        sourcePath: entry.sourcePath || '',
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      };
    }
    console.log(`  Extracted ${count} Todoist projects`);
  } catch (error: any) {
    console.log(`  [ERROR] Todoist: ${error.message}`);
  }
}

async function* extractGoogleDrive(): AsyncGenerator<RawEntry> {
  console.log('\n  Extracting Google Drive...');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('  [WARN] Missing Google credentials - skipping');
    return;
  }

  try {
    const { createGoogleDriveExtractor } = await import('../integrations/google-drive-extractor');
    const extractor = createGoogleDriveExtractor({
      credentials: { clientId, clientSecret, refreshToken },
    });

    let count = 0;
    for await (const entry of extractor.extractAll()) {
      count++;
      yield {
        title: entry.title,
        content: entry.content,
        source: 'google_drive',
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        sourcePath: entry.sourcePath || '',
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      };
    }
    console.log(`  Extracted ${count} Google Drive files`);
  } catch (error: any) {
    console.log(`  [ERROR] Google Drive: ${error.message}`);
  }
}

// ============================================
// Main Migration
// ============================================

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  SMART DATA RECOVERY MIGRATION');
  console.log('  ' + (isDryRun ? '(DRY RUN - no changes will be made)' : '(EXECUTING)'));
  if (sourceFilter) console.log(`  Source filter: ${sourceFilter}`);
  console.log('='.repeat(70) + '\n');

  // Step 1: Create bucket structure
  console.log('=== Creating Bucket Structure ===\n');
  await createBucketStructure(BUCKET_STRUCTURE);

  // Step 2: Extract and import from sources
  console.log('\n=== Extracting and Importing Data ===');

  const sources: Array<{ name: string; extractor: () => AsyncGenerator<RawEntry> }> = [];

  if (!sourceFilter || sourceFilter === 'apple-notes') {
    sources.push({ name: 'Apple Notes', extractor: extractAppleNotes });
  }
  if (!sourceFilter || sourceFilter === 'notion') {
    sources.push({ name: 'Notion', extractor: extractNotion });
  }
  if (!sourceFilter || sourceFilter === 'todoist') {
    sources.push({ name: 'Todoist', extractor: extractTodoist });
  }
  if (!sourceFilter || sourceFilter === 'google-drive') {
    sources.push({ name: 'Google Drive', extractor: extractGoogleDrive });
  }

  for (const { name, extractor } of sources) {
    console.log(`\n--- ${name} ---`);
    try {
      for await (const entry of extractor()) {
        await importEntry(entry);
      }
    } catch (error: any) {
      stats.errors.push(`${name}: ${error.message}`);
      console.log(`  [ERROR] ${error.message}`);
    }
  }

  // Step 3: Print summary
  console.log('\n' + '='.repeat(70));
  console.log('  MIGRATION SUMMARY');
  console.log('='.repeat(70) + '\n');

  console.log('Buckets:');
  console.log(`  Created: ${stats.foldersCreated}`);

  console.log('\nEntries Processed: ' + stats.entriesProcessed);

  console.log('\nBy Source:');
  for (const [source, count] of Object.entries(stats.sources).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }

  console.log('\nBy Bucket:');
  for (const [bucket, count] of Object.entries(stats.entriesCategorized).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bucket}: ${count}`);
  }

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of stats.errors.slice(0, 10)) {
      console.log(`  - ${error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes were made. Run with --execute to apply.\n');
  } else {
    console.log('\n[COMPLETE] Migration finished successfully!\n');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
