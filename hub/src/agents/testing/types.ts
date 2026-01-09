/**
 * JD Agent - AI Testing Agent Types
 */

// ============================================
// Configuration Types
// ============================================

export interface TestingConfig {
  /** Base URL for the frontend application */
  baseUrl: string;
  /** Base URL for the API */
  apiBaseUrl: string;
  /** Maximum iterations before stopping */
  maxIterations?: number;
  /** Directory to store screenshots */
  screenshotDir?: string;
  /** Test scope */
  testScope?: 'full' | 'smoke' | 'specific';
  /** Specific pages to test (when scope is 'specific') */
  specificPages?: string[];
  /** Specific API endpoints to test */
  apiEndpoints?: string[];
  /** Whether to run headless */
  headless?: boolean;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
}

// ============================================
// Finding Types
// ============================================

export type FindingType = 'bug' | 'warning' | 'info' | 'pass' | 'fail';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  type: FindingType;
  title: string;
  description: string;
  severity?: Severity;
  screenshot?: string;
  steps?: string[];
  timestamp: Date;
  page?: string;
  url?: string;
}

// ============================================
// Test Scenario Types
// ============================================

export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  passed: boolean;
  summary?: string;
  findings: Finding[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

// ============================================
// Test Result Types
// ============================================

export interface TestResult {
  /** Number of passed scenarios */
  passed: number;
  /** Number of failed scenarios */
  failed: number;
  /** Number of warnings */
  warnings: number;
  /** All findings from the test run */
  findings: Finding[];
  /** All test scenarios */
  scenarios: TestScenario[];
  /** Summary text */
  summary: string;
  /** Recommendations based on findings */
  recommendations: string[];
  /** Total duration in milliseconds */
  duration: number;
  /** List of screenshot paths */
  screenshots: string[];
  /** Timestamp when test completed */
  completedAt: Date;
}

// ============================================
// Tool Input Types
// ============================================

export interface NavigateInput {
  path: string;
  waitForSelector?: string;
}

export interface ClickInput {
  selector?: string;
  text?: string;
  waitAfter?: number;
}

export interface FillInput {
  selector?: string;
  placeholder?: string;
  label?: string;
  value: string;
  clearFirst?: boolean;
}

export interface ScreenshotInput {
  name: string;
  fullPage?: boolean;
  selector?: string;
}

export interface AnalyzeScreenshotInput {
  question: string;
}

export interface VerifyTextInput {
  text: string;
  timeout?: number;
}

export interface VerifyElementInput {
  selector: string;
  shouldExist?: boolean;
}

export interface VerifyUrlInput {
  expectedPath?: string;
  contains?: string;
}

export interface VerifyElementStateInput {
  selector: string;
  state: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'checked' | 'unchecked';
}

export interface GetElementTextInput {
  selector: string;
}

export interface ApiRequestInput {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface VerifyApiResponseInput {
  expectedStatus?: number;
  expectedFields?: string[];
  expectedValue?: Record<string, unknown>;
}

export interface LogFindingInput {
  type: FindingType;
  title: string;
  description?: string;
  severity?: Severity;
  screenshot?: boolean;
  steps?: string[];
}

export interface StartScenarioInput {
  name: string;
  description?: string;
}

export interface EndScenarioInput {
  passed: boolean;
  summary?: string;
}

export interface WaitInput {
  milliseconds: number;
  reason?: string;
}

export interface CompleteTestingInput {
  summary: string;
  recommendations?: string[];
}

export interface ScrollInput {
  direction: 'up' | 'down';
  amount?: number;
  selector?: string;
}

// ============================================
// Tool Result Types
// ============================================

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ScreenshotResult extends ToolResult {
  data?: {
    path: string;
    base64: string;
  };
}

export interface ApiRequestResult extends ToolResult {
  data?: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
    duration: number;
  };
}

export interface AnalysisResult extends ToolResult {
  data?: {
    analysis: string;
    elements?: {
      buttons: string[];
      inputs: string[];
      links: string[];
      headings: string[];
      errors: string[];
    };
  };
}

// ============================================
// Agent State Types
// ============================================

export interface AgentState {
  currentPage: string;
  currentUrl: string;
  iterationCount: number;
  findings: Finding[];
  scenarios: TestScenario[];
  currentScenario: TestScenario | null;
  screenshots: Map<string, string>;
  lastScreenshot?: string;
  lastApiResponse?: ApiRequestResult['data'];
}

// ============================================
// Report Types
// ============================================

export interface ReportOptions {
  format: 'html' | 'json' | 'markdown';
  includeScreenshots: boolean;
  outputPath: string;
}
