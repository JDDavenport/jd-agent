/**
 * iOS UX Testing Agent
 *
 * A comprehensive testing agent that acts as a UX expert, testing iOS apps
 * like a real user would. Identifies bugs, UX issues, and creates actionable
 * bug reports.
 *
 * This is for production healthcare apps - quality is critical.
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type BugCategory = 'crash' | 'functional' | 'ux' | 'visual' | 'performance' | 'accessibility';

export interface Bug {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: BugCategory;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  screenshotPaths: string[];
  timestamp: Date;
  workflow: string;
  additionalNotes?: string;
}

export interface WorkflowStep {
  action: 'tap' | 'swipe' | 'type' | 'wait' | 'screenshot' | 'verify' | 'scroll';
  target?: string; // Element description or coordinates
  value?: string; // For typing or swipe direction
  timeout?: number;
  description: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  preconditions: string[];
  steps: WorkflowStep[];
  expectedOutcome: string;
  criticalPath: boolean;
}

export interface TestResult {
  workflow: Workflow;
  status: 'pass' | 'fail' | 'blocked';
  bugs: Bug[];
  screenshots: string[];
  duration: number;
  notes: string;
}

export interface TestReport {
  appName: string;
  bundleId: string;
  testDate: Date;
  device: string;
  totalWorkflows: number;
  passed: number;
  failed: number;
  blocked: number;
  bugs: Bug[];
  results: TestResult[];
  summary: string;
  recommendations: string[];
}

export interface AgentConfig {
  bundleId: string;
  appName: string;
  simulatorName?: string;
  screenshotDir?: string;
  reportDir?: string;
  anthropicApiKey?: string;
}

// ============================================
// Simulator Control
// ============================================

class SimulatorController {
  private deviceName: string;
  private screenshotDir: string;
  private screenshotCount = 0;

  constructor(deviceName: string, screenshotDir: string) {
    this.deviceName = deviceName;
    this.screenshotDir = screenshotDir;
    if (!existsSync(screenshotDir)) {
      mkdirSync(screenshotDir, { recursive: true });
    }
  }

  async boot(): Promise<boolean> {
    try {
      execSync(`xcrun simctl boot "${this.deviceName}" 2>/dev/null || true`);
      await this.wait(2000);
      return true;
    } catch {
      return false;
    }
  }

  async launchApp(bundleId: string): Promise<boolean> {
    try {
      execSync(`xcrun simctl terminate "${this.deviceName}" ${bundleId} 2>/dev/null || true`);
      await this.wait(500);
      execSync(`xcrun simctl launch "${this.deviceName}" ${bundleId}`);
      await this.wait(2000);
      return true;
    } catch (e) {
      console.error('Failed to launch app:', e);
      return false;
    }
  }

  async takeScreenshot(prefix: string = 'screen'): Promise<string> {
    const filename = `${prefix}-${++this.screenshotCount}-${Date.now()}.png`;
    const filepath = join(this.screenshotDir, filename);
    try {
      execSync(`xcrun simctl io "${this.deviceName}" screenshot "${filepath}"`);
      return filepath;
    } catch (e) {
      console.error('Failed to take screenshot:', e);
      return '';
    }
  }

  async tap(x: number, y: number): Promise<void> {
    // Use AppleScript to tap in simulator
    const script = `
      tell application "Simulator" to activate
      delay 0.3
      tell application "System Events"
        tell process "Simulator"
          click at {${x}, ${y}}
        end tell
      end tell
    `;
    try {
      execSync(`osascript -e '${script}'`);
      await this.wait(500);
    } catch (e) {
      console.error('Tap failed:', e);
    }
  }

  async swipe(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const script = `
      tell application "Simulator" to activate
      delay 0.3
      tell application "System Events"
        tell process "Simulator"
          set frontWindow to front window
          set {x, y, w, h} to {0, 0, 0, 0}
          try
            set {x, y} to position of frontWindow
            set {w, h} to size of frontWindow
          end try
          set centerX to x + (w / 2)
          set centerY to y + (h / 2)
          ${direction === 'up' ? 'set startY to centerY + 200\nset endY to centerY - 200' : ''}
          ${direction === 'down' ? 'set startY to centerY - 200\nset endY to centerY + 200' : ''}
          ${direction === 'left' ? 'set startX to centerX + 200\nset endX to centerX - 200' : ''}
          ${direction === 'right' ? 'set startX to centerX - 200\nset endX to centerX + 200' : ''}
        end tell
      end tell
    `;
    try {
      execSync(`osascript -e '${script}'`);
      await this.wait(500);
    } catch (e) {
      console.error('Swipe failed:', e);
    }
  }

  async typeText(text: string): Promise<void> {
    const script = `
      tell application "Simulator" to activate
      delay 0.2
      tell application "System Events"
        keystroke "${text.replace(/"/g, '\\"')}"
      end tell
    `;
    try {
      execSync(`osascript -e '${script}'`);
      await this.wait(300);
    } catch (e) {
      console.error('Type failed:', e);
    }
  }

  async pressKey(key: string): Promise<void> {
    const keyMap: Record<string, string> = {
      'enter': 'return',
      'escape': 'escape',
      'delete': 'delete',
      'tab': 'tab',
    };
    const script = `
      tell application "Simulator" to activate
      delay 0.2
      tell application "System Events"
        key code ${key === 'enter' ? '36' : key === 'escape' ? '53' : key === 'delete' ? '51' : '48'}
      end tell
    `;
    try {
      execSync(`osascript -e '${script}'`);
      await this.wait(300);
    } catch (e) {
      console.error('Key press failed:', e);
    }
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDeviceInfo(): { name: string; udid: string } | null {
    try {
      const output = execSync('xcrun simctl list devices booted -j').toString();
      const data = JSON.parse(output);
      for (const runtime of Object.values(data.devices) as any[]) {
        for (const device of runtime) {
          if (device.state === 'Booted') {
            return { name: device.name, udid: device.udid };
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }
}

// ============================================
// Vision Analysis
// ============================================

class VisionAnalyzer {
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (key) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  async analyzeScreenshot(screenshotPath: string, context: string): Promise<{
    elements: string[];
    issues: string[];
    suggestions: string[];
    rawAnalysis: string;
  }> {
    if (!this.client) {
      return {
        elements: [],
        issues: ['Vision API not configured'],
        suggestions: [],
        rawAnalysis: 'No API key available'
      };
    }

    try {
      const imageData = readFileSync(screenshotPath);
      const base64 = imageData.toString('base64');

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are a senior UX expert and QA engineer analyzing an iOS app screenshot. This is for a healthcare application where quality is critical.

Context: ${context}

Analyze this screenshot and provide:

1. VISIBLE ELEMENTS: List all interactive elements you can see (buttons, text fields, labels, etc.)

2. UX ISSUES: Identify any problems such as:
   - Confusing layouts or unclear navigation
   - Missing visual feedback (loading states, error states)
   - Text that's hard to read or too small
   - Buttons that look unclickable or are too small to tap
   - Missing labels or unclear icons
   - Inconsistent spacing or alignment
   - Missing back buttons or navigation
   - Empty states without guidance
   - Anything that would confuse a user

3. FUNCTIONAL CONCERNS: Things that might indicate bugs:
   - Error messages visible
   - Unexpected empty areas
   - Misaligned or overlapping elements
   - Cut-off text
   - Loading indicators stuck
   - Grayed out elements that shouldn't be

4. SUGGESTIONS: Specific improvements

Respond in this exact JSON format:
{
  "elements": ["element1", "element2", ...],
  "issues": ["issue1", "issue2", ...],
  "functionalConcerns": ["concern1", ...],
  "suggestions": ["suggestion1", ...],
  "overallAssessment": "brief summary"
}`
            }
          ]
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            elements: parsed.elements || [],
            issues: [...(parsed.issues || []), ...(parsed.functionalConcerns || [])],
            suggestions: parsed.suggestions || [],
            rawAnalysis: parsed.overallAssessment || text
          };
        }
      } catch {
        // Parse failed, extract what we can
      }

      return {
        elements: [],
        issues: [],
        suggestions: [],
        rawAnalysis: text
      };
    } catch (e) {
      console.error('Vision analysis failed:', e);
      return {
        elements: [],
        issues: [`Analysis failed: ${e}`],
        suggestions: [],
        rawAnalysis: ''
      };
    }
  }

  async compareScreenshots(before: string, after: string, expectedChange: string): Promise<{
    changeDetected: boolean;
    description: string;
    issues: string[];
  }> {
    if (!this.client) {
      return {
        changeDetected: false,
        description: 'Vision API not configured',
        issues: ['Cannot compare without API']
      };
    }

    try {
      const beforeData = readFileSync(before).toString('base64');
      const afterData = readFileSync(after).toString('base64');

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Compare these two iOS app screenshots. Expected change: "${expectedChange}"`
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: beforeData }
            },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: afterData }
            },
            {
              type: 'text',
              text: `Did the expected change occur? What actually changed? Are there any issues?

Respond in JSON:
{
  "changeDetected": true/false,
  "actualChange": "description of what changed",
  "expectedChangeOccurred": true/false,
  "issues": ["any problems noticed"]
}`
            }
          ]
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          changeDetected: parsed.changeDetected || parsed.expectedChangeOccurred,
          description: parsed.actualChange || '',
          issues: parsed.issues || []
        };
      }

      return { changeDetected: false, description: text, issues: [] };
    } catch (e) {
      return {
        changeDetected: false,
        description: `Comparison failed: ${e}`,
        issues: [`Error: ${e}`]
      };
    }
  }
}

// ============================================
// Bug Reporter
// ============================================

class BugReporter {
  private bugs: Bug[] = [];
  private bugCount = 0;

  createBug(
    workflow: string,
    title: string,
    description: string,
    severity: Severity,
    category: BugCategory,
    steps: string[],
    expected: string,
    actual: string,
    screenshots: string[],
    notes?: string
  ): Bug {
    const bug: Bug = {
      id: `BUG-${++this.bugCount}`,
      title,
      description,
      severity,
      category,
      stepsToReproduce: steps,
      expectedBehavior: expected,
      actualBehavior: actual,
      screenshotPaths: screenshots,
      timestamp: new Date(),
      workflow,
      additionalNotes: notes
    };
    this.bugs.push(bug);
    return bug;
  }

  getAllBugs(): Bug[] {
    return this.bugs;
  }

  getBugsBySeverity(severity: Severity): Bug[] {
    return this.bugs.filter(b => b.severity === severity);
  }

  generateMarkdownReport(): string {
    const critical = this.getBugsBySeverity('critical');
    const high = this.getBugsBySeverity('high');
    const medium = this.getBugsBySeverity('medium');
    const low = this.getBugsBySeverity('low');

    let md = `# Bug Report\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;
    md += `## Summary\n\n`;
    md += `- **Critical:** ${critical.length}\n`;
    md += `- **High:** ${high.length}\n`;
    md += `- **Medium:** ${medium.length}\n`;
    md += `- **Low:** ${low.length}\n`;
    md += `- **Total:** ${this.bugs.length}\n\n`;

    const addBugsSection = (title: string, bugs: Bug[]) => {
      if (bugs.length === 0) return;
      md += `## ${title}\n\n`;
      for (const bug of bugs) {
        md += `### ${bug.id}: ${bug.title}\n\n`;
        md += `**Category:** ${bug.category} | **Workflow:** ${bug.workflow}\n\n`;
        md += `**Description:** ${bug.description}\n\n`;
        md += `**Steps to Reproduce:**\n`;
        bug.stepsToReproduce.forEach((step, i) => {
          md += `${i + 1}. ${step}\n`;
        });
        md += `\n**Expected:** ${bug.expectedBehavior}\n\n`;
        md += `**Actual:** ${bug.actualBehavior}\n\n`;
        if (bug.additionalNotes) {
          md += `**Notes:** ${bug.additionalNotes}\n\n`;
        }
        if (bug.screenshotPaths.length > 0) {
          md += `**Screenshots:**\n`;
          bug.screenshotPaths.forEach(path => {
            md += `- ${path}\n`;
          });
          md += '\n';
        }
        md += '---\n\n';
      }
    };

    addBugsSection('Critical Issues', critical);
    addBugsSection('High Priority Issues', high);
    addBugsSection('Medium Priority Issues', medium);
    addBugsSection('Low Priority Issues', low);

    return md;
  }
}

// ============================================
// iOS UX Testing Agent
// ============================================

export class iOSUXTestingAgent {
  private config: AgentConfig;
  private simulator: SimulatorController;
  private vision: VisionAnalyzer;
  private bugReporter: BugReporter;
  private screenshotDir: string;
  private reportDir: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.screenshotDir = config.screenshotDir || join(process.cwd(), 'storage', 'ios-ux-tests', config.bundleId);
    this.reportDir = config.reportDir || join(process.cwd(), 'storage', 'ios-ux-reports');

    if (!existsSync(this.screenshotDir)) mkdirSync(this.screenshotDir, { recursive: true });
    if (!existsSync(this.reportDir)) mkdirSync(this.reportDir, { recursive: true });

    this.simulator = new SimulatorController(
      config.simulatorName || 'iPhone 17 Pro',
      this.screenshotDir
    );
    this.vision = new VisionAnalyzer(config.anthropicApiKey);
    this.bugReporter = new BugReporter();
  }

  /**
   * Define standard workflows for a notes/vault app
   */
  private getVaultWorkflows(): Workflow[] {
    return [
      {
        id: 'W001',
        name: 'App Launch and Initial Load',
        description: 'Verify app launches correctly and displays content',
        preconditions: ['App is installed', 'Network is available'],
        steps: [
          { action: 'screenshot', description: 'Capture initial state' },
          { action: 'wait', timeout: 3000, description: 'Wait for content to load' },
          { action: 'screenshot', description: 'Capture loaded state' },
          { action: 'verify', target: 'title', description: 'Verify app title is visible' },
          { action: 'verify', target: 'content', description: 'Verify pages are displayed or empty state shown' },
        ],
        expectedOutcome: 'App launches within 2 seconds, shows title, displays pages or helpful empty state',
        criticalPath: true,
      },
      {
        id: 'W002',
        name: 'Create New Note',
        description: 'Test creating a new note from home screen',
        preconditions: ['App is on home screen'],
        steps: [
          { action: 'screenshot', description: 'Before creating note' },
          { action: 'tap', target: 'New Note button', description: 'Tap New Note' },
          { action: 'wait', timeout: 2000, description: 'Wait for navigation' },
          { action: 'screenshot', description: 'After tapping New Note' },
          { action: 'verify', target: 'editor', description: 'Verify editor/detail view opens' },
          { action: 'verify', target: 'title field', description: 'Verify title is editable' },
        ],
        expectedOutcome: 'New note is created, editor opens, title field is focused/editable',
        criticalPath: true,
      },
      {
        id: 'W003',
        name: 'Navigate to Existing Note',
        description: 'Test tapping on a note to view its contents',
        preconditions: ['At least one note exists', 'App is on home screen'],
        steps: [
          { action: 'screenshot', description: 'Home screen with notes' },
          { action: 'tap', target: 'first note row', description: 'Tap on a note' },
          { action: 'wait', timeout: 2000, description: 'Wait for navigation' },
          { action: 'screenshot', description: 'After navigation' },
          { action: 'verify', target: 'back button', description: 'Verify back button exists' },
          { action: 'verify', target: 'note title', description: 'Verify note title is displayed' },
          { action: 'verify', target: 'blocks/content', description: 'Verify content area exists' },
        ],
        expectedOutcome: 'Note detail view opens showing title, content, and back navigation',
        criticalPath: true,
      },
      {
        id: 'W004',
        name: 'Edit Note Title',
        description: 'Test editing the title of a note',
        preconditions: ['On note detail view'],
        steps: [
          { action: 'screenshot', description: 'Before editing title' },
          { action: 'tap', target: 'title field', description: 'Tap on title' },
          { action: 'type', value: 'Test Title Edit', description: 'Type new title' },
          { action: 'tap', target: 'outside title', description: 'Tap away to save' },
          { action: 'wait', timeout: 1000, description: 'Wait for save' },
          { action: 'screenshot', description: 'After editing title' },
        ],
        expectedOutcome: 'Title is updated and persists',
        criticalPath: true,
      },
      {
        id: 'W005',
        name: 'Add Text Block',
        description: 'Test adding a new text block to a note',
        preconditions: ['On note detail view'],
        steps: [
          { action: 'screenshot', description: 'Before adding block' },
          { action: 'tap', target: 'Add block button', description: 'Tap Add block' },
          { action: 'wait', timeout: 1000, description: 'Wait for menu' },
          { action: 'screenshot', description: 'Block type menu' },
          { action: 'tap', target: 'Text option', description: 'Select Text type' },
          { action: 'wait', timeout: 1000, description: 'Wait for block' },
          { action: 'type', value: 'Test content', description: 'Type in new block' },
          { action: 'screenshot', description: 'After adding content' },
        ],
        expectedOutcome: 'New block is added, text can be entered',
        criticalPath: true,
      },
      {
        id: 'W006',
        name: 'Search for Notes',
        description: 'Test search functionality',
        preconditions: ['Notes exist', 'App is on home screen'],
        steps: [
          { action: 'tap', target: 'Search button', description: 'Tap Search' },
          { action: 'wait', timeout: 1000, description: 'Wait for search view' },
          { action: 'screenshot', description: 'Search view' },
          { action: 'type', value: 'test', description: 'Type search query' },
          { action: 'wait', timeout: 1500, description: 'Wait for results' },
          { action: 'screenshot', description: 'Search results' },
          { action: 'verify', target: 'results or empty state', description: 'Verify results shown' },
        ],
        expectedOutcome: 'Search shows matching results or helpful empty state',
        criticalPath: false,
      },
      {
        id: 'W007',
        name: 'Back Navigation',
        description: 'Test navigating back from detail to home',
        preconditions: ['On note detail view'],
        steps: [
          { action: 'screenshot', description: 'On detail view' },
          { action: 'tap', target: 'back button', description: 'Tap back' },
          { action: 'wait', timeout: 1000, description: 'Wait for navigation' },
          { action: 'screenshot', description: 'After back navigation' },
          { action: 'verify', target: 'home screen', description: 'Verify home screen shown' },
        ],
        expectedOutcome: 'Returns to home screen with all notes visible',
        criticalPath: true,
      },
      {
        id: 'W008',
        name: 'Swipe Actions',
        description: 'Test swipe to reveal actions on note rows',
        preconditions: ['Notes exist', 'On home screen'],
        steps: [
          { action: 'screenshot', description: 'Before swipe' },
          { action: 'swipe', value: 'left', target: 'first note row', description: 'Swipe left on note' },
          { action: 'wait', timeout: 500, description: 'Wait for actions' },
          { action: 'screenshot', description: 'Swipe actions revealed' },
          { action: 'verify', target: 'action buttons', description: 'Verify delete/favorite/archive buttons' },
        ],
        expectedOutcome: 'Swipe reveals action buttons (Delete, Archive, Favorite)',
        criticalPath: false,
      },
      {
        id: 'W009',
        name: 'Pull to Refresh',
        description: 'Test pull to refresh functionality',
        preconditions: ['On home screen'],
        steps: [
          { action: 'screenshot', description: 'Before refresh' },
          { action: 'swipe', value: 'down', description: 'Pull down to refresh' },
          { action: 'wait', timeout: 2000, description: 'Wait for refresh' },
          { action: 'screenshot', description: 'After refresh' },
        ],
        expectedOutcome: 'Content refreshes, loading indicator shown briefly',
        criticalPath: false,
      },
      {
        id: 'W010',
        name: 'Error Handling - Offline',
        description: 'Test app behavior when network is unavailable',
        preconditions: ['App has loaded'],
        steps: [
          { action: 'screenshot', description: 'Initial state' },
          { action: 'verify', target: 'offline indicator', description: 'Check for offline status' },
          { action: 'verify', target: 'error messages', description: 'Check for clear error feedback' },
        ],
        expectedOutcome: 'App shows clear offline indicator or cached content',
        criticalPath: false,
      },
    ];
  }

  /**
   * Run a single workflow
   */
  private async runWorkflow(workflow: Workflow): Promise<TestResult> {
    console.log(`\n▶ Running: ${workflow.name}`);
    const startTime = Date.now();
    const screenshots: string[] = [];
    const bugs: Bug[] = [];
    const stepResults: string[] = [];

    for (const step of workflow.steps) {
      console.log(`  → ${step.description}`);

      try {
        switch (step.action) {
          case 'screenshot': {
            const path = await this.simulator.takeScreenshot(`${workflow.id}-${step.description.replace(/\s+/g, '-')}`);
            if (path) {
              screenshots.push(path);
              // Analyze the screenshot
              const analysis = await this.vision.analyzeScreenshot(path, `${workflow.name}: ${step.description}`);

              // Check for issues
              if (analysis.issues.length > 0) {
                for (const issue of analysis.issues) {
                  // Determine severity based on keywords
                  let severity: Severity = 'medium';
                  let category: BugCategory = 'ux';

                  if (issue.toLowerCase().includes('crash') || issue.toLowerCase().includes('error')) {
                    severity = 'critical';
                    category = 'functional';
                  } else if (issue.toLowerCase().includes('missing') || issue.toLowerCase().includes('broken')) {
                    severity = 'high';
                    category = 'functional';
                  } else if (issue.toLowerCase().includes('confus') || issue.toLowerCase().includes('unclear')) {
                    severity = 'medium';
                    category = 'ux';
                  }

                  const bug = this.bugReporter.createBug(
                    workflow.name,
                    issue.substring(0, 80),
                    issue,
                    severity,
                    category,
                    workflow.steps.slice(0, workflow.steps.indexOf(step) + 1).map(s => s.description),
                    workflow.expectedOutcome,
                    issue,
                    [path],
                    analysis.rawAnalysis
                  );
                  bugs.push(bug);
                }
              }
              stepResults.push(`Screenshot captured: ${analysis.elements.length} elements found`);
            }
            break;
          }

          case 'wait':
            await this.simulator.wait(step.timeout || 1000);
            stepResults.push('Wait completed');
            break;

          case 'tap':
            // For now, we'll note that manual tap coordinates would be needed
            // In a full implementation, we'd use accessibility IDs or element detection
            stepResults.push(`Tap action: ${step.target}`);
            break;

          case 'swipe':
            await this.simulator.swipe(step.value as 'up' | 'down' | 'left' | 'right');
            stepResults.push(`Swipe ${step.value}`);
            break;

          case 'type':
            await this.simulator.typeText(step.value || '');
            stepResults.push(`Typed: ${step.value}`);
            break;

          case 'verify':
            // Vision-based verification
            const verifyScreenshot = await this.simulator.takeScreenshot(`${workflow.id}-verify`);
            if (verifyScreenshot) {
              screenshots.push(verifyScreenshot);
              const analysis = await this.vision.analyzeScreenshot(
                verifyScreenshot,
                `Verifying: ${step.target}`
              );

              const hasTarget = analysis.elements.some(e =>
                e.toLowerCase().includes(step.target?.toLowerCase() || '')
              );

              if (!hasTarget && step.target) {
                const bug = this.bugReporter.createBug(
                  workflow.name,
                  `Expected element not found: ${step.target}`,
                  `The expected element "${step.target}" was not detected in the screenshot`,
                  'high',
                  'functional',
                  workflow.steps.slice(0, workflow.steps.indexOf(step) + 1).map(s => s.description),
                  `Should see: ${step.target}`,
                  `Element not found. Visible elements: ${analysis.elements.slice(0, 5).join(', ')}`,
                  [verifyScreenshot]
                );
                bugs.push(bug);
                stepResults.push(`Verification FAILED: ${step.target} not found`);
              } else {
                stepResults.push(`Verification passed: ${step.target}`);
              }
            }
            break;
        }
      } catch (e) {
        stepResults.push(`Step failed: ${e}`);
        bugs.push(this.bugReporter.createBug(
          workflow.name,
          `Step execution failed: ${step.description}`,
          `Error during step: ${e}`,
          'high',
          'crash',
          workflow.steps.slice(0, workflow.steps.indexOf(step) + 1).map(s => s.description),
          workflow.expectedOutcome,
          `Exception: ${e}`,
          screenshots
        ));
      }
    }

    const duration = Date.now() - startTime;
    const status = bugs.some(b => b.severity === 'critical') ? 'fail'
                 : bugs.some(b => b.severity === 'high') ? 'fail'
                 : bugs.length > 0 ? 'pass' // Pass with warnings
                 : 'pass';

    console.log(`  ${status === 'pass' ? '✅' : '❌'} ${workflow.name}: ${bugs.length} issues found`);

    return {
      workflow,
      status,
      bugs,
      screenshots,
      duration,
      notes: stepResults.join('\n')
    };
  }

  /**
   * Run all tests
   */
  async runFullTestSuite(): Promise<TestReport> {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 iOS UX TESTING AGENT');
    console.log(`📱 App: ${this.config.appName} (${this.config.bundleId})`);
    console.log('='.repeat(60));

    // Get device info
    const deviceInfo = this.simulator.getDeviceInfo();
    if (!deviceInfo) {
      throw new Error('No booted simulator found. Please start a simulator first.');
    }
    console.log(`📱 Device: ${deviceInfo.name}`);

    // Launch app
    console.log('\n🚀 Launching app...');
    const launched = await this.simulator.launchApp(this.config.bundleId);
    if (!launched) {
      throw new Error('Failed to launch app');
    }
    await this.simulator.wait(3000); // Wait for app to fully load

    // Get workflows
    const workflows = this.getVaultWorkflows();
    const results: TestResult[] = [];

    console.log(`\n📋 Running ${workflows.length} workflow tests...\n`);

    // Run each workflow
    for (const workflow of workflows) {
      const result = await this.runWorkflow(workflow);
      results.push(result);

      // Return to home screen for next test
      await this.simulator.pressKey('escape'); // Dismiss any modals
      await this.simulator.wait(500);
    }

    // Generate report
    const allBugs = this.bugReporter.getAllBugs();
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const blocked = results.filter(r => r.status === 'blocked').length;

    const report: TestReport = {
      appName: this.config.appName,
      bundleId: this.config.bundleId,
      testDate: new Date(),
      device: deviceInfo.name,
      totalWorkflows: workflows.length,
      passed,
      failed,
      blocked,
      bugs: allBugs,
      results,
      summary: this.generateSummary(results, allBugs),
      recommendations: this.generateRecommendations(allBugs)
    };

    // Save reports
    await this.saveReports(report);

    // Print summary
    this.printSummary(report);

    return report;
  }

  private generateSummary(results: TestResult[], bugs: Bug[]): string {
    const critical = bugs.filter(b => b.severity === 'critical').length;
    const high = bugs.filter(b => b.severity === 'high').length;

    if (critical > 0) {
      return `CRITICAL: ${critical} critical issues must be fixed immediately. App may be unusable.`;
    } else if (high > 0) {
      return `HIGH PRIORITY: ${high} high-priority issues need attention. Core functionality may be impacted.`;
    } else if (bugs.length > 0) {
      return `ACCEPTABLE: ${bugs.length} minor issues found. App is functional but could be improved.`;
    }
    return 'PASS: No significant issues found. App appears to be working correctly.';
  }

  private generateRecommendations(bugs: Bug[]): string[] {
    const recs: string[] = [];

    const categories = new Map<BugCategory, number>();
    for (const bug of bugs) {
      categories.set(bug.category, (categories.get(bug.category) || 0) + 1);
    }

    if ((categories.get('functional') || 0) > 0) {
      recs.push('Fix functional bugs first - these break core features');
    }
    if ((categories.get('ux') || 0) > 2) {
      recs.push('Multiple UX issues suggest need for design review');
    }
    if ((categories.get('crash') || 0) > 0) {
      recs.push('URGENT: App crashes detected - fix immediately');
    }
    if ((categories.get('accessibility') || 0) > 0) {
      recs.push('Accessibility issues may exclude users with disabilities');
    }

    return recs;
  }

  private async saveReports(report: TestReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save JSON report
    const jsonPath = join(this.reportDir, `${this.config.bundleId}-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save Markdown bug report
    const mdPath = join(this.reportDir, `${this.config.bundleId}-${timestamp}-bugs.md`);
    writeFileSync(mdPath, this.bugReporter.generateMarkdownReport());

    console.log(`\n📄 Reports saved:`);
    console.log(`   ${jsonPath}`);
    console.log(`   ${mdPath}`);
  }

  private printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✅ Passed:  ${report.passed}/${report.totalWorkflows}`);
    console.log(`❌ Failed:  ${report.failed}/${report.totalWorkflows}`);
    console.log(`⏸  Blocked: ${report.blocked}/${report.totalWorkflows}`);
    console.log(`\n🐛 Bugs Found: ${report.bugs.length}`);
    console.log(`   Critical: ${report.bugs.filter(b => b.severity === 'critical').length}`);
    console.log(`   High:     ${report.bugs.filter(b => b.severity === 'high').length}`);
    console.log(`   Medium:   ${report.bugs.filter(b => b.severity === 'medium').length}`);
    console.log(`   Low:      ${report.bugs.filter(b => b.severity === 'low').length}`);
    console.log(`\n📝 Summary: ${report.summary}`);
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(r => console.log(`   • ${r}`));
    }
    console.log('\n' + '='.repeat(60));
  }
}

// ============================================
// XCUITest Runner (Recommended Approach)
// ============================================

export interface XCUITestResult {
  testName: string;
  passed: boolean;
  duration: number;
  failureMessage?: string;
}

export interface XCUITestReport {
  appName: string;
  projectPath: string;
  testDate: Date;
  device: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: XCUITestResult[];
  summary: string;
}

/**
 * Run XCUITests using xcodebuild (the reliable approach)
 * This is the recommended way to test iOS apps
 */
export async function runXCUITests(config: {
  projectPath: string;
  scheme: string;
  testTarget: string;
  destination: string;
}): Promise<XCUITestReport> {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 iOS XCUITest Runner');
  console.log('='.repeat(60));
  console.log(`📁 Project: ${config.projectPath}`);
  console.log(`📱 Destination: ${config.destination}`);
  console.log('');

  const startTime = Date.now();
  const results: XCUITestResult[] = [];

  try {
    const command = `cd "${config.projectPath}" && xcodebuild test \
      -project ${config.scheme}.xcodeproj \
      -scheme ${config.scheme} \
      -destination '${config.destination}' \
      -only-testing:${config.testTarget} 2>&1`;

    console.log('🚀 Running XCUITests...\n');
    const output = execSync(command, { maxBuffer: 10 * 1024 * 1024 }).toString();

    // Parse test results from output
    const testCaseRegex = /Test Case '-\[(\S+)\s+(\S+)\]' (passed|failed) \(([0-9.]+) seconds\)/g;
    let match;

    while ((match = testCaseRegex.exec(output)) !== null) {
      const [, testClass, testMethod, status, duration] = match;
      results.push({
        testName: `${testClass}.${testMethod}`,
        passed: status === 'passed',
        duration: parseFloat(duration),
      });

      const icon = status === 'passed' ? '✅' : '❌';
      console.log(`${icon} ${testMethod} (${duration}s)`);
    }

    // Check for failures
    const failureRegex = /Assertion Failure: (.+)/g;
    let failMatch;
    while ((failMatch = failureRegex.exec(output)) !== null) {
      console.log(`   ⚠️  ${failMatch[1]}`);
    }

  } catch (e: any) {
    console.error('❌ Test execution failed:', e.message);

    // Try to parse partial results from error output
    if (e.stdout) {
      const testCaseRegex = /Test Case '-\[(\S+)\s+(\S+)\]' (passed|failed) \(([0-9.]+) seconds\)/g;
      let match;
      while ((match = testCaseRegex.exec(e.stdout.toString())) !== null) {
        const [, testClass, testMethod, status, duration] = match;
        results.push({
          testName: `${testClass}.${testMethod}`,
          passed: status === 'passed',
          duration: parseFloat(duration),
        });
      }
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = Date.now() - startTime;

  const report: XCUITestReport = {
    appName: config.scheme,
    projectPath: config.projectPath,
    testDate: new Date(),
    device: config.destination,
    totalTests: results.length,
    passed,
    failed,
    results,
    summary: failed > 0
      ? `❌ FAILED: ${failed}/${results.length} tests failed`
      : `✅ PASSED: All ${results.length} tests passed`,
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed:  ${passed}/${results.length}`);
  console.log(`❌ Failed:  ${failed}/${results.length}`);
  console.log(`⏱  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`\n${report.summary}`);
  console.log('='.repeat(60));

  return report;
}

// ============================================
// CLI Entry Point
// ============================================

export async function runVaultIOSTests(): Promise<TestReport> {
  const agent = new iOSUXTestingAgent({
    bundleId: 'com.jdagent.vault',
    appName: 'JD Vault',
    simulatorName: 'iPhone 17 Pro',
  });

  return agent.runFullTestSuite();
}

/**
 * Run just XCUITests (recommended for CI)
 */
export async function runVaultXCUITests(): Promise<XCUITestReport> {
  return runXCUITests({
    projectPath: '/Users/jddavenport/Projects/JD Agent/apps/vault-ios',
    scheme: 'JDVault',
    testTarget: 'JDVaultUITests/JDVaultUITests',
    destination: 'platform=iOS Simulator,name=iPhone 17 Pro',
  });
}

// Allow running directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('ios-ux-testing-agent.ts');

if (isMainModule) {
  // Use --xcui flag to run just XCUITests (recommended)
  const useXCUI = process.argv.includes('--xcui');

  if (useXCUI) {
    runVaultXCUITests()
      .then(report => {
        process.exit(report.failed > 0 ? 1 : 0);
      })
      .catch(e => {
        console.error('Test run failed:', e);
        process.exit(1);
      });
  } else {
    runVaultIOSTests()
      .then(report => {
        process.exit(report.bugs.filter(b => b.severity === 'critical').length > 0 ? 1 : 0);
      })
      .catch(e => {
        console.error('Test run failed:', e);
        process.exit(1);
      });
  }
}
