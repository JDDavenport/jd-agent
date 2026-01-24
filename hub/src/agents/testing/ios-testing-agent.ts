/**
 * iOS Testing Agent
 *
 * Tests iOS apps running in the Simulator against user requirements
 * using vision-based screenshot analysis.
 *
 * Usage:
 *   const agent = new iOSTestingAgent({
 *     bundleId: 'com.jdagent.vault',
 *     requirements: [
 *       'User can view all notes in a list',
 *       'User can search notes by title',
 *       'User can create a new note',
 *       ...
 *     ]
 *   });
 *   const results = await agent.runTests();
 */

import { createiOSSimulatorBridge, iOSSimulatorBridge } from './ios-simulator-bridge';
import { createVisionProvider, VisionProvider, ImageContent } from './vision-provider';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================
// Types
// ============================================

export interface Requirement {
  id: string;
  description: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export interface RequirementResult {
  requirement: Requirement;
  status: 'pass' | 'fail' | 'partial' | 'untestable';
  confidence: number; // 0-100
  evidence: string;
  screenshotPath?: string;
  notes?: string;
}

export interface TestSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  bundleId: string;
  deviceName: string;
  requirements: Requirement[];
  results: RequirementResult[];
  screenshots: string[];
}

export interface iOSTestingAgentConfig {
  bundleId: string;
  requirements: (string | Requirement)[];
  screenshotDir?: string;
  reportDir?: string;
  maxScreenshotsPerRequirement?: number;
  waitBetweenScreenshots?: number; // ms
}

// ============================================
// iOS Testing Agent
// ============================================

export class iOSTestingAgent {
  private config: Required<iOSTestingAgentConfig>;
  private simulator: iOSSimulatorBridge;
  private vision: VisionProvider;
  private session: TestSession | null = null;

  constructor(config: iOSTestingAgentConfig) {
    this.config = {
      bundleId: config.bundleId,
      requirements: config.requirements,
      screenshotDir: config.screenshotDir || join(process.cwd(), 'storage', 'ios-test-screenshots'),
      reportDir: config.reportDir || join(process.cwd(), 'storage', 'ios-test-reports'),
      maxScreenshotsPerRequirement: config.maxScreenshotsPerRequirement || 3,
      waitBetweenScreenshots: config.waitBetweenScreenshots || 2000,
    };

    this.simulator = createiOSSimulatorBridge(this.config.screenshotDir);
    // Use Ollama local models to avoid cloud quota issues
    this.vision = createVisionProvider({
      preferredProvider: 'ollama',
      fallbackOrder: ['ollama', 'google', 'anthropic', 'openai'],
      ollamaHost: 'http://localhost:11434',
      ollamaModel: 'llava:7b',
    });

    // Ensure directories exist
    for (const dir of [this.config.screenshotDir, this.config.reportDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Normalize requirements to standard format
   */
  private normalizeRequirements(): Requirement[] {
    return this.config.requirements.map((req, index) => {
      if (typeof req === 'string') {
        return {
          id: `REQ-${String(index + 1).padStart(3, '0')}`,
          description: req,
          priority: 'medium' as const,
        };
      }
      return req;
    });
  }

  /**
   * Run all tests against requirements
   */
  async runTests(): Promise<TestSession> {
    console.log('\n🍎 iOS Testing Agent Starting...\n');

    // Check vision provider
    if (!this.vision.isAvailable()) {
      throw new Error('No vision provider available. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY');
    }
    console.log(`📡 Vision Provider: ${this.vision.getProviderName()}`);

    // Check simulator
    const device = this.simulator.getBootedSimulator();
    if (!device) {
      throw new Error('No iOS Simulator is currently booted. Start one first.');
    }
    console.log(`📱 Simulator: ${device.name} (${device.runtime})`);

    // Check app
    const appStatus = await this.simulator.getAppStatus(this.config.bundleId);
    if (!appStatus.installed) {
      console.warn(`⚠️  App ${this.config.bundleId} may not be installed`);
    }

    // Initialize session
    const requirements = this.normalizeRequirements();
    this.session = {
      id: `ios-test-${Date.now()}`,
      startTime: new Date(),
      bundleId: this.config.bundleId,
      deviceName: device.name,
      requirements,
      results: [],
      screenshots: [],
    };

    console.log(`\n📋 Testing ${requirements.length} requirements...\n`);

    // Take initial screenshot
    const initialScreenshot = await this.captureScreenshot('initial');

    // Test each requirement
    for (let i = 0; i < requirements.length; i++) {
      const req = requirements[i];
      console.log(`\n[${i + 1}/${requirements.length}] Testing: ${req.description}`);

      const result = await this.testRequirement(req, initialScreenshot);
      this.session.results.push(result);

      const statusIcon = {
        pass: '✅',
        fail: '❌',
        partial: '⚠️',
        untestable: '❓',
      }[result.status];

      console.log(`  ${statusIcon} ${result.status.toUpperCase()} (${result.confidence}% confidence)`);
      if (result.notes) {
        console.log(`     Notes: ${result.notes}`);
      }

      // Brief pause between tests
      await this.wait(500);
    }

    // Finalize session
    this.session.endTime = new Date();

    // Generate report
    await this.generateReport();

    // Summary
    this.printSummary();

    return this.session;
  }

  /**
   * Test a single requirement
   */
  private async testRequirement(
    requirement: Requirement,
    initialScreenshot: string | null
  ): Promise<RequirementResult> {
    const screenshots: ImageContent[] = [];

    // Capture current state
    const currentScreenshot = await this.captureScreenshot(`req-${requirement.id}`);
    if (currentScreenshot) {
      screenshots.push({ base64: currentScreenshot, mimeType: 'image/png' });
    } else if (initialScreenshot) {
      screenshots.push({ base64: initialScreenshot, mimeType: 'image/png' });
    }

    if (screenshots.length === 0) {
      return {
        requirement,
        status: 'untestable',
        confidence: 0,
        evidence: 'Could not capture screenshot',
      };
    }

    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(requirement);

    // Analyze with vision
    const analysis = await this.vision.analyzeImage(screenshots, prompt);

    if (!analysis.success) {
      return {
        requirement,
        status: 'untestable',
        confidence: 0,
        evidence: `Vision analysis failed: ${analysis.error}`,
      };
    }

    // Parse the response
    return this.parseAnalysisResponse(requirement, analysis.analysis || '', currentScreenshot);
  }

  /**
   * Build the analysis prompt for a requirement
   */
  private buildAnalysisPrompt(requirement: Requirement): string {
    return `You are testing an iOS app. Analyze this screenshot to determine if the following requirement is met:

REQUIREMENT: "${requirement.description}"
${requirement.category ? `CATEGORY: ${requirement.category}` : ''}
${requirement.priority ? `PRIORITY: ${requirement.priority}` : ''}

Analyze the screenshot and respond in this exact JSON format:
{
  "status": "pass" | "fail" | "partial" | "untestable",
  "confidence": <number 0-100>,
  "evidence": "<what you see that supports your assessment>",
  "notes": "<any additional observations or suggestions>"
}

Guidelines:
- "pass": The requirement is clearly met based on what's visible
- "fail": The requirement is clearly NOT met based on what's visible
- "partial": Some aspects are met but not all, or it's ambiguous
- "untestable": Cannot determine from this screenshot (need different screen/state)

Be specific about what UI elements you see that relate to the requirement.
Respond ONLY with the JSON, no other text.`;
  }

  /**
   * Parse the vision analysis response
   */
  private parseAnalysisResponse(
    requirement: Requirement,
    response: string,
    screenshotBase64: string | null
  ): RequirementResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Save screenshot if we have one
      let screenshotPath: string | undefined;
      if (screenshotBase64) {
        screenshotPath = join(
          this.config.screenshotDir,
          `${requirement.id}-${parsed.status}.png`
        );
        writeFileSync(screenshotPath, Buffer.from(screenshotBase64, 'base64'));
        this.session?.screenshots.push(screenshotPath);
      }

      return {
        requirement,
        status: parsed.status || 'untestable',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        evidence: parsed.evidence || 'No evidence provided',
        screenshotPath,
        notes: parsed.notes,
      };
    } catch (error) {
      // If parsing fails, try to infer from text
      const lowerResponse = response.toLowerCase();
      let status: RequirementResult['status'] = 'untestable';

      if (lowerResponse.includes('pass') || lowerResponse.includes('met') || lowerResponse.includes('visible')) {
        status = 'pass';
      } else if (lowerResponse.includes('fail') || lowerResponse.includes('not met') || lowerResponse.includes('missing')) {
        status = 'fail';
      } else if (lowerResponse.includes('partial')) {
        status = 'partial';
      }

      return {
        requirement,
        status,
        confidence: 30,
        evidence: response.substring(0, 500),
        notes: 'Response parsing failed, inferred status from text',
      };
    }
  }

  /**
   * Capture a screenshot and return base64
   */
  private async captureScreenshot(prefix: string): Promise<string | null> {
    const result = await this.simulator.takeScreenshot(`${prefix}-${Date.now()}.png`);
    return result.success ? result.base64 || null : null;
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate test report
   */
  private async generateReport(): Promise<void> {
    if (!this.session) return;

    const reportPath = join(this.config.reportDir, `${this.session.id}.json`);
    const htmlPath = join(this.config.reportDir, `${this.session.id}.html`);

    // JSON Report
    writeFileSync(reportPath, JSON.stringify(this.session, null, 2));

    // HTML Report
    const html = this.generateHTMLReport();
    writeFileSync(htmlPath, html);

    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${htmlPath}`);
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(): string {
    if (!this.session) return '<html><body>No session data</body></html>';

    const { results, bundleId, deviceName, startTime, endTime } = this.session;

    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const partialCount = results.filter(r => r.status === 'partial').length;
    const untestableCount = results.filter(r => r.status === 'untestable').length;

    const statusColors: Record<string, string> = {
      pass: '#22c55e',
      fail: '#ef4444',
      partial: '#f59e0b',
      untestable: '#6b7280',
    };

    const resultsHTML = results.map(r => `
      <div class="result" style="border-left: 4px solid ${statusColors[r.status]};">
        <div class="result-header">
          <span class="req-id">${r.requirement.id}</span>
          <span class="status" style="background: ${statusColors[r.status]};">${r.status.toUpperCase()}</span>
          <span class="confidence">${r.confidence}% confidence</span>
        </div>
        <div class="req-description">${r.requirement.description}</div>
        <div class="evidence"><strong>Evidence:</strong> ${r.evidence}</div>
        ${r.notes ? `<div class="notes"><strong>Notes:</strong> ${r.notes}</div>` : ''}
      </div>
    `).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <title>iOS Test Report - ${this.session.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 16px 0; font-size: 24px; }
    .meta { color: #666; font-size: 14px; }
    .summary { display: flex; gap: 16px; margin-top: 16px; }
    .summary-item { padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; }
    .results { display: flex; flex-direction: column; gap: 12px; }
    .result { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .req-id { font-weight: 600; color: #374151; }
    .status { padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; font-weight: 600; }
    .confidence { color: #6b7280; font-size: 12px; }
    .req-description { font-size: 16px; color: #111; margin-bottom: 8px; }
    .evidence, .notes { font-size: 14px; color: #666; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍎 iOS App Test Report</h1>
    <div class="meta">
      <p><strong>Bundle ID:</strong> ${bundleId}</p>
      <p><strong>Device:</strong> ${deviceName}</p>
      <p><strong>Started:</strong> ${startTime.toLocaleString()}</p>
      <p><strong>Duration:</strong> ${endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : '?'}s</p>
    </div>
    <div class="summary">
      <div class="summary-item" style="background: ${statusColors.pass};">✅ ${passCount} Pass</div>
      <div class="summary-item" style="background: ${statusColors.fail};">❌ ${failCount} Fail</div>
      <div class="summary-item" style="background: ${statusColors.partial};">⚠️ ${partialCount} Partial</div>
      <div class="summary-item" style="background: ${statusColors.untestable};">❓ ${untestableCount} Untestable</div>
    </div>
  </div>
  <div class="results">
    ${resultsHTML}
  </div>
</body>
</html>`;
  }

  /**
   * Print test summary to console
   */
  private printSummary(): void {
    if (!this.session) return;

    const { results } = this.session;
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const partialCount = results.filter(r => r.status === 'partial').length;
    const untestableCount = results.filter(r => r.status === 'untestable').length;
    const total = results.length;

    const passRate = Math.round((passCount / total) * 100);

    console.log('\n' + '═'.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(50));
    console.log(`   ✅ Pass:       ${passCount}/${total}`);
    console.log(`   ❌ Fail:       ${failCount}/${total}`);
    console.log(`   ⚠️  Partial:    ${partialCount}/${total}`);
    console.log(`   ❓ Untestable: ${untestableCount}/${total}`);
    console.log('─'.repeat(50));
    console.log(`   Pass Rate: ${passRate}%`);
    console.log('═'.repeat(50) + '\n');

    // List failures
    const failures = results.filter(r => r.status === 'fail');
    if (failures.length > 0) {
      console.log('❌ FAILED REQUIREMENTS:');
      for (const f of failures) {
        console.log(`   - ${f.requirement.description}`);
        console.log(`     Evidence: ${f.evidence}`);
      }
      console.log('');
    }
  }
}

// ============================================
// Convenience function
// ============================================

export async function testIOSApp(config: iOSTestingAgentConfig): Promise<TestSession> {
  const agent = new iOSTestingAgent(config);
  return agent.runTests();
}
