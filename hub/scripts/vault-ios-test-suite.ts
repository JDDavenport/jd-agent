#!/usr/bin/env bun
/**
 * Vault iOS Comprehensive Test Suite
 *
 * Non-intrusive testing that doesn't take over your screen.
 *
 * Usage:
 *   bun run scripts/vault-ios-test-suite.ts
 *   bun run scripts/vault-ios-test-suite.ts --build-only
 *   bun run scripts/vault-ios-test-suite.ts --api-only
 *   bun run scripts/vault-ios-test-suite.ts --screenshots-only
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

// ============================================
// Configuration
// ============================================

const CONFIG = {
  vaultAppPath: join(dirname(dirname(__dirname)), 'apps/vault'),
  hubPath: dirname(__dirname),
  bundleId: 'com.jdagent.vault',
  screenshotDir: join(dirname(__dirname), 'storage/ios-test-screenshots'),
  reportDir: join(dirname(__dirname), 'storage/ios-test-reports'),
  expectedApiUrl: process.env.VITE_API_URL || 'http://10.34.144.203:3000',
};

// ============================================
// Types
// ============================================

interface TestResult {
  name: string;
  category: 'build' | 'api' | 'ui' | 'functionality';
  status: 'pass' | 'fail' | 'skip' | 'warn';
  message: string;
  details?: string;
  duration?: number;
}

interface TestReport {
  timestamp: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
  };
  results: TestResult[];
  screenshots: string[];
}

// ============================================
// Test Runner
// ============================================

class VaultTestSuite {
  private results: TestResult[] = [];
  private screenshots: string[] = [];
  private startTime: number = 0;

  async runAll(): Promise<TestReport> {
    this.startTime = Date.now();
    this.results = [];
    this.screenshots = [];

    console.log('\n🧪 Vault iOS Test Suite\n');
    console.log('═'.repeat(50));

    // Ensure directories exist
    for (const dir of [CONFIG.screenshotDir, CONFIG.reportDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Run test categories
    await this.runBuildTests();
    await this.runApiTests();
    await this.runSimulatorTests();
    await this.runScreenshotTests();

    // Generate report
    const report = this.generateReport();
    this.printSummary(report);
    this.saveReport(report);

    return report;
  }

  async runBuildOnly(): Promise<TestReport> {
    this.startTime = Date.now();
    this.results = [];
    console.log('\n🔨 Build Verification Tests\n');
    await this.runBuildTests();
    const report = this.generateReport();
    this.printSummary(report);
    return report;
  }

  async runApiOnly(): Promise<TestReport> {
    this.startTime = Date.now();
    this.results = [];
    console.log('\n🌐 API Connectivity Tests\n');
    await this.runApiTests();
    const report = this.generateReport();
    this.printSummary(report);
    return report;
  }

  async runScreenshotsOnly(): Promise<TestReport> {
    this.startTime = Date.now();
    this.results = [];
    this.screenshots = [];
    console.log('\n📸 Screenshot Tests\n');
    await this.runSimulatorTests();
    await this.runScreenshotTests();
    const report = this.generateReport();
    this.printSummary(report);
    this.saveReport(report);
    return report;
  }

  // ============================================
  // Build Verification Tests
  // ============================================

  private async runBuildTests(): Promise<void> {
    console.log('\n📦 Build Verification\n');

    // Test 1: Check .env.production exists and has correct API URL
    this.test('build', 'Environment Configuration', () => {
      const envPath = join(CONFIG.vaultAppPath, '.env.production');
      if (!existsSync(envPath)) {
        return { status: 'fail', message: '.env.production file missing' };
      }
      const content = readFileSync(envPath, 'utf-8');
      if (!content.includes('VITE_API_URL=')) {
        return { status: 'fail', message: 'VITE_API_URL not set in .env.production' };
      }
      const match = content.match(/VITE_API_URL=(.+)/);
      const url = match?.[1]?.trim();
      if (url?.includes('railway')) {
        return { status: 'warn', message: `API URL points to Railway (may be down): ${url}` };
      }
      return { status: 'pass', message: `API URL: ${url}` };
    });

    // Test 2: Check tauri.conf.json has correct frontendDist
    this.test('build', 'Tauri Configuration', () => {
      const confPath = join(CONFIG.vaultAppPath, 'src-tauri/tauri.conf.json');
      if (!existsSync(confPath)) {
        return { status: 'fail', message: 'tauri.conf.json not found' };
      }
      const conf = JSON.parse(readFileSync(confPath, 'utf-8'));
      const frontendDist = conf.build?.frontendDist;
      if (!frontendDist) {
        return { status: 'fail', message: 'frontendDist not configured' };
      }
      if (frontendDist.startsWith('http')) {
        return { status: 'fail', message: `frontendDist points to remote URL: ${frontendDist}` };
      }
      const beforeBuildCmd = conf.build?.beforeBuildCommand;
      if (!beforeBuildCmd || beforeBuildCmd === '') {
        return { status: 'warn', message: 'beforeBuildCommand is empty - frontend may not build' };
      }
      return { status: 'pass', message: `frontendDist: ${frontendDist}, beforeBuildCommand: ${beforeBuildCmd}` };
    });

    // Test 3: Check dist folder exists and has assets
    this.test('build', 'Frontend Build Output', () => {
      const distPath = join(CONFIG.vaultAppPath, 'dist');
      if (!existsSync(distPath)) {
        return { status: 'fail', message: 'dist/ folder not found - run bun run build' };
      }
      const assetsPath = join(distPath, 'assets');
      if (!existsSync(assetsPath)) {
        return { status: 'fail', message: 'dist/assets/ not found' };
      }
      const files = readdirSync(assetsPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      const cssFiles = files.filter(f => f.endsWith('.css'));
      if (jsFiles.length === 0) {
        return { status: 'fail', message: 'No JS files in dist/assets/' };
      }
      return { status: 'pass', message: `${jsFiles.length} JS files, ${cssFiles.length} CSS files` };
    });

    // Test 4: Check API URL in built JS (no Railway URL)
    this.test('build', 'Built API URL Verification', () => {
      const distPath = join(CONFIG.vaultAppPath, 'dist/assets');
      if (!existsSync(distPath)) {
        return { status: 'skip', message: 'dist/assets not found' };
      }
      const files = readdirSync(distPath).filter(f => f.endsWith('.js'));
      let foundRailway = false;
      let foundCorrectUrl = false;

      for (const file of files) {
        const content = readFileSync(join(distPath, file), 'utf-8');
        if (content.includes('railway.app')) {
          foundRailway = true;
        }
        if (content.includes('10.34.144.203') || content.includes('localhost:3000')) {
          foundCorrectUrl = true;
        }
      }

      if (foundRailway) {
        return { status: 'fail', message: 'Built JS still contains Railway URL - rebuild needed' };
      }
      if (!foundCorrectUrl) {
        return { status: 'warn', message: 'Could not verify API URL in built JS' };
      }
      return { status: 'pass', message: 'API URL correctly embedded in build' };
    });

    // Test 5: Check iOS build exists
    this.test('build', 'iOS Build Artifacts', () => {
      const ipaPath = join(CONFIG.vaultAppPath, 'src-tauri/gen/apple/build/arm64/JD Vault.ipa');
      const simAppPath = join(CONFIG.vaultAppPath, 'src-tauri/gen/apple/build/arm64-sim/JD Vault.app');

      const hasIpa = existsSync(ipaPath);
      const hasSimApp = existsSync(simAppPath);

      if (!hasIpa && !hasSimApp) {
        return { status: 'fail', message: 'No iOS builds found - run: bunx tauri ios build' };
      }

      const parts = [];
      if (hasIpa) parts.push('IPA (device)');
      if (hasSimApp) parts.push('App (simulator)');

      return { status: 'pass', message: `Found: ${parts.join(', ')}` };
    });
  }

  // ============================================
  // API Connectivity Tests
  // ============================================

  private async runApiTests(): Promise<void> {
    console.log('\n🌐 API Connectivity\n');

    // Test 1: Hub health check (localhost)
    await this.asyncTest('api', 'Hub Health (localhost)', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/health');
        if (!response.ok) {
          return { status: 'fail', message: `Hub returned ${response.status}` };
        }
        const data = await response.json() as any;
        return { status: 'pass', message: `Hub healthy - uptime: ${data.uptime}s` };
      } catch (error: any) {
        return { status: 'fail', message: `Hub not reachable: ${error.message}` };
      }
    });

    // Test 2: Hub health check (network IP)
    await this.asyncTest('api', 'Hub Health (network IP)', async () => {
      try {
        const ip = execSync('ipconfig getifaddr en0', { encoding: 'utf-8' }).trim();
        const response = await fetch(`http://${ip}:3000/api/health`);
        if (!response.ok) {
          return { status: 'fail', message: `Hub not reachable on ${ip}:3000` };
        }
        return { status: 'pass', message: `Hub reachable at ${ip}:3000` };
      } catch (error: any) {
        return { status: 'fail', message: `Network access failed: ${error.message}` };
      }
    });

    // Test 3: Vault pages endpoint
    await this.asyncTest('api', 'Vault Pages API', async () => {
      try {
        const response = await fetch('http://localhost:3000/api/vault/pages');
        if (!response.ok) {
          return { status: 'fail', message: `API returned ${response.status}` };
        }
        const data = await response.json() as any;
        const pages = data.data || data;
        return { status: 'pass', message: `${Array.isArray(pages) ? pages.length : 0} pages in database` };
      } catch (error: any) {
        return { status: 'fail', message: `API error: ${error.message}` };
      }
    });

    // Test 4: Railway production status
    await this.asyncTest('api', 'Railway Production Status', async () => {
      try {
        const response = await fetch('https://jd-agent-hub-production.up.railway.app/api/health', {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          return { status: 'warn', message: `Railway returning ${response.status} - use local Hub instead` };
        }
        return { status: 'pass', message: 'Railway production is up' };
      } catch (error: any) {
        return { status: 'warn', message: 'Railway production is down - use local Hub' };
      }
    });
  }

  // ============================================
  // Simulator Tests (Headless)
  // ============================================

  private async runSimulatorTests(): Promise<void> {
    console.log('\n📱 Simulator Status\n');

    // Test 1: Check if simulator is booted
    this.test('ui', 'Simulator Status', () => {
      try {
        const output = execSync('xcrun simctl list devices booted', { encoding: 'utf-8' });
        if (!output.includes('Booted')) {
          return { status: 'skip', message: 'No simulator booted - skipping UI tests' };
        }
        const match = output.match(/(.+) \(([A-F0-9-]+)\) \(Booted\)/);
        if (match) {
          return { status: 'pass', message: `${match[1]} is booted` };
        }
        return { status: 'pass', message: 'Simulator is booted' };
      } catch {
        return { status: 'skip', message: 'Could not check simulator status' };
      }
    });

    // Test 2: Check if app is installed
    this.test('ui', 'App Installation (Simulator)', () => {
      try {
        const output = execSync('xcrun simctl listapps booted 2>/dev/null || echo ""', { encoding: 'utf-8' });
        if (output.includes(CONFIG.bundleId)) {
          return { status: 'pass', message: `${CONFIG.bundleId} is installed` };
        }
        return { status: 'fail', message: 'App not installed on simulator' };
      } catch {
        return { status: 'skip', message: 'Could not check app installation' };
      }
    });
  }

  // ============================================
  // Screenshot Tests (Non-intrusive)
  // ============================================

  private async runScreenshotTests(): Promise<void> {
    console.log('\n📸 Screenshot Capture\n');

    // Check if simulator is available
    try {
      const output = execSync('xcrun simctl list devices booted', { encoding: 'utf-8' });
      if (!output.includes('Booted')) {
        this.results.push({
          name: 'Screenshot Tests',
          category: 'ui',
          status: 'skip',
          message: 'No simulator booted - skipping screenshots',
        });
        return;
      }
    } catch {
      return;
    }

    // Launch app (non-intrusive - doesn't take over screen)
    try {
      execSync(`xcrun simctl launch booted ${CONFIG.bundleId} 2>/dev/null || true`);
      await this.wait(2000);
    } catch {
      // App may already be running
    }

    // Take screenshots without interaction
    const screenshotTests = [
      { name: 'Home Screen', delay: 1000 },
      { name: 'After 3 seconds', delay: 3000 },
    ];

    for (const test of screenshotTests) {
      await this.asyncTest('ui', `Screenshot: ${test.name}`, async () => {
        await this.wait(test.delay);
        const filename = `test-${test.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
        const filepath = join(CONFIG.screenshotDir, filename);

        try {
          execSync(`xcrun simctl io booted screenshot "${filepath}" 2>/dev/null`);
          this.screenshots.push(filepath);
          return { status: 'pass', message: `Saved: ${filename}` };
        } catch (error: any) {
          return { status: 'fail', message: `Screenshot failed: ${error.message}` };
        }
      });
    }
  }

  // ============================================
  // Helpers
  // ============================================

  private test(
    category: TestResult['category'],
    name: string,
    fn: () => { status: TestResult['status']; message: string; details?: string }
  ): void {
    const start = Date.now();
    try {
      const result = fn();
      this.results.push({
        name,
        category,
        ...result,
        duration: Date.now() - start,
      });
      this.printTestResult(name, result.status, result.message);
    } catch (error: any) {
      this.results.push({
        name,
        category,
        status: 'fail',
        message: error.message,
        duration: Date.now() - start,
      });
      this.printTestResult(name, 'fail', error.message);
    }
  }

  private async asyncTest(
    category: TestResult['category'],
    name: string,
    fn: () => Promise<{ status: TestResult['status']; message: string; details?: string }>
  ): Promise<void> {
    const start = Date.now();
    try {
      const result = await fn();
      this.results.push({
        name,
        category,
        ...result,
        duration: Date.now() - start,
      });
      this.printTestResult(name, result.status, result.message);
    } catch (error: any) {
      this.results.push({
        name,
        category,
        status: 'fail',
        message: error.message,
        duration: Date.now() - start,
      });
      this.printTestResult(name, 'fail', error.message);
    }
  }

  private printTestResult(name: string, status: TestResult['status'], message: string): void {
    const icons = { pass: '✅', fail: '❌', skip: '⏭️', warn: '⚠️' };
    console.log(`  ${icons[status]} ${name}`);
    console.log(`     ${message}\n`);
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateReport(): TestReport {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      skipped: this.results.filter(r => r.status === 'skip').length,
      warnings: this.results.filter(r => r.status === 'warn').length,
    };

    return {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary,
      results: this.results,
      screenshots: this.screenshots,
    };
  }

  private printSummary(report: TestReport): void {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(50));
    console.log(`  Total:    ${report.summary.total}`);
    console.log(`  ✅ Passed:  ${report.summary.passed}`);
    console.log(`  ❌ Failed:  ${report.summary.failed}`);
    console.log(`  ⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`  ⏭️  Skipped: ${report.summary.skipped}`);
    console.log(`  Duration: ${(report.duration / 1000).toFixed(2)}s`);
    console.log('═'.repeat(50));

    if (report.summary.failed > 0) {
      console.log('\n❌ FAILURES:');
      for (const r of report.results.filter(r => r.status === 'fail')) {
        console.log(`  - ${r.name}: ${r.message}`);
      }
    }

    if (report.summary.warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      for (const r of report.results.filter(r => r.status === 'warn')) {
        console.log(`  - ${r.name}: ${r.message}`);
      }
    }

    if (this.screenshots.length > 0) {
      console.log('\n📸 Screenshots saved:');
      for (const s of this.screenshots) {
        console.log(`  - ${s}`);
      }
    }
  }

  private saveReport(report: TestReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save JSON report
    const jsonPath = join(CONFIG.reportDir, `vault-test-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save HTML report
    const htmlPath = join(CONFIG.reportDir, `vault-test-${timestamp}.html`);
    writeFileSync(htmlPath, this.generateHtmlReport(report));

    console.log(`\n📄 Reports saved:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  HTML: ${htmlPath}`);
  }

  private generateHtmlReport(report: TestReport): string {
    const statusColors: Record<string, string> = {
      pass: '#22c55e',
      fail: '#ef4444',
      skip: '#6b7280',
      warn: '#f59e0b',
    };

    const statusIcons: Record<string, string> = {
      pass: '✅',
      fail: '❌',
      skip: '⏭️',
      warn: '⚠️',
    };

    const resultsHtml = report.results.map(r => `
      <div class="result" style="border-left: 4px solid ${statusColors[r.status]};">
        <div class="result-header">
          <span class="status-icon">${statusIcons[r.status]}</span>
          <span class="name">${r.name}</span>
          <span class="category">${r.category}</span>
        </div>
        <div class="message">${r.message}</div>
        ${r.duration ? `<div class="duration">${r.duration}ms</div>` : ''}
      </div>
    `).join('\n');

    const screenshotsHtml = report.screenshots.length > 0 ? `
      <h2>📸 Screenshots</h2>
      <div class="screenshots">
        ${report.screenshots.map(s => `
          <div class="screenshot">
            <img src="file://${s}" alt="Screenshot" />
            <div class="caption">${s.split('/').pop()}</div>
          </div>
        `).join('\n')}
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <title>Vault iOS Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 16px 0; }
    .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .summary-item { padding: 8px 16px; border-radius: 8px; color: white; font-weight: 600; }
    .results { display: flex; flex-direction: column; gap: 8px; }
    .result { background: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .result-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .name { font-weight: 600; }
    .category { font-size: 12px; background: #e5e7eb; padding: 2px 8px; border-radius: 4px; }
    .message { color: #666; font-size: 14px; }
    .duration { font-size: 12px; color: #999; margin-top: 4px; }
    .screenshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 16px; }
    .screenshot img { width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .caption { font-size: 12px; color: #666; margin-top: 4px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍎 Vault iOS Test Report</h1>
    <div>Generated: ${new Date(report.timestamp).toLocaleString()}</div>
    <div>Duration: ${(report.duration / 1000).toFixed(2)}s</div>
    <div class="summary">
      <div class="summary-item" style="background: ${statusColors.pass};">✅ ${report.summary.passed} Passed</div>
      <div class="summary-item" style="background: ${statusColors.fail};">❌ ${report.summary.failed} Failed</div>
      <div class="summary-item" style="background: ${statusColors.warn};">⚠️ ${report.summary.warnings} Warnings</div>
      <div class="summary-item" style="background: ${statusColors.skip};">⏭️ ${report.summary.skipped} Skipped</div>
    </div>
  </div>

  <h2>Test Results</h2>
  <div class="results">
    ${resultsHtml}
  </div>

  ${screenshotsHtml}
</body>
</html>`;
  }
}

// ============================================
// CLI
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const suite = new VaultTestSuite();

  if (args.includes('--build-only')) {
    await suite.runBuildOnly();
  } else if (args.includes('--api-only')) {
    await suite.runApiOnly();
  } else if (args.includes('--screenshots-only')) {
    await suite.runScreenshotsOnly();
  } else {
    await suite.runAll();
  }
}

main().catch(console.error);
