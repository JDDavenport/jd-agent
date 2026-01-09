/**
 * Test script for Canvas Integrity Agent
 * Run with: bun run scripts/test-canvas-agent.ts
 */

import { getCanvasIntegrityAgent } from '../src/agents/canvas-integrity';
import { canvasIntegrityService } from '../src/services/canvas-integrity-service';

async function testCanvasAgent() {
  console.log('🎓 Testing Canvas Integrity Agent\n');
  console.log('Canvas URL:', process.env.CANVAS_BASE_URL);
  console.log('-----------------------------------\n');

  // First, let's test the API directly to verify credentials
  console.log('1️⃣ Testing Canvas API connection...\n');

  const apiToken = process.env.CANVAS_TOKEN;
  const baseUrl = process.env.CANVAS_BASE_URL;

  if (!apiToken || !baseUrl) {
    console.error('❌ Missing CANVAS_TOKEN or CANVAS_BASE_URL in .env');
    process.exit(1);
  }

  // Fetch courses via API
  try {
    const response = await fetch(`${baseUrl}/api/v1/courses?enrollment_state=active&per_page=50`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const courses = await response.json();
    console.log(`✅ Found ${courses.length} active courses:\n`);

    for (const course of courses.slice(0, 10)) {
      console.log(`   📚 ${course.name} (ID: ${course.id})`);
      console.log(`      Code: ${course.course_code || 'N/A'}`);
      console.log(`      Term: ${course.enrollment_term_id || 'N/A'}`);
      console.log('');
    }

    // Fetch assignments for first course
    if (courses.length > 0) {
      console.log('\n2️⃣ Testing assignment fetch for first course...\n');

      const firstCourse = courses[0];
      const assignmentsResponse = await fetch(
        `${baseUrl}/api/v1/courses/${firstCourse.id}/assignments?per_page=50`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          },
        }
      );

      if (assignmentsResponse.ok) {
        const assignments = await assignmentsResponse.json();
        console.log(`✅ Found ${assignments.length} assignments in "${firstCourse.name}":\n`);

        for (const assignment of assignments.slice(0, 5)) {
          const dueDate = assignment.due_at
            ? new Date(assignment.due_at).toLocaleDateString()
            : 'No due date';
          console.log(`   📝 ${assignment.name}`);
          console.log(`      Due: ${dueDate}`);
          console.log(`      Points: ${assignment.points_possible || 'N/A'}`);
          console.log('');
        }
      }
    }

    // Check integrity service status
    console.log('\n3️⃣ Checking Canvas Integrity Service status...\n');
    const status = await canvasIntegrityService.getIntegrityStatus();
    console.log('Current Status:');
    console.log(`   Items tracked: ${status.items.total}`);
    console.log(`   Synced: ${status.items.synced}`);
    console.log(`   Pending: ${status.items.pending}`);
    console.log(`   Integrity score: ${status.integrityScore ?? 'No audits yet'}`);
    console.log(`   Unscheduled tasks: ${status.unscheduledCount}`);
    console.log(`   Active courses mapped: ${status.activeCourses}`);

    console.log('\n✅ Canvas API connection successful!');
    console.log('\n-----------------------------------');
    console.log('To run a full audit with browser automation:');
    console.log('  curl -X POST http://localhost:3000/api/canvas-integrity/audit -H "Content-Type: application/json" -d \'{"type":"full"}\'');
    console.log('\nNote: Browser automation requires manual login on first run.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testCanvasAgent();
