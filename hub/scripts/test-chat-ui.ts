/**
 * JD Agent - Chat UI Test using Testing Agent
 * 
 * Uses the testing agent to test the chat UI functionality
 */

import { createTestingAgent } from '../src/agents/testing';
import type { TestingConfig } from '../src/agents/testing';

async function testChatUI() {
  console.log('\n🧪 Testing Chat UI with Testing Agent');
  console.log('='.repeat(60));

  const config: TestingConfig = {
    baseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    screenshotDir: './test-screenshots',
    testScope: 'specific',
    specificPages: ['/chat'],
    maxIterations: 10,
    headless: true,
  };

  console.log('Configuration:');
  console.log('  Frontend URL:', config.baseUrl);
  console.log('  API URL:', config.apiBaseUrl);
  console.log('  Test Scope: specific (chat page only)');
  console.log('  Max Iterations:', config.maxIterations);
  console.log('');

  try {
    const agent = createTestingAgent(config);
    const result = await agent.runTests();

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results:');
    console.log(`  Passed: ${result.passed}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Warnings: ${result.warnings}`);
    console.log(`  Total Findings: ${result.findings.length}`);
    console.log(`  Duration: ${result.duration}ms`);
    
    if (result.findings.length > 0) {
      console.log('\n🔍 Findings:');
      result.findings.forEach((finding, i) => {
        console.log(`  ${i + 1}. [${finding.type}] ${finding.title}`);
        if (finding.description) {
          console.log(`     ${finding.description}`);
        }
      });
    }

    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log('\n✅ Testing complete\n');
  } catch (error) {
    console.error('❌ Testing failed:', error);
    process.exit(1);
  }
}

testChatUI();
