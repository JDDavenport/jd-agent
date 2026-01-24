/**
 * JD Agent - AI-Powered Testing Agent
 *
 * Exports for the testing agent module.
 */

// Web Testing
export { TestingAgent, createTestingAgent } from './testing-agent';
export { PlaywrightBridge } from './playwright-bridge';
export { ScreenshotAnalyzer } from './screenshot-analyzer';
export { ReportGenerator } from './report-generator';
export { ALL_TESTING_TOOLS } from './testing-tools';
export type { TestingToolName } from './testing-tools';
export * from './types';

// Vision Provider
export { VisionProvider, createVisionProvider } from './vision-provider';
export type {
  ProviderName,
  VisionProviderConfig,
  VisionMessage,
  VisionResponse,
  ImageAnalysisResult,
  ImageContent,
} from './vision-provider';

// iOS Testing
export { iOSTestingAgent, testIOSApp } from './ios-testing-agent';
export { iOSSimulatorBridge, createiOSSimulatorBridge } from './ios-simulator-bridge';
export type {
  Requirement,
  RequirementResult,
  TestSession,
  iOSTestingAgentConfig,
} from './ios-testing-agent';
export type {
  SimulatorDevice,
  ScreenshotResult,
  SimulatorInfo,
} from './ios-simulator-bridge';
