/**
 * JD Agent - AI-Powered Testing Agent
 *
 * Autonomous testing agent that uses vision-capable LLMs to explore
 * and test the application like a human would.
 *
 * Supports multiple providers with automatic fallback:
 * - OpenAI GPT-4o (OPENAI_API_KEY)
 * - Anthropic Claude (ANTHROPIC_API_KEY)
 * - Google Gemini (GOOGLE_AI_API_KEY)
 * - Ollama local models (OLLAMA_HOST)
 */

import { PlaywrightBridge } from './playwright-bridge';
import { ScreenshotAnalyzer } from './screenshot-analyzer';
import { ReportGenerator } from './report-generator';
import { ALL_TESTING_TOOLS, type TestingToolName } from './testing-tools';
import { buildSystemPrompt } from './prompts/testing-system';
import { VisionProvider, type VisionMessage, type VisionProviderConfig } from './vision-provider';
import type {
  TestingConfig,
  TestResult,
  Finding,
  TestScenario,
  AgentState,
  ToolResult,
  NavigateInput,
  ClickInput,
  FillInput,
  ScreenshotInput,
  AnalyzeScreenshotInput,
  VerifyTextInput,
  VerifyElementInput,
  VerifyUrlInput,
  VerifyElementStateInput,
  GetElementTextInput,
  ApiRequestInput,
  LogFindingInput,
  StartScenarioInput,
  EndScenarioInput,
  WaitInput,
  CompleteTestingInput,
  ScrollInput,
} from './types';

export class TestingAgent {
  private visionProvider: VisionProvider;
  private browser: PlaywrightBridge;
  private analyzer: ScreenshotAnalyzer;
  private reportGenerator: ReportGenerator;
  private config: TestingConfig;

  // Agent state
  private state: AgentState;
  private conversationHistory: VisionMessage[] = [];
  private testingComplete = false;
  private finalSummary = '';
  private finalRecommendations: string[] = [];

  constructor(config: TestingConfig & { visionConfig?: VisionProviderConfig }) {
    this.config = {
      maxIterations: 50,
      screenshotDir: './test-screenshots',
      testScope: 'full',
      headless: true,
      viewport: { width: 1024, height: 768 },
      ...config,
    };

    // Initialize vision provider with multi-provider support
    this.visionProvider = new VisionProvider(config.visionConfig);

    if (!this.visionProvider.isAvailable()) {
      const providers = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY', 'OLLAMA_HOST'];
      throw new Error(
        `No vision provider available. Set one of: ${providers.join(', ')}`
      );
    }

    console.log(`[TestingAgent] Using vision provider: ${this.visionProvider.getProviderName()}`);
    console.log(`[TestingAgent] Available providers: ${this.visionProvider.getAvailableProviders().join(', ')}`);

    this.browser = new PlaywrightBridge({
      baseUrl: this.config.baseUrl,
      apiBaseUrl: this.config.apiBaseUrl,
      screenshotDir: this.config.screenshotDir,
      headless: this.config.headless,
      viewport: this.config.viewport,
    });
    this.analyzer = new ScreenshotAnalyzer(config.visionConfig);
    this.reportGenerator = new ReportGenerator(this.config.screenshotDir!);

    this.state = {
      currentPage: '/',
      currentUrl: '',
      iterationCount: 0,
      findings: [],
      scenarios: [],
      currentScenario: null,
      screenshots: new Map(),
    };
  }

  /**
   * Run the testing session
   */
  async runTests(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      console.log('[TestingAgent] Initializing browser...');
      await this.browser.initialize();

      // Navigate to the starting page
      await this.browser.navigate({ path: '/' });
      this.state.currentUrl = await this.browser.getCurrentUrl();

      // Build system prompt with app context
      const systemPrompt = buildSystemPrompt();

      // Build initial message based on test scope
      const initialMessage = this.buildInitialMessage();
      this.conversationHistory.push({
        role: 'user',
        content: initialMessage,
      });

      console.log('[TestingAgent] Starting testing loop...');

      // Main testing loop
      while (
        this.state.iterationCount < this.config.maxIterations! &&
        !this.testingComplete
      ) {
        this.state.iterationCount++;
        console.log(`[TestingAgent] Iteration ${this.state.iterationCount}/${this.config.maxIterations}`);

        try {
          // Trim conversation history to prevent token overflow
          this.trimConversationHistory();

          // Retry logic with exponential backoff for rate limits
          let retries = 0;
          const maxRetries = 3;
          let response = null;

          while (retries <= maxRetries && !response) {
            try {
              response = await this.visionProvider.chat(
                systemPrompt,
                this.conversationHistory,
                ALL_TESTING_TOOLS
              );
            } catch (apiError: unknown) {
              const isRateLimit = apiError instanceof Error &&
                (apiError.message.includes('429') || apiError.message.includes('rate_limit'));

              if (isRateLimit && retries < maxRetries) {
                const waitTime = Math.pow(2, retries) * 5000; // 5s, 10s, 20s
                console.log(`[TestingAgent] Rate limit hit, waiting ${waitTime/1000}s before retry ${retries + 1}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retries++;
              } else {
                throw apiError;
              }
            }
          }

          if (response) {
            // Process the response
            await this.processResponse(response);
          }
        } catch (error) {
          console.error('[TestingAgent] Error in testing loop:', error);
          // Log the error but continue
          this.state.findings.push({
            id: crypto.randomUUID(),
            type: 'warning',
            title: 'Testing Agent Error',
            description: `An error occurred during testing: ${error}`,
            timestamp: new Date(),
          });
        }
      }

      console.log('[TestingAgent] Testing complete, generating report...');

      // Generate final result
      const duration = Date.now() - startTime;
      const result = this.reportGenerator.generateResult({
        findings: this.state.findings,
        scenarios: this.state.scenarios,
        duration,
        screenshots: Array.from(this.state.screenshots.keys()),
        summary: this.finalSummary,
        recommendations: this.finalRecommendations,
      });

      // Generate reports
      const htmlPath = await this.reportGenerator.generateHtmlReport(result);
      const jsonPath = await this.reportGenerator.generateJsonReport(result);

      console.log(`[TestingAgent] HTML Report: ${htmlPath}`);
      console.log(`[TestingAgent] JSON Report: ${jsonPath}`);

      return result;
    } finally {
      await this.browser.close();
    }
  }

  /**
   * Process the vision provider's response
   */
  private async processResponse(response: { content: string | null; toolCalls: Array<{ id: string; name: string; arguments: string }> }): Promise<void> {
    let { content, toolCalls } = response;

    // If no native tool calls, try to parse from text content (for Ollama/fallback scenarios)
    if ((!toolCalls || toolCalls.length === 0) && content) {
      const parsedCalls = this.parseToolCallsFromText(content);
      if (parsedCalls.length > 0) {
        toolCalls = parsedCalls;
        console.log(`[TestingAgent] Parsed ${parsedCalls.length} tool call(s) from text response`);
      }
    }

    if (!toolCalls || toolCalls.length === 0) {
      // No tools used, just text response
      if (content) {
        console.log(`[TestingAgent] ${content.slice(0, 100)}...`);
      }

      // Add assistant message to history
      this.conversationHistory.push({
        role: 'assistant',
        content: content || '',
      });

      return;
    }

    // Add assistant message with tool calls to history
    this.conversationHistory.push({
      role: 'assistant',
      content: content,
      toolCalls: toolCalls,
    });

    // Execute each tool and collect results
    for (const toolCall of toolCalls) {
      console.log(`[TestingAgent] Executing tool: ${toolCall.name}`);

      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(toolCall.arguments);
      } catch {
        input = {};
      }

      const result = await this.executeTool(
        toolCall.name as TestingToolName,
        input
      );

      // Add tool result to history
      this.conversationHistory.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(
    name: TestingToolName,
    input: Record<string, unknown>
  ): Promise<ToolResult> {
    try {
      switch (name) {
        // Navigation tools
        case 'navigate_to_page': {
          const result = await this.browser.navigate(input as unknown as NavigateInput);
          if (result.success) {
            this.state.currentUrl = await this.browser.getCurrentUrl();
            this.state.currentPage = new URL(this.state.currentUrl).pathname;
          }
          return result;
        }

        case 'click_element':
          return await this.browser.click(input as unknown as ClickInput);

        case 'fill_input':
          return await this.browser.fill(input as unknown as FillInput);

        case 'scroll':
          return await this.browser.scroll(input as unknown as ScrollInput);

        case 'wait': {
          const waitInput = input as unknown as WaitInput;
          if (waitInput.reason) {
            console.log(`[TestingAgent] Waiting: ${waitInput.reason}`);
          }
          return await this.browser.wait(waitInput.milliseconds);
        }

        // Vision tools
        case 'take_screenshot': {
          const screenshotInput = input as unknown as ScreenshotInput;
          const result = await this.browser.takeScreenshot(screenshotInput);
          if (result.success && result.data) {
            this.state.screenshots.set(result.data.path, result.data.base64);
            this.state.lastScreenshot = result.data.base64;
          }
          return result;
        }

        case 'analyze_screenshot': {
          if (!this.state.lastScreenshot) {
            return {
              success: false,
              error: 'No screenshot available. Take a screenshot first.',
            };
          }
          const analyzeInput = input as unknown as AnalyzeScreenshotInput;
          return await this.analyzer.analyze(
            this.state.lastScreenshot,
            analyzeInput.question
          );
        }

        // Verification tools
        case 'verify_text_visible':
          return await this.browser.verifyTextVisible(input as unknown as VerifyTextInput);

        case 'verify_element_exists':
          return await this.browser.verifyElementExists(input as unknown as VerifyElementInput);

        case 'verify_url':
          return await this.browser.verifyUrl(input as unknown as VerifyUrlInput);

        case 'verify_element_state':
          return await this.browser.verifyElementState(input as unknown as VerifyElementStateInput);

        case 'get_element_text':
          return await this.browser.getElementText(input as unknown as GetElementTextInput);

        // API tools
        case 'api_request': {
          const apiInput = input as unknown as ApiRequestInput;
          const result = await this.browser.apiRequest(apiInput);
          if (result.success && result.data) {
            this.state.lastApiResponse = result.data;
          }
          return result;
        }

        case 'verify_api_response': {
          if (!this.state.lastApiResponse) {
            return {
              success: false,
              error: 'No API response available. Make an API request first.',
            };
          }

          const verifyInput = input as {
            expectedStatus?: number;
            expectedFields?: string[];
            expectedValue?: Record<string, unknown>;
          };

          const checks: Record<string, boolean> = {};
          let allPassed = true;

          if (verifyInput.expectedStatus !== undefined) {
            checks.statusMatch =
              this.state.lastApiResponse.status === verifyInput.expectedStatus;
            allPassed = allPassed && checks.statusMatch;
          }

          if (verifyInput.expectedFields) {
            const body = this.state.lastApiResponse.body as Record<string, unknown>;
            checks.fieldsPresent = verifyInput.expectedFields.every(
              (field) => field in body
            );
            allPassed = allPassed && checks.fieldsPresent;
          }

          return {
            success: true,
            data: {
              allPassed,
              checks,
              actualStatus: this.state.lastApiResponse.status,
            },
          };
        }

        // Test control tools
        case 'log_finding': {
          const findingInput = input as unknown as LogFindingInput;
          const finding: Finding = {
            id: crypto.randomUUID(),
            type: findingInput.type,
            title: findingInput.title,
            description: findingInput.description || '',
            severity: findingInput.severity,
            steps: findingInput.steps,
            timestamp: new Date(),
            page: this.state.currentPage,
            url: this.state.currentUrl,
          };

          if (findingInput.screenshot && this.state.lastScreenshot) {
            // Get the most recent screenshot path
            const paths = Array.from(this.state.screenshots.keys());
            if (paths.length > 0) {
              finding.screenshot = paths[paths.length - 1];
            }
          }

          this.state.findings.push(finding);

          // Also add to current scenario if one is active
          if (this.state.currentScenario) {
            this.state.currentScenario.findings.push(finding);
          }

          console.log(
            `[TestingAgent] Logged ${findingInput.type}: ${findingInput.title}`
          );

          return { success: true, data: { findingId: finding.id } };
        }

        case 'start_test_scenario': {
          const scenarioInput = input as unknown as StartScenarioInput;

          // End any existing scenario first
          if (this.state.currentScenario) {
            this.state.currentScenario.endTime = new Date();
            this.state.currentScenario.duration =
              this.state.currentScenario.endTime.getTime() -
              this.state.currentScenario.startTime.getTime();
            this.state.scenarios.push(this.state.currentScenario);
          }

          this.state.currentScenario = {
            id: crypto.randomUUID(),
            name: scenarioInput.name,
            description: scenarioInput.description,
            passed: true, // Assume passed until marked otherwise
            findings: [],
            startTime: new Date(),
          };

          console.log(`[TestingAgent] Started scenario: ${scenarioInput.name}`);

          return { success: true };
        }

        case 'end_test_scenario': {
          const endInput = input as unknown as EndScenarioInput;

          if (!this.state.currentScenario) {
            return {
              success: false,
              error: 'No active scenario to end',
            };
          }

          this.state.currentScenario.passed = endInput.passed;
          this.state.currentScenario.summary = endInput.summary;
          this.state.currentScenario.endTime = new Date();
          this.state.currentScenario.duration =
            this.state.currentScenario.endTime.getTime() -
            this.state.currentScenario.startTime.getTime();

          this.state.scenarios.push(this.state.currentScenario);

          console.log(
            `[TestingAgent] Ended scenario: ${this.state.currentScenario.name} - ${endInput.passed ? 'PASSED' : 'FAILED'}`
          );

          this.state.currentScenario = null;

          return { success: true };
        }

        case 'complete_testing': {
          const completeInput = input as unknown as CompleteTestingInput;

          // End any active scenario
          if (this.state.currentScenario) {
            this.state.currentScenario.endTime = new Date();
            this.state.currentScenario.duration =
              this.state.currentScenario.endTime.getTime() -
              this.state.currentScenario.startTime.getTime();
            this.state.scenarios.push(this.state.currentScenario);
            this.state.currentScenario = null;
          }

          this.testingComplete = true;
          this.finalSummary = completeInput.summary;
          this.finalRecommendations = completeInput.recommendations || [];

          console.log('[TestingAgent] Testing marked as complete');

          return { success: true };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      console.error(`[TestingAgent] Tool execution error (${name}):`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Parse tool calls from text content (for providers like Ollama that don't use native function calling)
   * Supports multiple formats including multi-line JSON
   */
  private parseToolCallsFromText(content: string): Array<{ id: string; name: string; arguments: string }> {
    const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

    // Pattern 1: JSON in code blocks (multi-line)
    const codeBlockPattern = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match;

    while ((match = codeBlockPattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool && typeof parsed.tool === 'string') {
          toolCalls.push({
            id: `parsed-${Date.now()}-${toolCalls.length}`,
            name: parsed.tool,
            arguments: JSON.stringify(parsed.arguments || {}),
          });
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    // Pattern 2: Multi-line JSON objects starting with {"tool" or { "tool"
    // This handles formatted JSON output from the model
    if (toolCalls.length === 0) {
      // Find JSON objects by matching balanced braces
      const jsonObjects = this.extractJsonObjects(content);
      for (const jsonStr of jsonObjects) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.tool && typeof parsed.tool === 'string') {
            toolCalls.push({
              id: `parsed-${Date.now()}-${toolCalls.length}`,
              name: parsed.tool,
              arguments: JSON.stringify(parsed.arguments || parsed.args || {}),
            });
          }
        } catch {
          // Not valid JSON, skip
        }
      }
    }

    return toolCalls;
  }

  /**
   * Extract JSON objects from text by matching balanced braces
   */
  private extractJsonObjects(content: string): string[] {
    const objects: string[] = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '{') {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = content.slice(start, i + 1);
          // Only include if it looks like a tool call
          if (candidate.includes('"tool"')) {
            objects.push(candidate);
          }
          start = -1;
        }
      }
    }

    return objects;
  }

  /**
   * Trim conversation history to prevent token overflow
   * Keeps only the most recent messages and truncates large tool results
   * IMPORTANT: Maintains message structure (tool messages must follow tool_calls)
   */
  private trimConversationHistory(): void {
    const MAX_MESSAGES = 16; // Keep last 16 messages
    const MAX_TOOL_RESULT_LENGTH = 300; // Truncate tool results

    // Truncate large tool results (especially those with base64 data)
    for (const msg of this.conversationHistory) {
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        // Check if the content contains base64 data or is very long
        if (msg.content.length > MAX_TOOL_RESULT_LENGTH) {
          try {
            const parsed = JSON.parse(msg.content);
            // Remove base64 data from the result
            if (parsed.data?.base64) {
              parsed.data.base64 = '[screenshot captured]';
            }
            msg.content = JSON.stringify(parsed);
          } catch {
            // If not JSON, just truncate
            msg.content = msg.content.slice(0, MAX_TOOL_RESULT_LENGTH) + '... [truncated]';
          }
        }
      }
    }

    // Trim conversation while maintaining valid structure
    // We need to find safe cut points - messages that start a new "turn"
    // Safe cut points are: user messages, assistant messages without tool_calls
    if (this.conversationHistory.length > MAX_MESSAGES) {
      const initialMessage = this.conversationHistory[0];

      // Find a safe starting point in the recent messages
      // Start from the target position and look for a safe cut point
      let cutIndex = this.conversationHistory.length - MAX_MESSAGES + 1;

      // Move forward to find a safe cut point (user message or assistant without toolCalls)
      while (cutIndex < this.conversationHistory.length - 1) {
        const msg = this.conversationHistory[cutIndex];
        // Safe to cut before: user messages
        if (msg.role === 'user') {
          break;
        }
        // Safe to cut before: assistant messages that don't have toolCalls
        if (msg.role === 'assistant' && !msg.toolCalls?.length) {
          break;
        }
        cutIndex++;
      }

      // Only trim if we found a valid cut point
      if (cutIndex < this.conversationHistory.length - 1) {
        const recentMessages = this.conversationHistory.slice(cutIndex);
        this.conversationHistory = [initialMessage, ...recentMessages];
      }
    }
  }

  /**
   * Build the initial message based on test scope
   */
  private buildInitialMessage(): string {
    switch (this.config.testScope) {
      case 'smoke':
        return `Run a smoke test of the JD Agent Command Center application.

IMPORTANT: Follow the MANDATORY workflow for EACH page:
1. Call start_test_scenario with the page name (e.g., "Dashboard Page Tests")
2. Call take_screenshot to capture initial state
3. Call verify_text_visible to check page loaded
4. Call log_finding with type "pass" or "bug" based on result
5. Test 1-2 interactions and log_finding for each
6. Call take_screenshot for final state
7. Call end_test_scenario with passed=true/false and summary

Pages to test: Dashboard (/), Vault (/vault), Settings (/settings), Health (/health)

START NOW: Call start_test_scenario for "Dashboard Page Tests", then take_screenshot.`;

      case 'specific':
        return `Test the following specific pages thoroughly: ${this.config.specificPages?.join(', ')}

For each page:
1. Navigate to it
2. Take a screenshot and analyze the UI
3. Test interactive elements
4. Verify functionality works correctly
5. Log any issues found

Start with the first page.`;

      default:
        return `You are an AUTONOMOUS testing agent. You MUST test ALL pages without asking questions or waiting for instructions.

CRITICAL RULES:
- NEVER ask "what to do next" - just proceed to the next page
- NEVER repeat the same page - test each page ONCE then move on
- ALWAYS use tool calls - every response must include at least one tool call
- After end_test_scenario, IMMEDIATELY call navigate_to_page for the next page

MANDATORY WORKFLOW for each page:
1. navigate_to_page - go to the page URL
2. start_test_scenario - name it "PageName Tests" (e.g., "Vault Tests")
3. take_screenshot - capture initial state
4. verify_text_visible - check page content loaded
5. log_finding - type "pass" if loaded, "bug" if not
6. click_element or fill_input - test 1-2 interactions
7. log_finding - for each interaction result
8. end_test_scenario - passed=true/false
9. IMMEDIATELY navigate_to_page for NEXT page (do not stop!)

PAGE SEQUENCE (test in this exact order):
1. Dashboard (/) - verify stats cards visible
2. Vault (/vault) - verify search input visible
3. Settings (/settings) - verify tabs visible
4. Health (/health) - verify status cards visible

After testing ALL 4 pages, call complete_testing.

START NOW with multiple tool calls:
- start_test_scenario name="Dashboard Tests"
- take_screenshot name="dashboard-initial"
- verify_text_visible text="Dashboard"`;
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createTestingAgent(config: TestingConfig & { visionConfig?: VisionProviderConfig }): TestingAgent {
  return new TestingAgent(config);
}
