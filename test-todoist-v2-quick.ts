#!/usr/bin/env bun
import { TodoistExtractorV2 } from './src/integrations/todoist-extractor-v2';

async function main() {
  const apiKey = process.env.TODOIST_API_KEY!;
  const extractor = new TodoistExtractorV2({ apiKey });

  console.log('Testing new Todoist extractor...\n');

  const hasAccess = await extractor.testAccess();
  if (!hasAccess) {
    process.exit(1);
  }

  console.log('✅ Access granted\n');

  const projects = await extractor.getProjects();
  console.log(`Found ${projects.length} projects`);

  const tasks = await extractor.getTasks();
  console.log(`Found ${tasks.length} tasks\n`);

  console.log('Extracting entries...');
  let count = 0;
  for await (const entry of extractor.extractAll()) {
    count++;
    console.log(`  ${count}. ${entry.title}`);
  }

  console.log(`\n✅ Done! ${count} entries ready for import`);
}

main().catch(console.error);
