import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CRITICAL_PATHS, CriticalPath, getTestablePaths } from './critical-paths';

interface TestResult {
  path: CriticalPath;
  run: number;
  passed: boolean;
  duration: number;
  error?: string;
  output?: string;
}

interface TestReport {
  timestamp: Date;
  totalRuns: number;
  passed: number;
  failed: number;
  skipped: number;
  criticalPathResults: Record<CriticalPath, TestResult[]>;
  allPassed: boolean;
  serverRequired: boolean;
}

interface TestingAgentOptions {
  retries?: number;
  verbose?: boolean;
  skipServerCheck?: boolean;
  paths?: CriticalPath[];
}

export class TestingAgent {
  private hubRoot: string;
  private apiBase: string;

  constructor() {
    this.hubRoot = path.resolve(__dirname, '../..');
    this.apiBase = process.env.API_BASE || 'http://localhost:3000';
  }

  /**
   * Check if the server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/api/health/live`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Run critical path tests with retry logic
   */
  async runCriticalPaths(options: TestingAgentOptions = {}): Promise<TestReport> {
    const {
      retries = 10,
      verbose = false,
      skipServerCheck = false,
      paths,
    } = options;

    console.log(`🧪 Testing Agent: Running critical paths ${retries}x each...\n`);

    // Check server if needed
    const serverRunning = skipServerCheck || (await this.isServerRunning());
    if (!serverRunning) {
      console.log('⚠️  Server not running at ' + this.apiBase);
      console.log('   Start the server with: bun run dev\n');
    }

    const criticalPathResults: Record<string, TestResult[]> = {};
    const pathsToTest = paths || getTestablePaths();
    let skippedCount = 0;

    for (const pathName of pathsToTest) {
      const config = CRITICAL_PATHS[pathName];
      console.log(`📍 Testing critical path: ${pathName}`);
      console.log(`   ${config.description}`);
      criticalPathResults[pathName] = [];

      // Skip server-required tests if server isn't running
      if (config.requiresServer && !serverRunning) {
        console.log(`   ⚠️  Skipped (requires server)\n`);
        skippedCount++;
        continue;
      }

      for (let run = 1; run <= retries; run++) {
        const result = await this.runPathTests(pathName as CriticalPath, config, run, verbose);
        criticalPathResults[pathName].push(result);

        if (!result.passed) {
          console.log(`   ❌ Run ${run}/${retries} FAILED`);
          if (verbose && result.error) {
            console.log(`   Error: ${result.error.substring(0, 200)}`);
          }
          // Stop retrying this path if it fails
          break;
        } else {
          console.log(`   ✓ Run ${run}/${retries} passed (${result.duration}ms)`);
        }
      }

      console.log('');
    }

    return this.generateReport(criticalPathResults, retries, skippedCount, !serverRunning);
  }

  /**
   * Run tests for a specific critical path
   */
  private async runPathTests(
    pathName: CriticalPath,
    config: typeof CRITICAL_PATHS[CriticalPath],
    run: number,
    verbose: boolean
  ): Promise<TestResult> {
    const start = Date.now();
    const errors: string[] = [];
    let output = '';

    try {
      // Run integration scripts
      if (config.integrationScripts && config.integrationScripts.length > 0) {
        for (const script of config.integrationScripts) {
          const scriptPath = path.join(this.hubRoot, script);

          if (!fs.existsSync(scriptPath)) {
            errors.push(`Script not found: ${script}`);
            continue;
          }

          try {
            const result = execSync(`bun run ${script}`, {
              cwd: this.hubRoot,
              stdio: 'pipe',
              timeout: 120000, // 2 minute timeout per script
              env: { ...process.env, API_BASE: this.apiBase },
            });
            output += result.toString();
          } catch (error: any) {
            const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
            errors.push(`${script}: ${errorOutput.substring(0, 500)}`);
          }
        }
      }

      // Run unit tests (if vitest is configured)
      if (config.unitTests && config.unitTests.length > 0) {
        const existingTests = config.unitTests.filter((file) =>
          fs.existsSync(path.join(this.hubRoot, file))
        );

        if (existingTests.length > 0) {
          try {
            const filesArg = existingTests.join(' ');
            const result = execSync(`bunx vitest run ${filesArg}`, {
              cwd: this.hubRoot,
              stdio: 'pipe',
              timeout: 60000,
            });
            output += result.toString();
          } catch (error: any) {
            const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
            errors.push(`Unit tests: ${errorOutput.substring(0, 500)}`);
          }
        }
      }

      if (errors.length > 0) {
        return {
          path: pathName,
          run,
          passed: false,
          duration: Date.now() - start,
          error: errors.join('\n'),
          output: verbose ? output : undefined,
        };
      }

      return {
        path: pathName,
        run,
        passed: true,
        duration: Date.now() - start,
        output: verbose ? output : undefined,
      };
    } catch (error) {
      return {
        path: pathName,
        run,
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate test report
   */
  private generateReport(
    criticalPathResults: Record<string, TestResult[]>,
    expectedRuns: number,
    skipped: number,
    serverRequired: boolean
  ): TestReport {
    let totalRuns = 0;
    let passed = 0;
    let failed = 0;

    for (const results of Object.values(criticalPathResults)) {
      for (const result of results) {
        totalRuns++;
        if (result.passed) passed++;
        else failed++;
      }
    }

    const allPassed = failed === 0 && this.allPathsCompletedRuns(criticalPathResults, expectedRuns);

    return {
      timestamp: new Date(),
      totalRuns,
      passed,
      failed,
      skipped,
      criticalPathResults: criticalPathResults as Record<CriticalPath, TestResult[]>,
      allPassed,
      serverRequired,
    };
  }

  /**
   * Check if all paths completed expected number of runs
   */
  private allPathsCompletedRuns(results: Record<string, TestResult[]>, expected: number): boolean {
    for (const [pathName, pathResults] of Object.entries(results)) {
      if (pathResults.length === 0) continue; // Skipped paths
      const passedRuns = pathResults.filter((r) => r.passed).length;
      if (passedRuns < expected) {
        return false;
      }
    }
    return true;
  }

  /**
   * Print report to console
   */
  printReport(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TESTING AGENT REPORT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`Total Runs: ${report.totalRuns}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Skipped: ${report.skipped}`);
    console.log('');

    for (const [pathName, results] of Object.entries(report.criticalPathResults)) {
      if (results.length === 0) {
        console.log(`⚠️  ${pathName}: SKIPPED (server required)`);
        continue;
      }

      const passedRuns = results.filter((r) => r.passed).length;
      const totalRuns = results.length;
      const status = passedRuns === totalRuns ? '✓' : '❌';

      console.log(`${status} ${pathName}: ${passedRuns}/${totalRuns} runs passed`);

      // Show first error if failed
      const firstFailure = results.find((r) => !r.passed);
      if (firstFailure?.error) {
        console.log(`   └── Error: ${firstFailure.error.split('\n')[0].substring(0, 80)}`);
      }
    }

    console.log('');
    if (report.serverRequired) {
      console.log('⚠️  Some tests were skipped because the server is not running');
      console.log(`   Start the server and re-run: bun run dev`);
      console.log('');
    }
    console.log(`Overall: ${report.allPassed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Save report to file
   */
  saveReport(report: TestReport, filepath: string): void {
    const absolutePath = path.isAbsolute(filepath)
      ? filepath
      : path.join(this.hubRoot, filepath);

    fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${filepath}`);
  }
}

// CLI runner
if (require.main === module) {
  (async () => {
    const agent = new TestingAgent();

    // Parse CLI arguments
    const args = process.argv.slice(2);
    const retries = parseInt(process.env.TEST_RETRIES || '10', 10);
    const verbose = args.includes('--verbose') || args.includes('-v');

    console.log('🚀 Starting Testing Agent...\n');

    const report = await agent.runCriticalPaths({
      retries,
      verbose,
    });

    agent.printReport(report);
    agent.saveReport(report, './test-report.json');

    // Exit with error code if tests failed
    process.exit(report.allPassed ? 0 : 1);
  })();
}
