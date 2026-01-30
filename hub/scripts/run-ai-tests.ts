#!/usr/bin/env bun
/**
 * JD Agent - AI Testing Agent CLI Runner
 *
 * Run the AI-powered testing agent from the command line.
 *
 * Usage:
 *   bun run scripts/run-ai-tests.ts [options]
 *
 * Options:
 *   --scope <full|smoke|specific>  Test scope (default: smoke)
 *   --pages <page1,page2,...>      Specific pages to test (for scope=specific)
 *   --max-iterations <n>           Maximum iterations (default: 50)
 *   --headed                       Run browser in headed mode (visible)
 *   --frontend-url <url>           Frontend URL (default: http://localhost:5173)
 *   --api-url <url>                API URL (default: http://localhost:3000)
 *   --output-dir <dir>             Output directory for reports (default: ./test-screenshots)
 */

import { createTestingAgent } from '../src/agents/testing';
import type { TestingConfig } from '../src/agents/testing';

// Parse command line arguments
function parseArgs(): {
  scope: 'full' | 'smoke' | 'specific';
  pages?: string[];
  maxIterations: number;
  headless: boolean;
  frontendUrl: string;
  apiUrl: string;
  outputDir: string;
  preferredProvider?: 'openai' | 'anthropic' | 'google' | 'ollama';
  fallbackOrder?: Array<'openai' | 'anthropic' | 'google' | 'ollama'>;
} {
  const args = process.argv.slice(2);
  const options = {
    scope: 'smoke' as 'full' | 'smoke' | 'specific',
    pages: undefined as string[] | undefined,
    maxIterations: 50,
    headless: true,
    frontendUrl: 'http://localhost:5173',
    apiUrl: 'http://localhost:3000',
    outputDir: './test-screenshots',
    preferredProvider: undefined as 'openai' | 'anthropic' | 'google' | 'ollama' | undefined,
    fallbackOrder: ['openai', 'anthropic', 'google', 'ollama'] as Array<
      'openai' | 'anthropic' | 'google' | 'ollama'
    >,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--scope':
        if (nextArg === 'full' || nextArg === 'smoke' || nextArg === 'specific') {
          options.scope = nextArg;
        }
        i++;
        break;
      case '--pages':
        options.pages = nextArg?.split(',').map((p) => p.trim());
        i++;
        break;
      case '--max-iterations':
        options.maxIterations = parseInt(nextArg, 10) || 50;
        i++;
        break;
      case '--headed':
        options.headless = false;
        break;
      case '--frontend-url':
        options.frontendUrl = nextArg || options.frontendUrl;
        i++;
        break;
      case '--api-url':
        options.apiUrl = nextArg || options.apiUrl;
        i++;
        break;
      case '--output-dir':
        options.outputDir = nextArg || options.outputDir;
        i++;
        break;
      case '--vision-provider':
        if (nextArg === 'openai' || nextArg === 'anthropic' || nextArg === 'google' || nextArg === 'ollama') {
          options.preferredProvider = nextArg;
        }
        i++;
        break;
      case '--vision-fallback':
        options.fallbackOrder = nextArg
          ?.split(',')
          .map((p) => p.trim())
          .filter((p): p is 'openai' | 'anthropic' | 'google' | 'ollama' =>
            p === 'openai' || p === 'anthropic' || p === 'google' || p === 'ollama'
          );
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
JD Agent - AI Testing Agent

Usage:
  bun run scripts/run-ai-tests.ts [options]

Options:
  --scope <full|smoke|specific>  Test scope (default: smoke)
                                 - smoke: Quick test of all pages
                                 - full: Comprehensive testing
                                 - specific: Test specific pages only

  --pages <page1,page2,...>      Comma-separated list of pages to test
                                 (only used with --scope specific)
                                 Example: --pages /vault,/chat,/settings

  --max-iterations <n>           Maximum number of testing iterations
                                 (default: 50)

  --headed                       Run browser in headed mode (visible window)
                                 Default is headless mode

  --frontend-url <url>           Frontend application URL
                                 (default: http://localhost:5173)

  --api-url <url>                Backend API URL
                                 (default: http://localhost:3000)

  --output-dir <dir>             Directory for screenshots and reports
                                 (default: ./test-screenshots)

  --vision-provider <provider>   Preferred vision provider
                                 (openai|anthropic|google|ollama)

  --vision-fallback <list>       Comma-separated fallback order
                                 Example: openai

  --help, -h                     Show this help message

Examples:
  # Quick smoke test
  bun run scripts/run-ai-tests.ts

  # Full comprehensive test
  bun run scripts/run-ai-tests.ts --scope full

  # Test specific pages
  bun run scripts/run-ai-tests.ts --scope specific --pages /vault,/chat

  # Run with visible browser
  bun run scripts/run-ai-tests.ts --headed

  # Force OpenAI only
  bun run scripts/run-ai-tests.ts --vision-provider openai --vision-fallback openai

Environment Variables:
  OPENAI_API_KEY                 OpenAI API key (GPT-4o)
  ANTHROPIC_API_KEY              Anthropic API key (Claude)
  GOOGLE_AI_API_KEY              Google Gemini API key
  OLLAMA_HOST                    Ollama host (default: http://localhost:11434)
  OLLAMA_MODEL                   Ollama vision model (default: llava:7b)
  OLLAMA_CHAT_MODEL              Ollama chat model (default: llama3.1:8b)

Prerequisites:
  1. Start the backend: bun run dev
  2. Start the frontend: bun run command-center
  3. Run tests: bun run scripts/run-ai-tests.ts
`);
}

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           JD Agent - AI-Powered Testing Agent                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_AI_API_KEY;
  const hasOllama = !!process.env.OLLAMA_HOST || !!process.env.OLLAMA_MODEL || !!process.env.OLLAMA_CHAT_MODEL;

  if (!hasOpenAI && !hasAnthropic && !hasGoogle && !hasOllama) {
    console.error('Error: No vision providers configured.');
    console.error('');
    console.error('Set at least one of:');
    console.error('  OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY');
    console.error('  or configure Ollama with OLLAMA_HOST / OLLAMA_MODEL / OLLAMA_CHAT_MODEL');
    process.exit(1);
  }

  const options = parseArgs();

  console.log('Configuration:');
  console.log(`  Scope:          ${options.scope}`);
  if (options.pages) {
    console.log(`  Pages:          ${options.pages.join(', ')}`);
  }
  console.log(`  Max Iterations: ${options.maxIterations}`);
  console.log(`  Headless:       ${options.headless}`);
  console.log(`  Frontend URL:   ${options.frontendUrl}`);
  console.log(`  API URL:        ${options.apiUrl}`);
  console.log(`  Output Dir:     ${options.outputDir}`);
  console.log('');

  // Check if services are running
  console.log('Checking services...');

  try {
    const frontendResponse = await fetch(options.frontendUrl);
    if (!frontendResponse.ok) {
      throw new Error(`Frontend returned ${frontendResponse.status}`);
    }
    console.log('  Frontend: OK');
  } catch {
    console.error(`  Frontend: NOT RUNNING at ${options.frontendUrl}`);
    console.error('');
    console.error('Please start the frontend first:');
    console.error('  bun run command-center');
    process.exit(1);
  }

  try {
    const apiResponse = await fetch(`${options.apiUrl}/api/health`);
    if (!apiResponse.ok) {
      throw new Error(`API returned ${apiResponse.status}`);
    }
    console.log('  API:      OK');
  } catch {
    console.error(`  API: NOT RUNNING at ${options.apiUrl}`);
    console.error('');
    console.error('Please start the backend first:');
    console.error('  bun run dev');
    process.exit(1);
  }

  console.log('');
  console.log('Starting AI testing agent...');
  console.log('─'.repeat(60));
  console.log('');

  const config: TestingConfig = {
    baseUrl: options.frontendUrl,
    apiBaseUrl: options.apiUrl,
    screenshotDir: options.outputDir,
    testScope: options.scope,
    specificPages: options.pages,
    maxIterations: options.maxIterations,
    headless: options.headless,
  };

  const agent = createTestingAgent({
    ...config,
    visionConfig: {
      preferredProvider: options.preferredProvider,
      fallbackOrder: options.fallbackOrder,
    },
  });
  const startTime = Date.now();

  try {
    const result = await agent.runTests();

    const duration = Date.now() - startTime;
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    console.log('');
    console.log('─'.repeat(60));
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST RESULTS                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Duration: ${durationMinutes}m ${durationSeconds}s`);
    console.log('');
    console.log('Scenarios:');
    console.log(`  Passed:   ${result.passed}`);
    console.log(`  Failed:   ${result.failed}`);
    console.log('');
    console.log('Findings:');
    console.log(`  Total:    ${result.findings.length}`);
    console.log(`  Bugs:     ${result.findings.filter((f) => f.type === 'bug').length}`);
    console.log(`  Warnings: ${result.warnings}`);
    console.log(`  Passes:   ${result.findings.filter((f) => f.type === 'pass').length}`);
    console.log('');

    if (result.findings.filter((f) => f.type === 'bug').length > 0) {
      console.log('Bugs Found:');
      result.findings
        .filter((f) => f.type === 'bug')
        .forEach((bug) => {
          console.log(`  - [${bug.severity?.toUpperCase() || 'UNKNOWN'}] ${bug.title}`);
          if (bug.description) {
            console.log(`    ${bug.description.slice(0, 100)}...`);
          }
        });
      console.log('');
    }

    if (result.recommendations.length > 0) {
      console.log('Recommendations:');
      result.recommendations.forEach((rec) => {
        console.log(`  - ${rec}`);
      });
      console.log('');
    }

    console.log(`Reports saved to: ${options.outputDir}`);
    console.log('');

    // Exit with appropriate code
    if (result.failed > 0 || result.findings.some((f) => f.type === 'bug' && f.severity === 'critical')) {
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('Testing failed with error:', error);
    process.exit(1);
  }
}

main();
