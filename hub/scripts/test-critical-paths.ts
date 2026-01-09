#!/usr/bin/env bun
/**
 * Critical Path Testing Script
 *
 * Runs critical path tests multiple times to ensure reliability.
 * This is designed to be run before deployments.
 *
 * Usage:
 *   bun run test:critical           # Run with 10x retries (default)
 *   bun run test:critical-5x        # Run with 5x retries
 *   TEST_RETRIES=3 bun run scripts/test-critical-paths.ts
 *
 * Options:
 *   --verbose, -v    Show detailed output
 *   --skip-server    Skip server check and run unit tests only
 *   --path <name>    Run specific path only (e.g., --path goals/create-track-complete)
 *
 * Exit codes:
 *   0 = All tests passed
 *   1 = Tests failed (deployment blocked)
 */

import { TestingAgent } from '../src/test/testing-agent';
import { CRITICAL_PATHS, CriticalPath } from '../src/test/critical-paths';

// Parse command line arguments
const args = process.argv.slice(2);

function parseArgs() {
  const retries = parseInt(process.env.TEST_RETRIES || '10', 10);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const skipServerCheck = args.includes('--skip-server');
  const help = args.includes('--help') || args.includes('-h');

  // Parse --path argument
  const pathIndex = args.indexOf('--path');
  const specificPath = pathIndex !== -1 ? args[pathIndex + 1] : undefined;

  return { retries, verbose, skipServerCheck, specificPath, help };
}

function printHelp() {
  console.log(`
🧪 JD Agent - Critical Path Testing Agent

This tool runs critical path tests multiple times to ensure reliability
before deployment. Any failure will block deployment (exit code 1).

USAGE:
  bun run scripts/test-critical-paths.ts [options]

OPTIONS:
  --verbose, -v     Show detailed test output
  --skip-server     Skip server check, run only unit tests
  --path <name>     Test only a specific critical path
  --help, -h        Show this help message

ENVIRONMENT:
  TEST_RETRIES      Number of times to run each test (default: 10)
  API_BASE          Server URL (default: http://localhost:3000)

CRITICAL PATHS:
`);

  for (const [path, config] of Object.entries(CRITICAL_PATHS)) {
    console.log(`  ${path}`);
    console.log(`    ${config.description}`);
    if (config.integrationScripts?.length) {
      console.log(`    Scripts: ${config.integrationScripts.join(', ')}`);
    }
    console.log('');
  }

  console.log(`EXAMPLES:
  # Run all critical paths 10 times each
  bun run scripts/test-critical-paths.ts

  # Quick test with 3 retries
  TEST_RETRIES=3 bun run scripts/test-critical-paths.ts

  # Test only goals with verbose output
  bun run scripts/test-critical-paths.ts --path goals/create-track-complete -v

  # Run unit tests only (no server required)
  bun run scripts/test-critical-paths.ts --skip-server
`);
}

async function main() {
  const { retries, verbose, skipServerCheck, specificPath, help } = parseArgs();

  if (help) {
    printHelp();
    process.exit(0);
  }

  console.log('🚀 JD Agent - Critical Path Testing Agent\n');
  console.log(`Configuration:`);
  console.log(`  Retries per path: ${retries}`);
  console.log(`  Verbose: ${verbose}`);
  console.log(`  Skip server check: ${skipServerCheck}`);
  if (specificPath) {
    console.log(`  Specific path: ${specificPath}`);
  }
  console.log('');

  // Validate specific path if provided
  let paths: CriticalPath[] | undefined;
  if (specificPath) {
    if (!CRITICAL_PATHS[specificPath as CriticalPath]) {
      console.error(`❌ Unknown critical path: ${specificPath}`);
      console.error(`\nAvailable paths:`);
      Object.keys(CRITICAL_PATHS).forEach((p) => console.error(`  - ${p}`));
      process.exit(1);
    }
    paths = [specificPath as CriticalPath];
  }

  const agent = new TestingAgent();

  try {
    const report = await agent.runCriticalPaths({
      retries,
      verbose,
      skipServerCheck,
      paths,
    });

    agent.printReport(report);
    agent.saveReport(report, './test-report.json');

    if (!report.allPassed) {
      console.error('\n❌ Critical path tests failed. Deployment blocked.');
      console.error('   Fix the failing tests before deploying.\n');
      process.exit(1);
    }

    if (report.skipped > 0) {
      console.log('\n⚠️  Some tests were skipped. For full coverage:');
      console.log('   1. Start the server: bun run dev');
      console.log('   2. Re-run tests: bun run test:critical\n');
    }

    console.log('✅ All critical path tests passed. Safe to deploy.\n');
    process.exit(0);
  } catch (error) {
    console.error('💥 Testing agent error:', error);
    process.exit(1);
  }
}

main();
