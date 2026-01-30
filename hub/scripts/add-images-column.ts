#!/usr/bin/env bun
import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function addImagesColumn() {
  try {
    console.log('Adding images column to read_help_chapters...');

    await db.execute(sql`
      ALTER TABLE read_help_chapters
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb
    `);

    console.log('✓ Images column added successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding images column:', error);
    process.exit(1);
  }
}

addImagesColumn();
