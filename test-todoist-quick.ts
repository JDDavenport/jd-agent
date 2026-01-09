#!/usr/bin/env bun
/**
 * Quick Todoist Test
 */

import { TodoistExtractor } from './src/integrations/todoist-extractor';

async function main() {
  const apiKey = process.env.TODOIST_API_KEY;

  if (!apiKey) {
    console.error('Missing TODOIST_API_KEY');
    process.exit(1);
  }

  console.log('Testing Todoist API...\n');

  const extractor = new TodoistExtractor({ apiKey });

  // Test access
  const hasAccess = await extractor.testAccess();
  if (!hasAccess) {
    console.error('Cannot access Todoist');
    process.exit(1);
  }

  console.log('✅ Todoist API access works\n');

  // Get projects
  const projects = await extractor.getProjects();
  console.log(`Found ${projects.length} projects:`);
  projects.forEach(p => console.log(`  - ${p.name}`));

  console.log('\nExtracting tasks...');

  let count = 0;
  for await (const entry of extractor.extractAll()) {
    count++;
    console.log(`  ${count}. ${entry.title}`);
  }

  console.log(`\n✅ Extracted ${count} project entries`);
}

main().catch(console.error);
