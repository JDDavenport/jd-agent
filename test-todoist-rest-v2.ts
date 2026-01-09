#!/usr/bin/env bun
/**
 * Test Todoist REST API v2
 */

async function main() {
  const token = process.env.TODOIST_API_KEY;

  if (!token) {
    console.error('Missing TODOIST_API_KEY');
    process.exit(1);
  }

  console.log('Testing Todoist REST API v2...\n');

  // Try REST API v2
  const tasksResponse = await fetch('https://api.todoist.com/rest/v2/tasks', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  console.log('Tasks endpoint status:', tasksResponse.status);
  const tasks = tasksResponse.ok ? await tasksResponse.json() : null;

  if (tasks) {
    console.log('Tasks found:', tasks.length);
    if (tasks.length > 0) {
      console.log('First 5 tasks:');
      tasks.slice(0, 5).forEach((t: any) => {
        console.log(`  - ${t.content}`);
      });
    }
  } else {
    const error = await tasksResponse.text();
    console.log('Error:', error);
  }

  // Try projects
  const projectsResponse = await fetch('https://api.todoist.com/rest/v2/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  console.log('\nProjects endpoint status:', projectsResponse.status);
  const projects = projectsResponse.ok ? await projectsResponse.json() : null;

  if (projects) {
    console.log('Projects found:', projects.length);
    if (projects.length > 0) {
      console.log('Projects:');
      projects.slice(0, 5).forEach((p: any) => {
        console.log(`  - ${p.name}`);
      });
    }
  } else {
    const error = await projectsResponse.text();
    console.log('Error:', error);
  }
}

main().catch(console.error);
