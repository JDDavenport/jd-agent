#!/usr/bin/env node
import cron from 'node-cron';
import chalk from 'chalk';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { config } from './config.js';
import { fetchAllCanvasData } from './sources/canvas.js';
import { fetchPlaudRecordings, plaudToContent } from './sources/plaud.js';
import { fetchRemarkableNotes, remarkableToContent } from './sources/remarkable.js';
import { mergeGoldStandard, getGoldStandardStats } from './normalize.js';
import { verify } from './verify.js';
import { push } from './push.js';
import type { GoldStandard } from './types.js';

const SYNC_INTERVAL = process.env.SYNC_INTERVAL || '0 */4 * * *'; // Every 4 hours

async function runSync() {
  const startTime = Date.now();
  console.log(chalk.blue(`\n[${new Date().toISOString()}] Starting sync...`));

  try {
    // Load existing gold standard
    const goldPath = join(config.paths.goldStandard, 'gold-standard.json');
    let existing: GoldStandard | null = null;

    try {
      const content = await readFile(goldPath, 'utf-8');
      existing = JSON.parse(content);
    } catch {
      // No existing, that's fine
    }

    // Pull all sources
    const newData: Partial<GoldStandard> = {};

    // Canvas
    console.log('  Pulling Canvas...');
    const canvasData = await fetchAllCanvasData();
    newData.courses = canvasData.courses;
    newData.tasks = canvasData.tasks;
    newData.content = canvasData.content;
    newData.modules = canvasData.modules;
    newData.grades = canvasData.grades;
    newData.calendarEvents = canvasData.calendarEvents;

    // Plaud
    console.log('  Pulling Plaud...');
    const recordings = await fetchPlaudRecordings();
    newData.plaudRecordings = recordings;
    const plaudContent = plaudToContent(recordings);
    newData.content = [...(newData.content || []), ...plaudContent];

    // Remarkable
    console.log('  Pulling Remarkable...');
    const notes = await fetchRemarkableNotes();
    newData.remarkableNotes = notes;
    const remarkableContent = remarkableToContent(notes);
    newData.content = [...(newData.content || []), ...remarkableContent];

    // Merge and save
    const merged = mergeGoldStandard(existing, newData);
    await mkdir(config.paths.goldStandard, { recursive: true });
    await writeFile(goldPath, JSON.stringify(merged, null, 2));

    console.log(`  Gold standard: ${getGoldStandardStats(merged)}`);

    // Push to hub
    console.log('  Pushing to hub...');
    const pushResult = await push();
    
    if (pushResult.errors.length > 0) {
      console.log(chalk.yellow(`  Push warnings: ${pushResult.errors.length} errors`));
    }

    // Verify
    const verifyResult = await verify();
    console.log(`  Verify: ${verifyResult.summary}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`[${new Date().toISOString()}] Sync complete in ${duration}s\n`));

  } catch (error) {
    console.error(chalk.red(`[${new Date().toISOString()}] Sync failed:`), error);
  }
}

// Main daemon entry
console.log(chalk.blue.bold('🔄 Study Aide Sync Daemon'));
console.log(`Schedule: ${SYNC_INTERVAL}`);
console.log('Press Ctrl+C to stop\n');

// Run immediately on start
runSync();

// Schedule recurring runs
cron.schedule(SYNC_INTERVAL, () => {
  runSync();
});

// Keep process alive
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nDaemon stopped.'));
  process.exit(0);
});
