/**
 * Fix Recording Titles
 *
 * Updates recordings that have null originalFilename with a generated title
 * based on the recording date or file path.
 */

import { db } from '../src/db/client';
import { recordings } from '../src/db/schema';
import { isNull, sql } from 'drizzle-orm';

async function main() {
  console.log('=== Fix Recording Titles ===\n');

  // Find recordings with null originalFilename
  const nullTitleRecordings = await db
    .select()
    .from(recordings)
    .where(isNull(recordings.originalFilename));

  console.log(`Found ${nullTitleRecordings.length} recordings with null titles\n`);

  let fixed = 0;
  let errors = 0;

  for (const recording of nullTitleRecordings) {
    try {
      // Generate a title from recording date or file path
      let title: string;

      if (recording.recordedAt) {
        const date = recording.recordedAt.toISOString().split('T')[0];
        const time = recording.recordedAt.toTimeString().split(' ')[0].slice(0, 5);
        title = `Recording ${date} ${time}`;
      } else if (recording.filePath) {
        // Extract meaningful part from file path
        const pathParts = recording.filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        // Remove extension and clean up
        title = fileName.replace(/\.(mp3|m4a|wav|ogg)$/i, '').replace(/_/g, ' ');
        if (title.length < 5) {
          title = `Recording ${recording.id.slice(0, 8)}`;
        }
      } else {
        title = `Recording ${recording.id.slice(0, 8)}`;
      }

      await db
        .update(recordings)
        .set({ originalFilename: title })
        .where(sql`${recordings.id} = ${recording.id}`);

      console.log(`Fixed: ${recording.id} -> "${title}"`);
      fixed++;
    } catch (error) {
      console.error(`Error fixing ${recording.id}:`, error);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${nullTitleRecordings.length}`);

  process.exit(errors > 0 ? 1 : 0);
}

main().catch(console.error);
