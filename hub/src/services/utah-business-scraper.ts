/**
 * JD Agent - Utah Business Registry Scraper
 *
 * Scrapes the Utah Division of Corporations database for businesses
 * within a specified age range (formation date).
 *
 * Flow:
 * 1. Navigate to Utah business entity search
 * 2. Search using 3-letter prefixes
 * 3. Handle partial/full results dialog
 * 4. Extract business data including File Date
 * 5. Filter by age range and save results
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const SEARCH_URL = 'https://businessregistration.utah.gov/';
const STORAGE_PATH = join(process.env.HOME || '/tmp', '.jd-agent', 'utah-business');
const STATE_FILE = join(STORAGE_PATH, 'scraper-state.json');
const RESULTS_FILE = join(STORAGE_PATH, 'results.json');

interface ScraperState {
  lastSyncTime: string;
  completedPrefixes: string[];
  totalFound: number;
}

export interface UtahBusiness {
  entityNumber: string;
  name: string;
  otherName?: string;
  filingDateTime?: string;
  status?: string;
  statusDetails?: string;
  fileDate?: string;
  fileYear?: number;
  entityType?: string;
  subtype?: string;
}

interface ScrapeResult {
  success: boolean;
  businesses: UtahBusiness[];
  totalScraped: number;
  matchingAgeRange: number;
  errors: string[];
}

export class UtahBusinessScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private minAge: number;
  private maxAge: number;
  private minYear: number;
  private maxYear: number;
  private activeOnly: boolean;

  constructor(minAge: number = 20, maxAge: number = 30, activeOnly: boolean = true) {
    this.minAge = minAge;
    this.maxAge = maxAge;
    this.activeOnly = activeOnly;

    const currentYear = new Date().getFullYear();
    this.minYear = currentYear - maxAge; // 1996 for 30 years
    this.maxYear = currentYear - minAge; // 2006 for 20 years

    // Ensure storage path exists
    if (!existsSync(STORAGE_PATH)) {
      mkdirSync(STORAGE_PATH, { recursive: true });
    }
  }

  private loadState(): ScraperState {
    try {
      if (existsSync(STATE_FILE)) {
        return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('[UtahScraper] Error loading state:', e);
    }
    return { lastSyncTime: '', completedPrefixes: [], totalFound: 0 };
  }

  private saveState(state: ScraperState): void {
    try {
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('[UtahScraper] Error saving state:', e);
    }
  }

  private saveResults(businesses: UtahBusiness[]): void {
    try {
      writeFileSync(RESULTS_FILE, JSON.stringify(businesses, null, 2));
      console.log(`[UtahScraper] Saved ${businesses.length} results to ${RESULTS_FILE}`);
    } catch (e) {
      console.error('[UtahScraper] Error saving results:', e);
    }
  }

  async init(): Promise<void> {
    if (this.browser) return;

    console.log('[UtahScraper] Launching browser...');
    this.browser = await chromium.launch({
      headless: true,
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  private isInAgeRange(fileDate: string): boolean {
    // Parse date like "12/18/2001 12:00 AM" or "12/18/2001"
    const parts = fileDate.split(' ')[0].split('/');
    if (parts.length < 3) return false;
    const year = parseInt(parts[2]);
    return year >= this.minYear && year <= this.maxYear;
  }

  private extractYear(fileDate: string): number {
    const parts = fileDate.split(' ')[0].split('/');
    if (parts.length < 3) return 0;
    return parseInt(parts[2]);
  }

  async navigateToSearch(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('[UtahScraper] Navigating to search page...');

    try {
      await this.page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // Click "Search Business Entity Records" link
      const searchLink = this.page.locator('a:has-text("Search Business Entity Records")');
      if (await searchLink.count() > 0) {
        await searchLink.click();
        await this.page.waitForTimeout(5000);
        console.log(`[UtahScraper] Navigated to: ${this.page.url()}`);
        return true;
      }

      console.log('[UtahScraper] Could not find search link');
      return false;
    } catch (e) {
      console.error('[UtahScraper] Navigation error:', e);
      return false;
    }
  }

  async searchByPrefix(prefix: string): Promise<UtahBusiness[]> {
    if (!this.page) throw new Error('Browser not initialized');

    const businesses: UtahBusiness[] = [];

    console.log(`[UtahScraper] Searching for prefix: "${prefix}"...`);

    try {
      // Fill search field
      await this.page.locator('#BusinessSearch_Index_txtEntityName').fill(prefix);

      // Click search
      await this.page.locator('#btnSearch').click();
      await this.page.waitForTimeout(3000);

      // Handle Partial/Full dialog if it appears
      const partialBtn = this.page.locator('button:has-text("Partial")');
      if (await partialBtn.count() > 0 && await partialBtn.isVisible()) {
        console.log(`[UtahScraper] Large result set, clicking Partial (first 500)...`);
        await partialBtn.click();
        await this.page.waitForTimeout(5000);
      }

      // Check for "no results" or error messages
      const bodyText = await this.page.locator('body').innerText();
      if (bodyText.toLowerCase().includes('no records found') ||
          bodyText.toLowerCase().includes('please enter at least')) {
        console.log(`[UtahScraper] No results for prefix "${prefix}"`);
        return businesses;
      }

      // Extract results from table
      const rows = await this.page.locator('tbody tr').all();
      console.log(`[UtahScraper] Found ${rows.length} rows for "${prefix}"`);

      for (let i = 0; i < rows.length; i++) {
        try {
          const cells = await rows[i].locator('td').allTextContents();
          if (cells.length < 9) continue;

          // Headers: Name | Other Name | Filing Date/Time | Status | Status Details | File Date | Type | Subtype | Entity Number
          const name = cells[0]?.trim() || '';
          const otherName = cells[1]?.trim() || '';
          const filingDateTime = cells[2]?.trim() || '';
          const status = cells[3]?.trim() || '';
          const statusDetails = cells[4]?.trim() || '';
          const fileDate = cells[5]?.trim() || '';
          const entityType = cells[6]?.trim() || '';
          const subtype = cells[7]?.trim() || '';
          const entityNumber = cells[8]?.trim() || '';

          if (!name || !fileDate) continue;

          // Check if active (if filter enabled)
          if (this.activeOnly && status.toLowerCase() !== 'active') {
            continue;
          }

          // Check if in target date range
          if (this.isInAgeRange(fileDate)) {
            const business: UtahBusiness = {
              entityNumber,
              name,
              otherName,
              filingDateTime,
              status,
              statusDetails,
              fileDate,
              fileYear: this.extractYear(fileDate),
              entityType,
              subtype,
            };
            businesses.push(business);
          }
        } catch (e) {
          // Skip this row
        }
      }

      console.log(`[UtahScraper] Found ${businesses.length} businesses in target range for "${prefix}"`);

    } catch (e) {
      console.error(`[UtahScraper] Error searching prefix "${prefix}":`, e);
    }

    return businesses;
  }

  generatePrefixes(): string[] {
    // Generate 3-letter prefixes for systematic searching
    // Start with common business name prefixes
    const prefixes: string[] = [];

    // Common business prefixes
    const commonPrefixes = [
      'AAA', 'ABC', 'ACE', 'ALL', 'AME', 'ATL', 'BES', 'BIG', 'BLU',
      'CAP', 'CEN', 'CIT', 'COM', 'CON', 'COR', 'DES', 'DIA', 'EAS',
      'ENT', 'FAM', 'FIR', 'FRO', 'GEN', 'GOL', 'GRA', 'GRE', 'HIG',
      'HOL', 'INT', 'JOH', 'KIN', 'LAK', 'LEG', 'MAR', 'MED', 'MOU',
      'NAT', 'NOR', 'OLY', 'PAC', 'PAR', 'PEA', 'PRE', 'PRI', 'PRO',
      'QUA', 'RED', 'ROC', 'SAL', 'SIL', 'SOU', 'STA', 'STE', 'SUN',
      'TEC', 'THE', 'TRI', 'UNI', 'UTA', 'VAL', 'VEN', 'WAS', 'WES',
      'WHI', 'WIL', 'WOR', 'ZIO',
    ];

    prefixes.push(...commonPrefixes);

    return prefixes;
  }

  async scrape(maxPrefixes: number = 20): Promise<ScrapeResult> {
    const result: ScrapeResult = {
      success: false,
      businesses: [],
      totalScraped: 0,
      matchingAgeRange: 0,
      errors: [],
    };

    console.log(`[UtahScraper] Starting scrape for businesses ${this.minAge}-${this.maxAge} years old`);
    console.log(`[UtahScraper] Target date range: ${this.minYear}-${this.maxYear}`);
    console.log(`[UtahScraper] Active only: ${this.activeOnly}`);

    try {
      await this.init();

      const navigated = await this.navigateToSearch();
      if (!navigated) {
        result.errors.push('Failed to navigate to search page');
        return result;
      }

      const state = this.loadState();
      const prefixes = this.generatePrefixes();
      const allBusinesses: Map<string, UtahBusiness> = new Map();

      let prefixesProcessed = 0;

      for (const prefix of prefixes) {
        if (prefixesProcessed >= maxPrefixes) {
          console.log(`[UtahScraper] Reached max prefixes limit (${maxPrefixes})`);
          break;
        }

        if (state.completedPrefixes.includes(prefix)) {
          console.log(`[UtahScraper] Skipping already processed prefix: ${prefix}`);
          continue;
        }

        // Navigate back to search page for each prefix
        await this.navigateToSearch();

        const businesses = await this.searchByPrefix(prefix);

        for (const biz of businesses) {
          allBusinesses.set(biz.entityNumber, biz);
        }

        state.completedPrefixes.push(prefix);
        prefixesProcessed++;

        // Small delay to be respectful
        await this.page!.waitForTimeout(1000);
      }

      result.businesses = Array.from(allBusinesses.values());
      result.totalScraped = result.businesses.length;
      result.matchingAgeRange = result.businesses.length;
      result.success = true;

      // Save results
      this.saveResults(result.businesses);

      state.lastSyncTime = new Date().toISOString();
      state.totalFound = result.businesses.length;
      this.saveState(state);

      console.log(`[UtahScraper] Scrape complete. Found ${result.businesses.length} businesses in target range.`);

    } catch (e) {
      result.errors.push(String(e));
      console.error('[UtahScraper] Scrape failed:', e);
    } finally {
      await this.close();
    }

    return result;
  }

  /**
   * Quick test search to verify the scraper works
   */
  async testSearch(): Promise<UtahBusiness[]> {
    console.log('[UtahScraper] Running test search...');

    try {
      await this.init();
      const navigated = await this.navigateToSearch();
      if (!navigated) {
        throw new Error('Failed to navigate to search');
      }

      const businesses = await this.searchByPrefix('UTA');
      await this.close();

      return businesses;
    } catch (e) {
      console.error('[UtahScraper] Test search failed:', e);
      await this.close();
      return [];
    }
  }

  /**
   * Load results from the saved JSON file
   */
  loadResults(): UtahBusiness[] {
    try {
      if (existsSync(RESULTS_FILE)) {
        return JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('[UtahScraper] Error loading results:', e);
    }
    return [];
  }

  /**
   * Import saved results to database
   * This imports from the results.json file that was saved during scraping
   */
  async importToDatabase(): Promise<{ imported: number; skipped: number; errors: string[] }> {
    // Dynamically import to avoid circular dependencies
    const { acquisitionService } = await import('./acquisition-service');

    const businesses = this.loadResults();
    if (businesses.length === 0) {
      console.log('[UtahScraper] No results to import. Run scrape first.');
      return { imported: 0, skipped: 0, errors: ['No results found'] };
    }

    console.log(`[UtahScraper] Importing ${businesses.length} businesses to database...`);
    const result = await acquisitionService.importFromScraper(businesses);
    console.log(`[UtahScraper] Import complete: ${result.imported} imported, ${result.skipped} skipped`);

    return result;
  }

  /**
   * Run full scrape and import to database
   */
  async scrapeAndImport(maxPrefixes: number = 20): Promise<{
    scrapeResult: ScrapeResult;
    importResult: { imported: number; skipped: number; errors: string[] };
  }> {
    const scrapeResult = await this.scrape(maxPrefixes);

    if (scrapeResult.success && scrapeResult.businesses.length > 0) {
      const importResult = await this.importToDatabase();
      return { scrapeResult, importResult };
    }

    return {
      scrapeResult,
      importResult: { imported: 0, skipped: 0, errors: ['Scrape failed or no results'] },
    };
  }
}

export const utahBusinessScraper = new UtahBusinessScraper(20, 30);
