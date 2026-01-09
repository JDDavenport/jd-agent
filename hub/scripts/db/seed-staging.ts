#!/usr/bin/env bun
/**
 * Staging Environment Seed Script
 *
 * Creates sample data for testing in the staging environment.
 * This helps validate features without affecting production data.
 *
 * Usage:
 *   APP_ENV=staging bun run scripts/db/seed-staging.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

// Check environment
const env = process.env.APP_ENV || process.env.NODE_ENV;
if (env !== 'staging') {
  console.error('\nError: This script can only be run in the staging environment!');
  console.error('Set APP_ENV=staging before running.\n');
  process.exit(1);
}

// Load staging environment
const hubDir = path.resolve(__dirname, '../..');
const envFile = path.join(hubDir, '.env.staging');

if (!fs.existsSync(envFile)) {
  console.error(`\nError: Staging environment file not found: ${envFile}`);
  console.error('Please create .env.staging from .env.staging.example\n');
  process.exit(1);
}

// Load environment variables
const envContent = fs.readFileSync(envFile, 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    process.env[key] = value;
  }
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('\nError: DATABASE_URL not found in .env.staging\n');
  process.exit(1);
}

console.log('\n========================================');
console.log('Seeding Staging Database');
console.log('========================================\n');

console.log(`Database: ${databaseUrl.replace(/:[^@]+@/, ':***@')}`);

// Create database connection
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool, { schema });

async function seedStagingData() {
  try {
    console.log('\nClearing existing staging data...');

    // Clear in reverse dependency order
    await db.delete(schema.tasks);
    await db.delete(schema.sections);
    await db.delete(schema.projects);
    await db.delete(schema.contexts);
    await db.delete(schema.labels);

    console.log('Creating sample contexts...');

    const sampleContexts = [
      { name: '@computer', description: 'Tasks requiring a computer', color: '#3B82F6', icon: 'laptop' },
      { name: '@home', description: 'Tasks to do at home', color: '#10B981', icon: 'home' },
      { name: '@errands', description: 'Tasks outside the house', color: '#F59E0B', icon: 'car' },
      { name: '@calls', description: 'Phone calls to make', color: '#8B5CF6', icon: 'phone' },
      { name: '@email', description: 'Emails to send', color: '#EC4899', icon: 'mail' },
      { name: '@focus', description: 'Deep work requiring focus', color: '#EF4444', icon: 'target' },
    ];

    for (const ctx of sampleContexts) {
      await db.insert(schema.contexts).values(ctx);
    }

    console.log('Creating sample labels...');

    const sampleLabels = [
      { name: 'urgent', color: '#EF4444' },
      { name: 'important', color: '#F59E0B' },
      { name: 'quick-win', color: '#10B981' },
      { name: 'blocked', color: '#6B7280' },
      { name: 'review', color: '#8B5CF6' },
    ];

    for (const label of sampleLabels) {
      await db.insert(schema.labels).values(label);
    }

    console.log('Creating sample projects...');

    const projectIds: Record<string, string> = {};

    const sampleProjects = [
      {
        name: 'JD Agent Development',
        description: 'Building the personal AI assistant',
        color: '#3B82F6',
        area: 'Work',
        context: 'work',
        status: 'active',
      },
      {
        name: 'MBA Coursework',
        description: 'Vanderbilt MBA courses',
        color: '#10B981',
        area: 'School',
        context: 'school',
        status: 'active',
      },
      {
        name: 'Fitness Goals',
        description: 'Health and wellness objectives',
        color: '#EF4444',
        area: 'Health',
        context: 'personal',
        status: 'active',
      },
      {
        name: 'Home Organization',
        description: 'Home improvement projects',
        color: '#F59E0B',
        area: 'Personal',
        context: 'personal',
        status: 'active',
      },
    ];

    for (const project of sampleProjects) {
      const [inserted] = await db.insert(schema.projects).values(project).returning();
      projectIds[project.name] = inserted.id;
    }

    console.log('Creating sample sections...');

    // Add sections to JD Agent project
    const jdAgentId = projectIds['JD Agent Development'];
    await db.insert(schema.sections).values([
      { projectId: jdAgentId, name: 'Backend', sortOrder: 0 },
      { projectId: jdAgentId, name: 'Frontend', sortOrder: 1 },
      { projectId: jdAgentId, name: 'DevOps', sortOrder: 2 },
      { projectId: jdAgentId, name: 'Documentation', sortOrder: 3 },
    ]);

    console.log('Creating sample tasks...');

    const sampleTasks = [
      // Inbox items
      {
        title: 'Review weekly calendar',
        status: 'inbox',
        source: 'seed',
        context: 'personal',
        priority: 0,
      },
      {
        title: 'Check email responses',
        status: 'inbox',
        source: 'seed',
        context: 'work',
        priority: 0,
      },

      // Next actions
      {
        title: 'Complete multi-environment database setup',
        description: 'Finish setting up dev/staging/prod databases with Neon',
        status: 'next',
        priority: 3,
        projectId: jdAgentId,
        source: 'seed',
        context: 'work',
        taskContexts: ['@computer', '@focus'],
      },
      {
        title: 'Write E2E tests for Goals page',
        status: 'next',
        priority: 2,
        projectId: jdAgentId,
        source: 'seed',
        context: 'work',
        taskContexts: ['@computer'],
      },
      {
        title: 'Prepare MBA presentation slides',
        status: 'next',
        priority: 3,
        projectId: projectIds['MBA Coursework'],
        source: 'seed',
        context: 'school',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      },

      // Scheduled
      {
        title: 'Team standup meeting',
        status: 'scheduled',
        priority: 2,
        source: 'seed',
        context: 'work',
        scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      },
      {
        title: 'Gym workout',
        status: 'scheduled',
        priority: 1,
        projectId: projectIds['Fitness Goals'],
        source: 'seed',
        context: 'personal',
        scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      },

      // Waiting for
      {
        title: 'API access credentials',
        status: 'waiting',
        source: 'seed',
        context: 'work',
        waitingFor: 'IT Department',
        waitingSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },

      // Someday/Maybe
      {
        title: 'Learn Rust programming',
        status: 'someday',
        source: 'seed',
        context: 'personal',
        priority: 0,
      },
      {
        title: 'Plan trip to Japan',
        status: 'someday',
        source: 'seed',
        context: 'personal',
        priority: 0,
      },

      // Completed
      {
        title: 'Set up project repository',
        status: 'done',
        projectId: jdAgentId,
        source: 'seed',
        context: 'work',
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      },
    ];

    for (const task of sampleTasks) {
      await db.insert(schema.tasks).values(task);
    }

    console.log('\n========================================');
    console.log('Staging Seed Complete!');
    console.log('========================================');
    console.log(`
Created:
  - ${sampleContexts.length} contexts
  - ${sampleLabels.length} labels
  - ${sampleProjects.length} projects
  - 4 sections
  - ${sampleTasks.length} tasks
`);

  } catch (error) {
    console.error('\nSeeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedStagingData();
