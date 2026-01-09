/**
 * Migration Runner - Orchestrate the full migration workflow
 *
 * Workflow:
 * 1. Extract data from source(s)
 * 2. Classify with AI
 * 3. Import to vault
 * 4. Report results
 */

import type { RawEntry, ClassificationResult } from '../types';
import { classificationService } from '../services/classification-service';
import { importService } from '../services/import-service';

// Import extractors
import { createNotionExtractor } from '../integrations/notion';
import { createGoogleDriveExtractor } from '../integrations/google-drive-extractor';
import { createAppleNotesExtractor } from '../integrations/apple-notes-extractor';
import { createTodoistExtractor } from '../integrations/todoist-extractor-v2';

// ============================================
// Types
// ============================================

export interface MigrationConfig {
  sources: {
    notion?: {
      apiKey: string;
      includeArchived?: boolean;
      limit?: number; // For testing
    };
    googleDrive?: {
      credentials: {
        clientId: string;
        clientSecret: string;
        refreshToken: string;
      };
      rootFolderId?: string;
      limit?: number;
    };
    appleNotes?: {
      includeFolders?: string[];
      excludeFolders?: string[];
      limit?: number;
    };
    todoist?: {
      apiKey: string;
      includeProjects?: string[];
      limit?: number;
    };
  };
  options: {
    dryRun?: boolean; // Don't actually import
    skipClassification?: boolean; // Skip AI classification (use fallback)
    checkDuplicates?: boolean; // Check for duplicates before import
    batchSize?: number; // Process in batches
  };
}

export interface MigrationResult {
  source: string;
  extracted: number;
  classified: number;
  imported: number;
  skipped: number;
  failed: number;
  duplicates: number;
  errors: Array<{ entry: string; error: string }>;
  resumes: number; // Count of resumes detected
}

// ============================================
// Migration Runner
// ============================================

export class MigrationRunner {
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
  }

  /**
   * Run full migration for all configured sources
   */
  async run(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    console.log('🚀 Starting migration...\n');

    // Migrate from each source
    if (this.config.sources.notion) {
      console.log('📘 Migrating from Notion...');
      const result = await this.migrateNotion(this.config.sources.notion);
      results.push(result);
      console.log('');
    }

    if (this.config.sources.googleDrive) {
      console.log('📁 Migrating from Google Drive...');
      const result = await this.migrateGoogleDrive(this.config.sources.googleDrive);
      results.push(result);
      console.log('');
    }

    if (this.config.sources.appleNotes) {
      console.log('🍎 Migrating from Apple Notes...');
      const result = await this.migrateAppleNotes(this.config.sources.appleNotes);
      results.push(result);
      console.log('');
    }

    if (this.config.sources.todoist) {
      console.log('✅ Migrating from Todoist...');
      const result = await this.migrateTodoist(this.config.sources.todoist);
      results.push(result);
      console.log('');
    }

    // Print summary
    this.printSummary(results);

    return results;
  }

  /**
   * Migrate from Notion
   */
  private async migrateNotion(config: MigrationConfig['sources']['notion']): Promise<MigrationResult> {
    const result: MigrationResult = {
      source: 'Notion',
      extracted: 0,
      classified: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      resumes: 0,
    };

    try {
      const extractor = createNotionExtractor(config!.apiKey, {
        includeArchived: config!.includeArchived,
      });

      const entries: RawEntry[] = [];

      // Extract entries
      for await (const entry of extractor.extractAll()) {
        entries.push(entry);
        result.extracted++;

        if (config!.limit && entries.length >= config!.limit) {
          break;
        }
      }

      console.log(`Extracted ${entries.length} entries from Notion`);

      // Process entries
      await this.processEntries(entries, result);
    } catch (error: any) {
      console.error('Error migrating from Notion:', error.message);
      result.errors.push({ entry: 'Notion', error: error.message });
    }

    return result;
  }

  /**
   * Migrate from Google Drive
   */
  private async migrateGoogleDrive(
    config: MigrationConfig['sources']['googleDrive']
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      source: 'Google Drive',
      extracted: 0,
      classified: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      resumes: 0,
    };

    try {
      const extractor = createGoogleDriveExtractor(config!);

      const entries: RawEntry[] = [];

      for await (const entry of extractor.extractAll()) {
        entries.push(entry);
        result.extracted++;

        if (config!.limit && entries.length >= config!.limit) {
          break;
        }
      }

      console.log(`Extracted ${entries.length} entries from Google Drive`);

      await this.processEntries(entries, result);
    } catch (error: any) {
      console.error('Error migrating from Google Drive:', error.message);
      result.errors.push({ entry: 'Google Drive', error: error.message });
    }

    return result;
  }

  /**
   * Migrate from Apple Notes
   */
  private async migrateAppleNotes(
    config: MigrationConfig['sources']['appleNotes']
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      source: 'Apple Notes',
      extracted: 0,
      classified: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      resumes: 0,
    };

    try {
      const extractor = createAppleNotesExtractor(config);

      // Check access first
      const hasAccess = await extractor.checkAccess();
      if (!hasAccess) {
        throw new Error('No access to Apple Notes');
      }

      const entries: RawEntry[] = [];

      for await (const entry of extractor.extractAll()) {
        entries.push(entry);
        result.extracted++;

        if (config!.limit && entries.length >= config!.limit) {
          break;
        }
      }

      console.log(`Extracted ${entries.length} entries from Apple Notes`);

      await this.processEntries(entries, result);
    } catch (error: any) {
      console.error('Error migrating from Apple Notes:', error.message);
      result.errors.push({ entry: 'Apple Notes', error: error.message });
    }

    return result;
  }

  /**
   * Migrate from Todoist
   */
  private async migrateTodoist(
    config: MigrationConfig['sources']['todoist']
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      source: 'Todoist',
      extracted: 0,
      classified: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      resumes: 0,
    };

    try {
      const extractor = createTodoistExtractor(config!.apiKey, {
        includeProjects: config!.includeProjects,
      });

      const entries: RawEntry[] = [];

      for await (const entry of extractor.extractAll()) {
        entries.push(entry);
        result.extracted++;

        if (config!.limit && entries.length >= config!.limit) {
          break;
        }
      }

      console.log(`Extracted ${entries.length} task lists from Todoist`);

      await this.processEntries(entries, result);
    } catch (error: any) {
      console.error('Error migrating from Todoist:', error.message);
      result.errors.push({ entry: 'Todoist', error: error.message });
    }

    return result;
  }

  /**
   * Process entries (classify and import)
   */
  private async processEntries(entries: RawEntry[], result: MigrationResult): Promise<void> {
    // Classify all entries
    console.log('🤖 Classifying entries...');

    const classified: Array<{ raw: RawEntry; classification: ClassificationResult }> = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      try {
        const classification = this.config.options.skipClassification
          ? this.getFallbackClassification(entry)
          : await classificationService.classify(entry);

        classified.push({ raw: entry, classification });
        result.classified++;

        // Track resumes
        if (classification.contentType === 'resume') {
          result.resumes++;
          console.log(`  📄 Resume detected: ${entry.title}`);
        }

        // Progress
        if ((i + 1) % 10 === 0 || i === entries.length - 1) {
          console.log(`  Classified ${i + 1}/${entries.length}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error classifying ${entry.title}:`, error.message);
        result.errors.push({ entry: entry.title, error: error.message });
      }
    }

    // Import entries
    console.log('💾 Importing to vault...');

    const importResult = await importService.importBatch(
      classified,
      {
        checkDuplicates: this.config.options.checkDuplicates ?? true,
        dryRun: this.config.options.dryRun ?? false,
        skipOnError: true,
      },
      (current, total) => {
        if (current % 10 === 0 || current === total) {
          console.log(`  Imported ${current}/${total}`);
        }
      }
    );

    result.imported = importResult.imported;
    result.skipped = importResult.skipped;
    result.failed += importResult.failed;
    result.duplicates = importResult.duplicates;
    result.errors.push(...importResult.errors);
  }

  /**
   * Get fallback classification (rule-based)
   */
  private getFallbackClassification(entry: RawEntry): ClassificationResult {
    return {
      contentType: 'note',
      category: 'archive',
      tags: ['imported'],
      summary: `Imported from ${entry.source}`,
      isUseful: true,
      suggestedAction: 'keep',
      confidence: 0.5,
    };
  }

  /**
   * Print summary of migration
   */
  private printSummary(results: MigrationResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60) + '\n');

    const totals = {
      extracted: 0,
      classified: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      resumes: 0,
    };

    for (const result of results) {
      console.log(`${result.source}:`);
      console.log(`  ✓ Extracted:  ${result.extracted}`);
      console.log(`  ✓ Classified: ${result.classified}`);
      console.log(`  ✓ Imported:   ${result.imported}`);
      if (result.resumes > 0) {
        console.log(`  📄 Resumes:   ${result.resumes}`);
      }
      if (result.duplicates > 0) {
        console.log(`  ⊗ Duplicates: ${result.duplicates}`);
      }
      if (result.skipped > 0) {
        console.log(`  ⊘ Skipped:    ${result.skipped}`);
      }
      if (result.failed > 0) {
        console.log(`  ✗ Failed:     ${result.failed}`);
      }
      console.log('');

      totals.extracted += result.extracted;
      totals.classified += result.classified;
      totals.imported += result.imported;
      totals.skipped += result.skipped;
      totals.failed += result.failed;
      totals.duplicates += result.duplicates;
      totals.resumes += result.resumes;
    }

    console.log('TOTALS:');
    console.log(`  ✓ Extracted:  ${totals.extracted}`);
    console.log(`  ✓ Classified: ${totals.classified}`);
    console.log(`  ✓ Imported:   ${totals.imported}`);
    if (totals.resumes > 0) {
      console.log(`  📄 Resumes:   ${totals.resumes} ⭐`);
    }
    if (totals.duplicates > 0) {
      console.log(`  ⊗ Duplicates: ${totals.duplicates}`);
    }
    if (totals.skipped > 0) {
      console.log(`  ⊘ Skipped:    ${totals.skipped}`);
    }
    if (totals.failed > 0) {
      console.log(`  ✗ Failed:     ${totals.failed}`);
    }
    console.log('\n' + '='.repeat(60) + '\n');

    // Print any errors
    const allErrors = results.flatMap(r => r.errors);
    if (allErrors.length > 0) {
      console.log('⚠️  ERRORS:');
      for (const error of allErrors) {
        console.log(`  - ${error.entry}: ${error.error}`);
      }
      console.log('');
    }

    if (this.config.options.dryRun) {
      console.log('ℹ️  This was a DRY RUN - no data was actually imported');
      console.log('');
    }
  }
}

// ============================================
// Helper: Quick Migration
// ============================================

/**
 * Run a quick test migration with limited entries
 */
export async function quickMigration(sources: {
  notion?: string;
  todoist?: string;
  googleDrive?: any;
  appleNotes?: boolean;
}) {
  const config: MigrationConfig = {
    sources: {},
    options: {
      dryRun: false,
      checkDuplicates: true,
      batchSize: 10,
    },
  };

  if (sources.notion) {
    config.sources.notion = {
      apiKey: sources.notion,
      limit: 5, // Only 5 pages for testing
    };
  }

  if (sources.todoist) {
    config.sources.todoist = {
      apiKey: sources.todoist,
      limit: 3, // Only 3 projects
    };
  }

  if (sources.googleDrive) {
    config.sources.googleDrive = {
      ...sources.googleDrive,
      limit: 5,
    };
  }

  if (sources.appleNotes) {
    config.sources.appleNotes = {
      limit: 5,
    };
  }

  const runner = new MigrationRunner(config);
  return await runner.run();
}
