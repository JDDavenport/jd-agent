#!/usr/bin/env bun
/**
 * Sync ALL Canvas assignments to tasks table
 * 
 * This script syncs ALL published assignments from ALL courses,
 * not just upcoming ones. Run this to fix missing assignments.
 * 
 * Usage: bun run scripts/sync-all-canvas-assignments.ts --prod
 */

// Parse args
const isProd = process.argv.includes('--prod');

// For production, override DATABASE_URL BEFORE any imports
if (isProd) {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
  process.env.DATABASE_SSL = 'true';
  console.log('[Database] Using Production (Neon)');
} else {
  console.log('[Database] Using local database (add --prod for production)');
}

import { db } from '../src/db/client';
import { tasks } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://byu.instructure.com';
const CANVAS_TOKEN = process.env.CANVAS_TOKEN;
const CANVAS_TERM_FILTER = process.env.CANVAS_TERM_FILTER || 'MBA,Entrepreneurial';

if (!CANVAS_TOKEN) {
  console.error('CANVAS_TOKEN environment variable is required');
  process.exit(1);
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
}

interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  published: boolean;
  grading_type: string;
}

async function canvasRequest<T>(endpoint: string): Promise<T> {
  const url = `${CANVAS_BASE_URL}/api/v1${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Canvas API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getAllCourses(): Promise<CanvasCourse[]> {
  const courses = await canvasRequest<CanvasCourse[]>('/courses?enrollment_state=active&per_page=100');
  
  // Filter by term if specified
  if (CANVAS_TERM_FILTER) {
    const filters = CANVAS_TERM_FILTER.split(',').map(f => f.trim().toLowerCase());
    return courses.filter(course => {
      const courseName = (course.name || '').toLowerCase();
      const courseCode = (course.course_code || '').toLowerCase();
      return filters.some(filter => 
        courseName.includes(filter) || courseCode.includes(filter)
      );
    });
  }
  
  return courses;
}

async function getAssignments(courseId: number): Promise<CanvasAssignment[]> {
  return canvasRequest<CanvasAssignment[]>(
    `/courses/${courseId}/assignments?per_page=100`
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('🎓 Starting Canvas full sync...');
  console.log(`   Base URL: ${CANVAS_BASE_URL}`);
  console.log(`   Term Filter: ${CANVAS_TERM_FILTER}`);
  
  // Get filtered courses
  const courses = await getAllCourses();
  console.log(`\n📚 Found ${courses.length} courses matching filter:`);
  
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  
  for (const course of courses) {
    if (course.workflow_state !== 'available') {
      console.log(`   ⏭️  ${course.name} (${course.workflow_state}) - skipped`);
      continue;
    }
    
    console.log(`\n📖 ${course.name}`);
    
    try {
      const assignments = await getAssignments(course.id);
      console.log(`   Found ${assignments.length} assignments`);
      
      let courseCreated = 0;
      let courseUpdated = 0;
      
      for (const assignment of assignments) {
        if (!assignment.published) continue;
        
        const sourceRef = `canvas:assignment:${assignment.id}`;
        
        try {
          // Check if task already exists
          const existing = await db
            .select()
            .from(tasks)
            .where(eq(tasks.sourceRef, sourceRef))
            .limit(1);
          
          if (existing.length > 0) {
            // Update if due date changed
            const existingTask = existing[0];
            const newDueDate = assignment.due_at ? new Date(assignment.due_at) : null;
            
            if (existingTask.dueDate?.getTime() !== newDueDate?.getTime()) {
              await db
                .update(tasks)
                .set({
                  dueDate: newDueDate,
                  updatedAt: new Date(),
                })
                .where(eq(tasks.id, existingTask.id));
              courseUpdated++;
            }
          } else {
            // Create new task
            let priority = 2;
            if (assignment.points_possible >= 100) priority = 3;
            if (assignment.grading_type === 'pass_fail') priority = 1;
            if (assignment.name.toLowerCase().includes('final') ||
                assignment.name.toLowerCase().includes('midterm') ||
                assignment.name.toLowerCase().includes('exam')) {
              priority = 4;
            }
            
            await db.insert(tasks).values({
              title: assignment.name,
              description: assignment.description ? stripHtml(assignment.description) : null,
              status: 'inbox',
              priority,
              dueDate: assignment.due_at ? new Date(assignment.due_at) : null,
              dueDateIsHard: true,
              source: 'canvas',
              sourceRef,
              context: course.name, // Full course name for filtering
              syncStatus: 'synced',
              syncedAt: new Date(),
            });
            courseCreated++;
          }
        } catch (error) {
          console.error(`   ❌ Error syncing "${assignment.name}":`, error);
          totalErrors++;
        }
      }
      
      console.log(`   ✅ Created: ${courseCreated}, Updated: ${courseUpdated}`);
      totalCreated += courseCreated;
      totalUpdated += courseUpdated;
      
    } catch (error) {
      console.error(`   ❌ Error fetching assignments:`, error);
      totalErrors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 SYNC COMPLETE');
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log('='.repeat(50));
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
