/**
 * JD Agent - AI Testing Agent Tool Definitions
 *
 * Tools available to the testing agent for browser automation,
 * verification, and test management.
 */

import type Anthropic from '@anthropic-ai/sdk';

// ============================================
// Navigation Tools
// ============================================

const NAVIGATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'navigate_to_page',
    description: 'Navigate to a specific page in the application. Use this to move between different sections of the app.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'URL path to navigate to (e.g., "/", "/vault", "/chat", "/settings", "/health")',
        },
        waitForSelector: {
          type: 'string',
          description: 'Optional CSS selector to wait for after navigation completes',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'click_element',
    description: 'Click on an element. You can identify the element by CSS selector or by its visible text content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element (e.g., "button.submit", "#login-btn")',
        },
        text: {
          type: 'string',
          description: 'Visible text content to find and click (e.g., "Save", "Submit")',
        },
        waitAfter: {
          type: 'number',
          description: 'Milliseconds to wait after clicking (default: 500)',
        },
      },
    },
  },
  {
    name: 'fill_input',
    description: 'Fill text into an input field or textarea. Identify by selector, placeholder text, or label.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input field',
        },
        placeholder: {
          type: 'string',
          description: 'Placeholder text to identify the input (partial match)',
        },
        label: {
          type: 'string',
          description: 'Label text associated with the input',
        },
        value: {
          type: 'string',
          description: 'Value to enter into the field',
        },
        clearFirst: {
          type: 'boolean',
          description: 'Whether to clear existing value before entering (default: true)',
        },
      },
      required: ['value'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page or a specific element',
    input_schema: {
      type: 'object' as const,
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down'],
          description: 'Direction to scroll',
        },
        amount: {
          type: 'number',
          description: 'Pixels to scroll (default: 300)',
        },
        selector: {
          type: 'string',
          description: 'Optional selector of scrollable container',
        },
      },
      required: ['direction'],
    },
  },
  {
    name: 'wait',
    description: 'Wait for a specified time before continuing. Use sparingly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        milliseconds: {
          type: 'number',
          description: 'Time to wait in milliseconds',
        },
        reason: {
          type: 'string',
          description: 'Reason for waiting (for logging)',
        },
      },
      required: ['milliseconds'],
    },
  },
];

// ============================================
// Vision Tools
// ============================================

const VISION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'take_screenshot',
    description: 'Capture a screenshot of the current page state. Use this before analyzing the UI or after important actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Descriptive name for the screenshot (e.g., "dashboard-loaded", "form-validation-error")',
        },
        fullPage: {
          type: 'boolean',
          description: 'Capture the full scrollable page (default: false, captures viewport only)',
        },
        selector: {
          type: 'string',
          description: 'Optional CSS selector to capture only that specific element',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'analyze_screenshot',
    description: 'Analyze the most recent screenshot using AI vision to understand the current UI state. Ask specific questions about what you see.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'Question about the UI (e.g., "What buttons are visible?", "Are there any error messages?", "What is the current state of the form?")',
        },
      },
      required: ['question'],
    },
  },
];

// ============================================
// Verification Tools
// ============================================

const VERIFICATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'verify_text_visible',
    description: 'Verify that specific text is visible somewhere on the page',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Text to verify is visible (case-insensitive partial match)',
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait in milliseconds (default: 5000)',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'verify_element_exists',
    description: 'Verify that an element matching the selector exists (or does not exist) in the DOM',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to check',
        },
        shouldExist: {
          type: 'boolean',
          description: 'Whether element should exist (true) or not exist (false). Default: true',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'verify_url',
    description: 'Verify the current URL matches expected pattern',
    input_schema: {
      type: 'object' as const,
      properties: {
        expectedPath: {
          type: 'string',
          description: 'Expected URL path (e.g., "/vault")',
        },
        contains: {
          type: 'string',
          description: 'String that URL should contain',
        },
      },
    },
  },
  {
    name: 'verify_element_state',
    description: 'Verify an element is in a specific state (visible, hidden, enabled, disabled, checked)',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element',
        },
        state: {
          type: 'string',
          enum: ['visible', 'hidden', 'enabled', 'disabled', 'checked', 'unchecked'],
          description: 'Expected state of the element',
        },
      },
      required: ['selector', 'state'],
    },
  },
  {
    name: 'get_element_text',
    description: 'Get the text content of an element',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element',
        },
      },
      required: ['selector'],
    },
  },
];

// ============================================
// API Testing Tools
// ============================================

const API_TOOLS: Anthropic.Tool[] = [
  {
    name: 'api_request',
    description: 'Make an HTTP request to the backend API. Use this to test API endpoints directly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP method',
        },
        endpoint: {
          type: 'string',
          description: 'API endpoint path (e.g., "/api/tasks", "/api/health")',
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT/PATCH requests',
        },
        headers: {
          type: 'object',
          description: 'Additional request headers',
        },
      },
      required: ['method', 'endpoint'],
    },
  },
  {
    name: 'verify_api_response',
    description: 'Verify the last API response matches expectations',
    input_schema: {
      type: 'object' as const,
      properties: {
        expectedStatus: {
          type: 'number',
          description: 'Expected HTTP status code',
        },
        expectedFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields that should exist in the response body',
        },
        expectedValue: {
          type: 'object',
          description: 'Key-value pairs to verify in the response',
        },
      },
    },
  },
];

// ============================================
// Test Control Tools
// ============================================

const CONTROL_TOOLS: Anthropic.Tool[] = [
  {
    name: 'log_finding',
    description: 'Log a test finding - a bug, warning, passing check, or observation. Always log what you find!',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['bug', 'warning', 'info', 'pass', 'fail'],
          description: 'Type of finding: bug (something broken), warning (potential issue), info (observation), pass (verified working), fail (test failed)',
        },
        title: {
          type: 'string',
          description: 'Short, descriptive title for the finding',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what was found',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Severity level (for bugs and warnings)',
        },
        screenshot: {
          type: 'boolean',
          description: 'Whether to attach the most recent screenshot',
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Steps to reproduce (for bugs)',
        },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'start_test_scenario',
    description: 'Mark the beginning of a test scenario. Group related tests together.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the test scenario (e.g., "Task Creation Flow", "Navigation Tests")',
        },
        description: {
          type: 'string',
          description: 'What this scenario will test',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'end_test_scenario',
    description: 'Mark the end of a test scenario and record its result',
    input_schema: {
      type: 'object' as const,
      properties: {
        passed: {
          type: 'boolean',
          description: 'Whether the scenario passed overall',
        },
        summary: {
          type: 'string',
          description: 'Summary of what was tested and the outcome',
        },
      },
      required: ['passed'],
    },
  },
  {
    name: 'complete_testing',
    description: 'Signal that testing is complete. Call this when you have finished testing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'Overall summary of the testing session',
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recommendations based on findings',
        },
      },
      required: ['summary'],
    },
  },
];

// ============================================
// Exports
// ============================================

export const ALL_TESTING_TOOLS: Anthropic.Tool[] = [
  ...NAVIGATION_TOOLS,
  ...VISION_TOOLS,
  ...VERIFICATION_TOOLS,
  ...API_TOOLS,
  ...CONTROL_TOOLS,
];

export type TestingToolName =
  | 'navigate_to_page'
  | 'click_element'
  | 'fill_input'
  | 'scroll'
  | 'wait'
  | 'take_screenshot'
  | 'analyze_screenshot'
  | 'verify_text_visible'
  | 'verify_element_exists'
  | 'verify_url'
  | 'verify_element_state'
  | 'get_element_text'
  | 'api_request'
  | 'verify_api_response'
  | 'log_finding'
  | 'start_test_scenario'
  | 'end_test_scenario'
  | 'complete_testing';

export {
  NAVIGATION_TOOLS,
  VISION_TOOLS,
  VERIFICATION_TOOLS,
  API_TOOLS,
  CONTROL_TOOLS,
};
