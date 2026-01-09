/**
 * Vault Cleanup Script
 * - Delete orphan test entries
 * - Move 2026 Winter Semester entries to School Archive
 * - Create Goals folder and organize goal-related entries
 * - Clean up loose pages
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
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
  }
}
loadEnv();

import { db } from '../db/client';
import { vaultEntries } from '../db/schema';
import { eq, like, isNull, and, or, inArray } from 'drizzle-orm';

async function cleanup() {
  console.log('Starting vault cleanup...\n');

  // 1. Delete orphan test entries
  console.log('=== Deleting orphan test entries ===');
  const testPatterns = ['Goal Journey%', 'Test Goal%', 'Progress Update%'];

  for (const pattern of testPatterns) {
    const orphans = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
      .from(vaultEntries)
      .where(and(
        isNull(vaultEntries.parentId),
        like(vaultEntries.title, pattern)
      ));

    if (orphans.length > 0) {
      console.log(`  Deleting ${orphans.length} entries matching "${pattern}"`);
      await db.delete(vaultEntries)
        .where(inArray(vaultEntries.id, orphans.map(o => o.id)));
    }
  }

  // 2. Find the School Archive folder
  console.log('\n=== Moving 2026 Winter Semester to School Archive ===');
  const schoolArchive = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.title, 'School Archive'))
    .limit(1);

  if (schoolArchive.length === 0) {
    console.log('  School Archive not found, creating...');
    // Find MBA folder
    const mba = await db.select()
      .from(vaultEntries)
      .where(eq(vaultEntries.title, 'MBA'))
      .limit(1);

    if (mba.length > 0) {
      const [newArchive] = await db.insert(vaultEntries).values({
        title: 'School Archive',
        content: 'Archive of school-related documents and notes',
        contentType: 'note',
        context: 'School',
        parentId: mba[0].id,
        source: 'manual',
      }).returning();
      schoolArchive.push(newArchive);
    }
  }

  if (schoolArchive.length > 0) {
    // Find 2026 Winter Semester folder
    const winterSemester = await db.select()
      .from(vaultEntries)
      .where(eq(vaultEntries.title, '2026 Winter Semester'))
      .limit(1);

    if (winterSemester.length > 0) {
      // Move all children of 2026 Winter Semester to School Archive
      const children = await db.select({ id: vaultEntries.id })
        .from(vaultEntries)
        .where(eq(vaultEntries.parentId, winterSemester[0].id));

      if (children.length > 0) {
        console.log(`  Moving ${children.length} entries from 2026 Winter Semester to School Archive`);
        await db.update(vaultEntries)
          .set({ parentId: schoolArchive[0].id })
          .where(eq(vaultEntries.parentId, winterSemester[0].id));
      }
    }
  }

  // 3. Create Goals folder and organize goal-related entries
  console.log('\n=== Organizing Goals ===');

  // Check if Goals folder exists under Personal
  const personal = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.title, 'Personal'))
    .limit(1);

  let goalsFolder = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.title, 'Goals & Plans'))
    .limit(1);

  if (goalsFolder.length === 0 && personal.length > 0) {
    console.log('  Creating Goals & Plans folder...');
    const [newGoals] = await db.insert(vaultEntries).values({
      title: 'Goals & Plans',
      content: 'Personal goals and planning documents',
      contentType: 'note',
      context: 'Personal',
      parentId: personal[0].id,
      source: 'manual',
    }).returning();
    goalsFolder.push(newGoals);
  }

  if (goalsFolder.length > 0) {
    // Move loose goal entries to Goals folder
    const looseGoals = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
      .from(vaultEntries)
      .where(and(
        isNull(vaultEntries.parentId),
        or(
          like(vaultEntries.title, '%goal%'),
          like(vaultEntries.title, '%Goal%')
        )
      ));

    if (looseGoals.length > 0) {
      console.log(`  Moving ${looseGoals.length} loose goal entries to Goals & Plans`);
      await db.update(vaultEntries)
        .set({ parentId: goalsFolder[0].id })
        .where(inArray(vaultEntries.id, looseGoals.map(g => g.id)));
    }
  }

  // 4. Clean up other loose entries - move to Inbox
  console.log('\n=== Cleaning up loose entries ===');
  const inbox = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.title, 'Inbox'))
    .limit(1);

  if (inbox.length > 0) {
    // Find entries with no parent that aren't main folders
    const mainFolders = ['Archive', 'Reference', 'MBA', 'Personal', 'Professional', 'Inbox'];
    const looseEntries = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
      .from(vaultEntries)
      .where(isNull(vaultEntries.parentId));

    const toMove = looseEntries.filter(e => !mainFolders.includes(e.title));

    if (toMove.length > 0) {
      console.log(`  Moving ${toMove.length} loose entries to Inbox`);
      await db.update(vaultEntries)
        .set({ parentId: inbox[0].id })
        .where(inArray(vaultEntries.id, toMove.map(e => e.id)));
    }
  }

  // 5. Summary
  console.log('\n=== Final Structure ===');
  const rootEntries = await db.select({ id: vaultEntries.id, title: vaultEntries.title })
    .from(vaultEntries)
    .where(isNull(vaultEntries.parentId));

  console.log('Root folders:');
  for (const entry of rootEntries) {
    const children = await db.select({ id: vaultEntries.id })
      .from(vaultEntries)
      .where(eq(vaultEntries.parentId, entry.id));
    console.log(`  - ${entry.title} (${children.length} children)`);
  }

  console.log('\n✅ Cleanup complete!');
}

cleanup().catch(console.error);
