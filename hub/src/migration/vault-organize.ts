/**
 * Vault Organization Migration
 * Creates hierarchical folder structure and moves entries appropriately
 *
 * Usage:
 *   bun run src/migration/vault-organize.ts --dry-run
 *   bun run src/migration/vault-organize.ts --execute
 */

import { db } from '../db/client';
import { vaultEntries } from '../db/schema';
import { eq, or, ilike, and, lt, isNull, inArray, sql } from 'drizzle-orm';

const isDryRun = !process.argv.includes('--execute');

interface FolderStructure {
  title: string;
  context: string;
  contentType: 'note';
  children?: FolderStructure[];
}

// Define the folder structure
const STRUCTURE: FolderStructure[] = [
  {
    title: 'Journal',
    context: 'Personal',
    contentType: 'note',
  },
  {
    title: 'Reference',
    context: 'Reference',
    contentType: 'note',
    children: [
      { title: 'People', context: 'Reference', contentType: 'note' },
      { title: 'Credentials', context: 'Reference', contentType: 'note' },
      { title: 'Documents', context: 'Reference', contentType: 'note' },
    ]
  },
  {
    title: 'School',
    context: 'School',
    contentType: 'note',
    children: [
      { title: 'MBA Winter 2026', context: 'School', contentType: 'note' },
      { title: 'MBA Fall 2025', context: 'School', contentType: 'note' },
    ]
  },
  {
    title: 'Work',
    context: 'Work',
    contentType: 'note',
  },
  {
    title: 'Templates',
    context: 'Templates',
    contentType: 'note',
  },
  {
    title: 'Someday',
    context: 'Someday',
    contentType: 'note',
  },
  {
    title: 'Archive',
    context: 'Archive',
    contentType: 'note',
    children: [
      { title: 'Old Journal', context: 'Archive', contentType: 'note' },
    ]
  },
];

// Store created folder IDs
const folderIds: Record<string, string> = {};

async function createFolderStructure(folders: FolderStructure[], parentId: string | null = null, depth = 0) {
  const indent = '  '.repeat(depth);

  for (const folder of folders) {
    const key = parentId ? `${parentId}/${folder.title}` : folder.title;

    // Check if folder already exists
    const existing = await db.select({ id: vaultEntries.id })
      .from(vaultEntries)
      .where(and(
        eq(vaultEntries.title, folder.title),
        parentId ? eq(vaultEntries.parentId, parentId) : isNull(vaultEntries.parentId)
      ))
      .limit(1);

    if (existing.length > 0) {
      folderIds[folder.title] = existing[0].id;
      console.log(`${indent}[EXISTS] ${folder.title} (${existing[0].id})`);
    } else if (isDryRun) {
      console.log(`${indent}[WOULD CREATE] ${folder.title}`);
      folderIds[folder.title] = `dry-run-${folder.title}`;
    } else {
      const [created] = await db.insert(vaultEntries)
        .values({
          title: folder.title,
          content: `# ${folder.title}\n\nOrganization folder.`,
          context: folder.context,
          contentType: folder.contentType,
          source: 'manual',
          parentId,
          tags: ['folder', 'organization'],
        })
        .returning({ id: vaultEntries.id });

      folderIds[folder.title] = created.id;
      console.log(`${indent}[CREATED] ${folder.title} (${created.id})`);
    }

    // Create children
    if (folder.children) {
      await createFolderStructure(folder.children, folderIds[folder.title], depth + 1);
    }
  }
}

async function moveJournalEntries() {
  console.log('\n=== Moving Journal Entries ===');

  // Get all journal entries
  const journals = await db.select({ id: vaultEntries.id, title: vaultEntries.title, createdAt: vaultEntries.createdAt })
    .from(vaultEntries)
    .where(eq(vaultEntries.contentType, 'journal'));

  const cutoffDate = new Date('2026-01-01');
  const oldJournals = journals.filter(j => j.createdAt < cutoffDate);
  const recentJournals = journals.filter(j => j.createdAt >= cutoffDate);

  console.log(`Found ${journals.length} journal entries`);
  console.log(`  - ${oldJournals.length} old (pre-2026) -> Archive/Old Journal`);
  console.log(`  - ${recentJournals.length} recent (2026+) -> Journal`);

  if (!isDryRun) {
    // Move old journals to Archive/Old Journal
    if (oldJournals.length > 0 && folderIds['Old Journal']) {
      await db.update(vaultEntries)
        .set({ parentId: folderIds['Old Journal'] })
        .where(inArray(vaultEntries.id, oldJournals.map(j => j.id)));
      console.log(`  [MOVED] ${oldJournals.length} old journals to Archive/Old Journal`);
    }

    // Move recent journals to Journal folder
    if (recentJournals.length > 0 && folderIds['Journal']) {
      await db.update(vaultEntries)
        .set({ parentId: folderIds['Journal'] })
        .where(inArray(vaultEntries.id, recentJournals.map(j => j.id)));
      console.log(`  [MOVED] ${recentJournals.length} recent journals to Journal`);
    }
  }
}

async function moveSchoolContent() {
  console.log('\n=== Moving School Content ===');

  // Get class/study entries
  const schoolEntries = await db.select({ id: vaultEntries.id, title: vaultEntries.title, createdAt: vaultEntries.createdAt })
    .from(vaultEntries)
    .where(or(
      eq(vaultEntries.context, 'Class'),
      eq(vaultEntries.context, 'Study'),
      eq(vaultEntries.contentType, 'class_notes'),
      eq(vaultEntries.contentType, 'lecture'),
      ilike(vaultEntries.title, '%MBA%'),
      ilike(vaultEntries.title, '%BYU%')
    ));

  // Exclude the folder pages we just created
  const toMove = schoolEntries.filter(e => !['School', 'MBA Winter 2026', 'MBA Fall 2025'].includes(e.title));

  console.log(`Found ${toMove.length} school entries -> MBA Fall 2025`);

  if (!isDryRun && toMove.length > 0 && folderIds['MBA Fall 2025']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['MBA Fall 2025'], context: 'School' })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to School/MBA Fall 2025`);
  }
}

async function moveCredentials() {
  console.log('\n=== Moving Credentials ===');

  const creds = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(or(
      eq(vaultEntries.contentType, 'credential'),
      eq(vaultEntries.context, 'Security'),
      ilike(vaultEntries.title, '%password%'),
      ilike(vaultEntries.title, '%credential%'),
      ilike(vaultEntries.title, '%login%'),
      ilike(vaultEntries.title, '%SSN%'),
      ilike(vaultEntries.title, '%social security%')
    ));

  const toMove = creds.filter(c => c.title !== 'Credentials');
  console.log(`Found ${toMove.length} credential entries -> Reference/Credentials`);

  if (!isDryRun && toMove.length > 0 && folderIds['Credentials']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['Credentials'], context: 'Reference' })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to Reference/Credentials`);
  }
}

async function movePeople() {
  console.log('\n=== Moving People ===');

  const people = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(or(
      eq(vaultEntries.contentType, 'person'),
      eq(vaultEntries.context, 'People'),
      ilike(vaultEntries.title, '%[PERSON]%'),
      ilike(vaultEntries.title, '%doctor%'),
      ilike(vaultEntries.title, '%contact%')
    ));

  const toMove = people.filter(p => p.title !== 'People');
  console.log(`Found ${toMove.length} people entries -> Reference/People`);

  if (!isDryRun && toMove.length > 0 && folderIds['People']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['People'], context: 'Reference' })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to Reference/People`);
  }
}

async function moveTemplates() {
  console.log('\n=== Moving Templates ===');

  const templates = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(or(
      eq(vaultEntries.contentType, 'template'),
      eq(vaultEntries.context, 'Templates')
    ));

  const toMove = templates.filter(t => t.title !== 'Templates');
  console.log(`Found ${toMove.length} template entries -> Templates`);

  if (!isDryRun && toMove.length > 0 && folderIds['Templates']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['Templates'] })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to Templates`);
  }
}

async function moveWorkContent() {
  console.log('\n=== Moving Work Content ===');

  const work = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(or(
      eq(vaultEntries.context, 'Career'),
      eq(vaultEntries.context, 'Work')
    ));

  const toMove = work.filter(w => w.title !== 'Work');
  console.log(`Found ${toMove.length} work entries -> Work`);

  if (!isDryRun && toMove.length > 0 && folderIds['Work']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['Work'], context: 'Work' })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to Work`);
  }
}

async function moveAmbiguousToSomeday() {
  console.log('\n=== Moving Ambiguous Notes to Someday ===');

  // Move truly cryptic/meaningless entries
  // These are notes that are just numbers, single characters, or very cryptic
  const ambiguous = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(and(
      eq(vaultEntries.context, 'Archive'),
      eq(vaultEntries.contentType, 'note'),
      isNull(vaultEntries.parentId)
    ));

  // Filter to truly cryptic titles only
  const toMove = ambiguous.filter(a => {
    const title = a.title.trim();
    const titleLower = title.toLowerCase();

    // Skip if title is a folder we created
    if (['Archive', 'Someday', 'Journal', 'Reference', 'School', 'Work', 'Templates'].includes(title)) {
      return false;
    }

    // Skip family names and meaningful short words
    const meaningfulShortWords = ['sam', 'ava', 'john', 'jd', 'mba', 'byu', 'day', 'car', 'gym', 'tax'];
    if (meaningfulShortWords.includes(titleLower)) {
      return false;
    }

    // Only move if title is:
    // 1. Just numbers (like "123", "50", "6pm") but not dates
    const isJustNumbers = /^[\d\s\-\.:,]+$/.test(title) && !/\d{4}/.test(title);
    // 2. Just punctuation or single chars (like ".", "'", "?")
    const isCryptic = /^[.\-'"?!*\s]+$/.test(title) || title.length <= 2;
    // 3. Looks like random number sequences
    const isRandomData = /^\d{5,}$/.test(title.replace(/\D/g, '')) && title.length < 12 && !/\d{4}/.test(title);

    return isJustNumbers || isCryptic || isRandomData;
  });

  console.log(`Found ${toMove.length} truly ambiguous entries -> Someday`);
  toMove.slice(0, 15).forEach(a => console.log(`  - "${a.title}"`));
  if (toMove.length > 15) console.log(`  ... and ${toMove.length - 15} more`);

  if (!isDryRun && toMove.length > 0 && folderIds['Someday']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['Someday'], context: 'Someday' })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to Someday`);
  }
}

async function moveRemainingArchive() {
  console.log('\n=== Moving Remaining Archive Content ===');

  // Move remaining Archive content (non-folder) into Archive folder
  const remaining = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(and(
      eq(vaultEntries.context, 'Archive'),
      isNull(vaultEntries.parentId)
    ));

  const toMove = remaining.filter(r => !['Archive', 'Old Journal'].includes(r.title));
  console.log(`Found ${toMove.length} remaining Archive entries -> Archive`);

  if (!isDryRun && toMove.length > 0 && folderIds['Archive']) {
    await db.update(vaultEntries)
      .set({ parentId: folderIds['Archive'] })
      .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    console.log(`  [MOVED] ${toMove.length} entries to Archive`);
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VAULT ORGANIZATION MIGRATION ${isDryRun ? '(DRY RUN)' : '(EXECUTING)'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (isDryRun) {
    console.log('This is a DRY RUN. No changes will be made.');
    console.log('Run with --execute to apply changes.\n');
  }

  // Step 1: Create folder structure
  console.log('=== Creating Folder Structure ===');
  await createFolderStructure(STRUCTURE);

  // Step 2: Move content
  await moveJournalEntries();
  await moveSchoolContent();
  await moveCredentials();
  await movePeople();
  await moveTemplates();
  await moveWorkContent();
  await moveAmbiguousToSomeday();
  await moveRemainingArchive();

  console.log(`\n${'='.repeat(60)}`);
  console.log('MIGRATION COMPLETE');
  console.log(`${'='.repeat(60)}\n`);

  process.exit(0);
}

main().catch(console.error);
