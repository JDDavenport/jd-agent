#!/usr/bin/env node
import { Command } from 'commander';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';

import { config } from './config.js';
import { fetchAllCanvasData } from './sources/canvas.js';
import { fetchPlaudRecordings, plaudToContent } from './sources/plaud.js';
import { fetchRemarkableNotes, remarkableToContent } from './sources/remarkable.js';
import { mergeGoldStandard, getGoldStandardStats } from './normalize.js';
import { verify } from './verify.js';
import { push } from './push.js';
import type { GoldStandard } from './types.js';

const program = new Command();

program
  .name('sync-service')
  .description('Study Aide Sync Service - Canvas, Plaud, Remarkable integration')
  .version('1.0.0');

// Pull command
program
  .command('pull')
  .description('Pull all sources and build gold standard')
  .option('--canvas-only', 'Only pull Canvas data')
  .option('--plaud-only', 'Only pull Plaud recordings')
  .option('--remarkable-only', 'Only pull Remarkable notes')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📥 Study Aide Sync - Pull\n'));

    const goldPath = join(config.paths.goldStandard, 'gold-standard.json');
    let existing: GoldStandard | null = null;

    try {
      const content = await readFile(goldPath, 'utf-8');
      existing = JSON.parse(content);
      console.log(chalk.dim(`Loaded existing gold standard from ${new Date(existing!.generatedAt).toLocaleDateString()}`));
    } catch {
      console.log(chalk.dim('Creating new gold standard...'));
    }

    const newData: Partial<GoldStandard> = {};

    // Canvas
    if (!options.plaudOnly && !options.remarkableOnly) {
      const spinner = ora('Fetching Canvas data...').start();
      try {
        const canvasData = await fetchAllCanvasData();
        newData.courses = canvasData.courses;
        newData.tasks = canvasData.tasks;
        newData.content = canvasData.content;
        newData.modules = canvasData.modules;
        newData.grades = canvasData.grades;
        newData.calendarEvents = canvasData.calendarEvents;
        spinner.succeed(`Canvas: ${canvasData.courses.length} courses, ${canvasData.tasks.length} tasks, ${canvasData.content.length} content items`);
      } catch (e) {
        spinner.fail(`Canvas error: ${e}`);
      }
    }

    // Plaud
    if (!options.canvasOnly && !options.remarkableOnly) {
      const spinner = ora('Fetching Plaud recordings...').start();
      try {
        const recordings = await fetchPlaudRecordings();
        newData.plaudRecordings = recordings;
        const plaudContent = plaudToContent(recordings);
        newData.content = [...(newData.content || []), ...plaudContent];
        
        const matched = recordings.filter(r => r.matchedCourseId).length;
        spinner.succeed(`Plaud: ${recordings.length} recordings (${matched} matched to courses)`);
      } catch (e) {
        spinner.fail(`Plaud error: ${e}`);
      }
    }

    // Remarkable
    if (!options.canvasOnly && !options.plaudOnly) {
      const spinner = ora('Fetching Remarkable notes...').start();
      try {
        const notes = await fetchRemarkableNotes();
        newData.remarkableNotes = notes;
        const remarkableContent = remarkableToContent(notes);
        newData.content = [...(newData.content || []), ...remarkableContent];
        
        const matched = notes.filter(n => n.matchedCourseId).length;
        spinner.succeed(`Remarkable: ${notes.length} notes (${matched} matched to courses)`);
      } catch (e) {
        spinner.fail(`Remarkable error: ${e}`);
      }
    }

    // Merge and save
    const merged = mergeGoldStandard(existing, newData);
    await mkdir(config.paths.goldStandard, { recursive: true });
    await writeFile(goldPath, JSON.stringify(merged, null, 2));

    console.log(chalk.green.bold(`\n✅ Gold standard saved`));
    console.log(chalk.dim(getGoldStandardStats(merged)));
    console.log();
  });

// Push command
program
  .command('push')
  .description('Push normalized data to hub API')
  .option('--prod', 'Push to production hub')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📤 Study Aide Sync - Push\n'));

    const spinner = ora('Pushing to hub...').start();
    const result = await push({ production: options.prod });

    if (result.success) {
      spinner.succeed(`Pushed: ${result.coursesUpserted} courses, ${result.tasksUpserted} tasks, ${result.contentUpserted} content`);
    } else {
      spinner.warn(`Partial push: ${result.coursesUpserted} courses, ${result.tasksUpserted} tasks, ${result.contentUpserted} content`);
      if (result.errors.length > 0) {
        console.log(chalk.yellow('\nErrors:'));
        result.errors.slice(0, 5).forEach(e => console.log(chalk.dim(`  - ${e}`)));
        if (result.errors.length > 5) {
          console.log(chalk.dim(`  ... and ${result.errors.length - 5} more`));
        }
      }
    }
    console.log();
  });

// Verify command
program
  .command('verify')
  .description('Compare app DB vs gold standard')
  .option('--verbose', 'Show all missing items')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔍 Study Aide Sync - Verify\n'));

    const result = await verify();
    
    console.log(chalk.bold(result.summary));
    
    if (options.verbose) {
      if (result.tasksMatch.missing.length > 0) {
        console.log(chalk.yellow('\nMissing tasks:'));
        result.tasksMatch.missing.forEach(t => console.log(chalk.dim(`  - ${t}`)));
      }
      if (result.contentMatch.missing.length > 0) {
        console.log(chalk.yellow('\nMissing content:'));
        result.contentMatch.missing.slice(0, 20).forEach(c => console.log(chalk.dim(`  - ${c}`)));
        if (result.contentMatch.missing.length > 20) {
          console.log(chalk.dim(`  ... and ${result.contentMatch.missing.length - 20} more`));
        }
      }
    }
    console.log();
  });

// Sync command (pull + push + verify)
program
  .command('sync')
  .description('Full sync: pull + push + verify')
  .option('--prod', 'Push to production')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔄 Study Aide Sync - Full Sync\n'));

    // Pull
    console.log(chalk.bold('Step 1: Pull'));
    await program.commands.find(c => c.name() === 'pull')?.parseAsync(['node', 'sync', 'pull']);

    // Push
    console.log(chalk.bold('Step 2: Push'));
    await push({ production: options.prod });

    // Verify
    console.log(chalk.bold('Step 3: Verify'));
    const result = await verify();
    console.log(chalk.bold(result.summary));

    console.log(chalk.green.bold('\n✅ Sync complete\n'));
  });

// Status command
program
  .command('status')
  .description('Show current gold standard status')
  .action(async () => {
    const goldPath = join(config.paths.goldStandard, 'gold-standard.json');
    
    try {
      const content = await readFile(goldPath, 'utf-8');
      const gold: GoldStandard = JSON.parse(content);
      
      console.log(chalk.blue.bold('\n📊 Gold Standard Status\n'));
      console.log(`Generated: ${new Date(gold.generatedAt).toLocaleString()}`);
      console.log();
      console.log(chalk.bold('Courses:'));
      gold.courses.forEach(c => console.log(`  - ${c.name} (${c.id})`));
      console.log();
      console.log(getGoldStandardStats(gold));
    } catch {
      console.log(chalk.yellow('No gold standard found. Run `npm run pull` first.'));
    }
    console.log();
  });

program.parse();
