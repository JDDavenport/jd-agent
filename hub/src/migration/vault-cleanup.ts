/**
 * Vault Cleanup Migration
 *
 * This script:
 * 1. Splits task-list notes into individual tasks
 * 2. Deletes empty/minimal entries
 * 3. Recategorizes uncategorized items
 *
 * Run with: bun run src/migration/vault-cleanup.ts [--dry-run] [--execute]
 */

import { db } from '../db/client';
import { vaultEntries, tasks, people } from '../db/schema';
import { eq, and, sql, like, or } from 'drizzle-orm';

// ============================================
// Configuration
// ============================================

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

interface CleanupStats {
  tasksExtracted: number;
  entriesDeleted: number;
  entriesRecategorized: number;
  phoneNumbersToContacts: number;
  errors: string[];
}

const stats: CleanupStats = {
  tasksExtracted: 0,
  entriesDeleted: 0,
  entriesRecategorized: 0,
  phoneNumbersToContacts: 0,
  errors: [],
};

// ============================================
// Task Extraction Patterns
// ============================================

function isTaskLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return false;

  // Skip headers (markdown)
  if (trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('**') && trimmed.endsWith('**')) return false;

  // Skip URLs
  if (trimmed.startsWith('http')) return false;

  // Skip image embeds
  if (trimmed.startsWith('![')) return false;

  // Task-like patterns
  const isTask = (
    trimmed.match(/^[-•*]\s+.+/) ||           // Bullet points
    trimmed.match(/^\d+\.\s+.+/) ||            // Numbered lists
    trimmed.match(/^[\[\(][\s\]][\)\]]\s*.+/) || // Checkboxes
    (trimmed.length < 100 && trimmed.length > 3 && !trimmed.includes('\n'))  // Short lines
  );

  return !!isTask;
}

function extractTasksFromContent(content: string): string[] {
  const lines = content.split('\n');
  const tasks: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (isTaskLine(trimmed)) {
      // Clean up the task text
      let taskText = trimmed
        .replace(/^[-•*]\s+/, '')           // Remove bullets
        .replace(/^\d+\.\s+/, '')           // Remove numbers
        .replace(/^[\[\(][\s\]][\)\]]\s*/, '') // Remove checkboxes
        .trim();

      if (taskText.length >= 3 && taskText.length <= 200) {
        tasks.push(taskText);
      }
    }
  }

  return tasks;
}

// ============================================
// Categorization Logic
// ============================================

interface CategoryResult {
  context: string;
  contentType: string;
  tags: string[];
}

function categorizeEntry(title: string, content: string): CategoryResult {
  const lowerTitle = title.toLowerCase();
  const lowerContent = (content || '').toLowerCase();

  // Phone numbers -> People
  if (/^\d{10,}$/.test(title.replace(/\D/g, ''))) {
    return {
      context: 'People',
      contentType: 'reference',
      tags: ['contact', 'phone-number'],
    };
  }

  // Images/Photos
  if (content?.includes('data:image/')) {
    // Check if it's a class-related image (equations, notes)
    if (lowerTitle.includes('equation') || lowerTitle.includes('formula') ||
        lowerTitle.includes('perpetuity') || lowerTitle.includes('finance')) {
      return {
        context: 'Class',
        contentType: 'class_notes',
        tags: ['image', 'finance', 'equation'],
      };
    }
    return {
      context: 'Archive',
      contentType: 'other',
      tags: ['image', 'photo'],
    };
  }

  // Schedules and itineraries
  if (lowerTitle.includes('schedule') || lowerTitle.includes('itinerary') ||
      lowerTitle.includes('routine') || lowerTitle.includes('plan')) {
    return {
      context: 'Personal',
      contentType: 'note',
      tags: ['schedule', 'planning'],
    };
  }

  // Trips and travel
  if (lowerTitle.includes('trip') || lowerTitle.includes('vacation') ||
      lowerTitle.includes('travel') || lowerTitle.includes('hotel')) {
    return {
      context: 'Personal',
      contentType: 'note',
      tags: ['travel', 'trip-planning'],
    };
  }

  // Goals
  if (lowerTitle.includes('goal')) {
    return {
      context: 'Personal',
      contentType: 'journal',
      tags: ['goals', 'planning'],
    };
  }

  // Health/Fitness
  if (lowerTitle.includes('gym') || lowerTitle.includes('fitness') ||
      lowerTitle.includes('workout') || lowerTitle.includes('health') ||
      lowerTitle.includes('potty')) {
    return {
      context: 'Personal',
      contentType: 'note',
      tags: ['health', 'fitness'],
    };
  }

  // Financial
  if (lowerTitle.includes('budget') || lowerTitle.includes('financial') ||
      lowerTitle.includes('money') || lowerTitle.includes('expense') ||
      lowerContent.includes('$')) {
    return {
      context: 'Reference',
      contentType: 'reference',
      tags: ['finance', 'budget'],
    };
  }

  // Recipes/Food
  if (lowerTitle.includes('chicken') || lowerTitle.includes('recipe') ||
      lowerTitle.includes('noodle') || lowerTitle.includes('food')) {
    return {
      context: 'Reference',
      contentType: 'reference',
      tags: ['recipe', 'food'],
    };
  }

  // Groceries/Shopping
  if (lowerTitle.includes('grocer') || lowerTitle.includes('shopping') ||
      lowerTitle.includes('walmart') || lowerTitle.includes('store')) {
    return {
      context: 'Personal',
      contentType: 'note',
      tags: ['shopping', 'groceries'],
    };
  }

  // URLs/Links
  if (lowerTitle.includes('http') || lowerContent.startsWith('http')) {
    return {
      context: 'Reference',
      contentType: 'reference',
      tags: ['link', 'bookmark'],
    };
  }

  // Backlog/Todo lists -> should be tasks, but categorize as Personal for now
  if (lowerTitle.includes('backlog') || lowerTitle.includes('todo') ||
      lowerTitle.includes('to do') || lowerTitle.includes('things to')) {
    return {
      context: 'Personal',
      contentType: 'note',
      tags: ['task-list', 'backlog'],
    };
  }

  // Default: Archive with review tag
  return {
    context: 'Archive',
    contentType: 'note',
    tags: ['needs-review', 'imported'],
  };
}

// ============================================
// Main Operations
// ============================================

async function splitTaskLists(): Promise<void> {
  console.log('\n📋 PHASE 1: Splitting task-list notes into individual tasks...\n');

  // Find notes that look like task lists
  const taskListNotes = await db.select()
    .from(vaultEntries)
    .where(
      and(
        eq(vaultEntries.context, 'Uncategorized'),
        or(
          like(vaultEntries.title, '%backlog%'),
          like(vaultEntries.title, '%to do%'),
          like(vaultEntries.title, '%todo%'),
          like(vaultEntries.title, '%things%'),
          like(vaultEntries.title, '%groceries%'),
          like(vaultEntries.title, '%list%')
        )
      )
    );

  console.log(`Found ${taskListNotes.length} task-list style notes`);

  for (const note of taskListNotes) {
    const extractedTasks = extractTasksFromContent(note.content || '');

    if (extractedTasks.length >= 2) {
      console.log(`\n  "${note.title}" -> ${extractedTasks.length} tasks:`);

      for (const taskText of extractedTasks.slice(0, 5)) {
        console.log(`    - ${taskText.substring(0, 60)}${taskText.length > 60 ? '...' : ''}`);
      }
      if (extractedTasks.length > 5) {
        console.log(`    ... and ${extractedTasks.length - 5} more`);
      }

      if (!DRY_RUN) {
        // Create tasks
        for (const taskText of extractedTasks) {
          try {
            await db.insert(tasks).values({
              title: taskText,
              status: 'inbox',
              priority: 0,
              source: 'manual',
              context: 'personal',
            });
            stats.tasksExtracted++;
          } catch (err: any) {
            stats.errors.push(`Failed to create task "${taskText}": ${err.message}`);
          }
        }

        // Mark original note as processed or delete it
        await db.update(vaultEntries)
          .set({
            context: 'Archive',
            tags: ['processed', 'task-list-split'],
          })
          .where(eq(vaultEntries.id, note.id));
      } else {
        stats.tasksExtracted += extractedTasks.length;
      }
    }
  }
}

async function deleteEmptyEntries(): Promise<void> {
  console.log('\n🗑️  PHASE 2: Deleting empty/minimal entries...\n');

  const allUncategorized = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.context, 'Uncategorized'));

  const toDelete: { id: string; title: string; reason: string }[] = [];

  for (const entry of allUncategorized) {
    const content = entry.content || '';
    const contentWithoutTitle = content.replace(/^#\s*.+\n?/, '').trim();

    // Empty or nearly empty
    if (contentWithoutTitle.length < 10) {
      toDelete.push({ id: entry.id, title: entry.title, reason: 'empty/minimal content' });
      continue;
    }

    // Just a title repeated
    if (contentWithoutTitle.toLowerCase() === entry.title.toLowerCase()) {
      toDelete.push({ id: entry.id, title: entry.title, reason: 'content same as title' });
      continue;
    }

    // Just whitespace/formatting
    if (contentWithoutTitle.replace(/[\s\n\r*#-]/g, '').length < 5) {
      toDelete.push({ id: entry.id, title: entry.title, reason: 'only whitespace/formatting' });
      continue;
    }
  }

  console.log(`Found ${toDelete.length} entries to delete:`);

  for (const item of toDelete.slice(0, 20)) {
    console.log(`  - "${item.title}" (${item.reason})`);
  }
  if (toDelete.length > 20) {
    console.log(`  ... and ${toDelete.length - 20} more`);
  }

  if (!DRY_RUN) {
    for (const item of toDelete) {
      try {
        await db.delete(vaultEntries).where(eq(vaultEntries.id, item.id));
        stats.entriesDeleted++;
      } catch (err: any) {
        stats.errors.push(`Failed to delete "${item.title}": ${err.message}`);
      }
    }
  } else {
    stats.entriesDeleted = toDelete.length;
  }
}

async function recategorizeEntries(): Promise<void> {
  console.log('\n🏷️  PHASE 3: Recategorizing remaining uncategorized entries...\n');

  const remaining = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.context, 'Uncategorized'));

  console.log(`Found ${remaining.length} entries to recategorize`);

  const categoryCounts: Record<string, number> = {};

  for (const entry of remaining) {
    const category = categorizeEntry(entry.title, entry.content || '');

    categoryCounts[category.context] = (categoryCounts[category.context] || 0) + 1;

    if (!DRY_RUN) {
      try {
        await db.update(vaultEntries)
          .set({
            context: category.context,
            contentType: category.contentType,
            tags: category.tags,
          })
          .where(eq(vaultEntries.id, entry.id));
        stats.entriesRecategorized++;
      } catch (err: any) {
        stats.errors.push(`Failed to recategorize "${entry.title}": ${err.message}`);
      }
    } else {
      stats.entriesRecategorized++;
    }
  }

  console.log('\nRecategorization breakdown:');
  for (const [context, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${context}: ${count}`);
  }
}

async function convertPhoneNumbersToContacts(): Promise<void> {
  console.log('\n📱 PHASE 4: Converting phone numbers to contacts...\n');

  const phoneEntries = await db.select()
    .from(vaultEntries)
    .where(eq(vaultEntries.context, 'Uncategorized'));

  const phoneNumbers: { id: string; number: string; content: string }[] = [];

  for (const entry of phoneEntries) {
    const cleanNumber = entry.title.replace(/\D/g, '');
    if (/^\d{10,}$/.test(cleanNumber)) {
      phoneNumbers.push({
        id: entry.id,
        number: cleanNumber,
        content: entry.content || '',
      });
    }
  }

  console.log(`Found ${phoneNumbers.length} phone number entries`);

  for (const phone of phoneNumbers.slice(0, 10)) {
    console.log(`  - ${phone.number}`);
  }
  if (phoneNumbers.length > 10) {
    console.log(`  ... and ${phoneNumbers.length - 10} more`);
  }

  if (!DRY_RUN) {
    for (const phone of phoneNumbers) {
      try {
        // Create a person record
        await db.insert(people).values({
          name: `Contact ${phone.number}`,
          phone: phone.number,
          notes: phone.content || 'Imported from vault',
        });

        // Delete the vault entry
        await db.delete(vaultEntries).where(eq(vaultEntries.id, phone.id));
        stats.phoneNumbersToContacts++;
      } catch (err: any) {
        stats.errors.push(`Failed to convert phone ${phone.number}: ${err.message}`);
      }
    }
  } else {
    stats.phoneNumbersToContacts = phoneNumbers.length;
  }
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('  VAULT CLEANUP MIGRATION');
  console.log('═'.repeat(60));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Run with --execute to apply changes\n');
  } else {
    console.log('\n🚀 EXECUTE MODE - Changes will be applied!\n');
  }

  try {
    await splitTaskLists();
    await deleteEmptyEntries();
    await convertPhoneNumbersToContacts();
    await recategorizeEntries();

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('  SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n  Tasks extracted:      ${stats.tasksExtracted}`);
    console.log(`  Entries deleted:      ${stats.entriesDeleted}`);
    console.log(`  Phone -> Contacts:    ${stats.phoneNumbersToContacts}`);
    console.log(`  Entries recategorized: ${stats.entriesRecategorized}`);

    if (stats.errors.length > 0) {
      console.log(`\n  ⚠️  Errors: ${stats.errors.length}`);
      for (const err of stats.errors.slice(0, 10)) {
        console.log(`    - ${err}`);
      }
    }

    if (DRY_RUN) {
      console.log('\n✅ Dry run complete. Run with --execute to apply changes.');
    } else {
      console.log('\n✅ Migration complete!');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
