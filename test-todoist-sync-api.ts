#!/usr/bin/env bun
/**
 * Test Todoist Sync API (v1)
 */

async function main() {
  const token = process.env.TODOIST_API_KEY;

  if (!token) {
    console.error('Missing TODOIST_API_KEY');
    process.exit(1);
  }

  console.log('Testing Todoist Sync API (v1)...\n');

  // Use Sync API v9 (the latest version of the "v1" Sync API)
  const response = await fetch('https://api.todoist.com/sync/v9/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      sync_token: '*',
      resource_types: ['items', 'projects'],
    }),
  });

  const data = await response.json();

  console.log('Response status:', response.status);
  console.log('Projects:', data.projects?.length || 0);
  console.log('Items (tasks):', data.items?.length || 0);

  if (data.projects && data.projects.length > 0) {
    console.log('\nProjects:');
    data.projects.slice(0, 5).forEach((p: any) => {
      console.log(`  - ${p.name} (${p.id})`);
    });
  }

  if (data.items && data.items.length > 0) {
    console.log('\nFirst 5 tasks:');
    data.items.slice(0, 5).forEach((t: any) => {
      console.log(`  - ${t.content}`);
    });
  }

  console.log(`\n✅ Total: ${data.projects?.length || 0} projects, ${data.items?.length || 0} tasks`);
}

main().catch(console.error);
