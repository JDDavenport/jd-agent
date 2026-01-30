/**
 * Link Vault Entries to Canvas Projects
 *
 * This script backfills the projectId on vault entries that are related to
 * MBA courses but were created before the Canvas/Vault linking was implemented.
 *
 * It looks for vault entries with:
 * - title or context containing MBA course codes (MBA501, MBA508, etc.)
 * - no existing projectId
 *
 * And links them to the corresponding Canvas project via classProjectMapping.
 */

import { db } from '../src/db/client';
import { vaultEntries, vaultPages, classProjectMapping, projects } from '../src/db/schema';
import { eq, isNull, or, like, and, sql } from 'drizzle-orm';

async function main() {
  console.log('=== Link Vault Entries to Canvas Projects ===\n');

  // Get all active course-to-project mappings
  const mappings = await db
    .select({
      canvasCourseCode: classProjectMapping.canvasCourseCode,
      canvasCourseName: classProjectMapping.canvasCourseName,
      projectId: classProjectMapping.projectId,
      projectName: projects.name,
    })
    .from(classProjectMapping)
    .leftJoin(projects, eq(classProjectMapping.projectId, projects.id))
    .where(eq(classProjectMapping.isActive, true));

  console.log(`Found ${mappings.length} active course mappings:\n`);

  // Build a map of course codes to project IDs
  const courseProjectMap = new Map<string, { projectId: string; projectName: string | null }>();

  for (const mapping of mappings) {
    // Extract course code from canvasCourseCode (e.g., "MBA 508-001" -> "MBA508")
    if (mapping.canvasCourseCode) {
      const code = mapping.canvasCourseCode.replace(/\s+/g, '').replace(/-.*$/, '').toUpperCase();
      courseProjectMap.set(code, { projectId: mapping.projectId, projectName: mapping.projectName });
      console.log(`  ${code} -> ${mapping.projectName} (${mapping.projectId})`);
    }

    // Also extract from course name (e.g., "MBA 508-001: Business Analytics" -> "MBA508")
    const nameMatch = mapping.canvasCourseName.match(/MBA\s*(\d{3})/i);
    if (nameMatch) {
      const code = `MBA${nameMatch[1]}`;
      if (!courseProjectMap.has(code)) {
        courseProjectMap.set(code, { projectId: mapping.projectId, projectName: mapping.projectName });
        console.log(`  ${code} (from name) -> ${mapping.projectName} (${mapping.projectId})`);
      }
    }
  }

  console.log(`\nTotal unique course codes: ${courseProjectMap.size}\n`);

  // Find vault entries without project links that have MBA in title/context
  const unlinkedEntries = await db
    .select()
    .from(vaultEntries)
    .where(
      and(
        isNull(vaultEntries.projectId),
        or(
          like(vaultEntries.title, '%MBA%'),
          like(vaultEntries.context, '%MBA%'),
          sql`${vaultEntries.tags}::text LIKE '%mba%'`
        )
      )
    );

  console.log(`Found ${unlinkedEntries.length} vault entries without project links\n`);

  let linked = 0;
  let skipped = 0;
  let notMatched = 0;

  for (const entry of unlinkedEntries) {
    // Try to extract course code from title, context, or tags
    const searchText = `${entry.title || ''} ${entry.context || ''} ${(entry.tags || []).join(' ')}`.toUpperCase();

    let matchedProjectId: string | null = null;
    let matchedCode: string | null = null;

    for (const [code, { projectId }] of courseProjectMap) {
      if (searchText.includes(code)) {
        matchedProjectId = projectId;
        matchedCode = code;
        break;
      }
    }

    if (matchedProjectId) {
      try {
        await db
          .update(vaultEntries)
          .set({ projectId: matchedProjectId, updatedAt: new Date() })
          .where(eq(vaultEntries.id, entry.id));

        console.log(`  Linked: "${entry.title}" -> ${matchedCode}`);
        linked++;
      } catch (error) {
        console.error(`  Error linking ${entry.id}: ${error}`);
        skipped++;
      }
    } else {
      // Check if it's a general MBA entry (not course-specific)
      if (entry.title === 'MBA' || entry.context === 'MBA') {
        console.log(`  Skipped (general MBA folder): "${entry.title}"`);
        skipped++;
      } else {
        console.log(`  No match: "${entry.title}" (context: ${entry.context})`);
        notMatched++;
      }
    }
  }

  // Also update vault_pages with MBA content
  console.log('\n=== Linking Vault Pages ===\n');

  const unlinkedPages = await db
    .select()
    .from(vaultPages)
    .where(
      and(
        isNull(vaultPages.projectId),
        or(
          like(vaultPages.title, '%MBA%'),
          sql`${vaultPages.tags}::text LIKE '%mba%'`
        )
      )
    );

  console.log(`Found ${unlinkedPages.length} vault pages without project links\n`);

  let pagesLinked = 0;

  for (const page of unlinkedPages) {
    const searchText = `${page.title || ''} ${(page.tags || []).join(' ')}`.toUpperCase();

    let matchedProjectId: string | null = null;
    let matchedCode: string | null = null;

    for (const [code, { projectId }] of courseProjectMap) {
      if (searchText.includes(code)) {
        matchedProjectId = projectId;
        matchedCode = code;
        break;
      }
    }

    if (matchedProjectId) {
      try {
        await db
          .update(vaultPages)
          .set({ projectId: matchedProjectId, updatedAt: new Date() })
          .where(eq(vaultPages.id, page.id));

        console.log(`  Linked page: "${page.title}" -> ${matchedCode}`);
        pagesLinked++;
      } catch (error) {
        console.error(`  Error linking page ${page.id}: ${error}`);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Vault Entries Linked: ${linked}`);
  console.log(`Vault Entries Skipped: ${skipped}`);
  console.log(`Vault Entries Not Matched: ${notMatched}`);
  console.log(`Vault Pages Linked: ${pagesLinked}`);

  process.exit(0);
}

main().catch(console.error);
