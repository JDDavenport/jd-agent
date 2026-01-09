/**
 * Critical paths that must be tested multiple times before deployment
 * These are the core workflows that CANNOT break
 *
 * Each path can include:
 * - Integration test scripts (existing tests in hub/scripts/)
 * - Vitest unit tests (*.test.ts files)
 * - E2E tests (Playwright tests in apps/command-center/e2e/)
 */

export interface CriticalPathConfig {
  description: string;
  integrationScripts?: string[]; // Scripts in hub/scripts/
  unitTests?: string[]; // Vitest test files
  e2eTests?: string[]; // Playwright test files in apps/command-center/e2e/
  requiresServer?: boolean;
}

export const CRITICAL_PATHS: Record<string, CriticalPathConfig> = {
  // GTD Task Flow - Core productivity workflow
  'tasks/create-process-organize': {
    description: 'Task creation, processing, and organization workflow',
    integrationScripts: ['scripts/test-tasks.ts'],
    unitTests: [
      // 'src/services/task-generation-service.test.ts', // TODO
      // 'src/api/routes/tasks.test.ts', // TODO
    ],
    requiresServer: true,
  },

  // Calendar Sync - Time blocking and scheduling
  'calendar/google-sync': {
    description: 'Google Calendar synchronization and event management',
    integrationScripts: ['scripts/test-calendar.ts'],
    unitTests: [
      // 'src/integrations/google-calendar.test.ts', // TODO
      // 'src/services/calendar-service.test.ts', // TODO
    ],
    requiresServer: true,
  },

  // Vault Operations - Knowledge management
  'vault/document-flow': {
    description: 'Vault document creation, search, and organization',
    integrationScripts: ['scripts/test-vault.ts'],
    unitTests: [
      // 'src/services/vault-page-service.test.ts', // TODO
    ],
    requiresServer: true,
  },

  // Goals & Habits - Life area tracking
  'goals/create-track-complete': {
    description: 'Goals and habits lifecycle management',
    integrationScripts: ['scripts/test-goals.ts'],
    unitTests: [
      // 'src/services/goals-service.test.ts', // TODO
      // 'src/services/habit-service.test.ts', // TODO
    ],
    e2eTests: ['../apps/command-center/e2e/goals-habits.spec.ts'],
    requiresServer: true,
  },

  // Daily Journal - Reflection system
  'journal/daily-review': {
    description: 'Daily journal and reflection workflow',
    integrationScripts: ['scripts/test-journal.ts'],
    unitTests: [],
    e2eTests: ['../apps/command-center/e2e/journal.spec.ts'],
    requiresServer: true,
  },

  // Progress Dashboard - Overview and tracking
  'progress/dashboard': {
    description: 'Progress dashboard with life area overview',
    integrationScripts: [],
    unitTests: [],
    e2eTests: ['../apps/command-center/e2e/progress.spec.ts'],
    requiresServer: true,
  },

  // Search - Cross-system discovery
  'search/global-search': {
    description: 'Global search across all entities',
    integrationScripts: ['scripts/test-search.ts'],
    unitTests: [],
    requiresServer: true,
  },

  // Ceremonies - Morning/Evening routines
  'ceremonies/routines': {
    description: 'Morning and evening ceremony workflows',
    integrationScripts: ['scripts/test-ceremonies.ts'],
    unitTests: [],
    requiresServer: true,
  },
};

export type CriticalPath = keyof typeof CRITICAL_PATHS;

/**
 * Get all critical paths that have tests defined
 */
export function getTestablePaths(): CriticalPath[] {
  return Object.entries(CRITICAL_PATHS)
    .filter(([_, config]) => {
      const hasIntegration = config.integrationScripts && config.integrationScripts.length > 0;
      const hasUnit = config.unitTests && config.unitTests.length > 0;
      return hasIntegration || hasUnit;
    })
    .map(([path]) => path as CriticalPath);
}

/**
 * Get paths that require a running server
 */
export function getServerRequiredPaths(): CriticalPath[] {
  return Object.entries(CRITICAL_PATHS)
    .filter(([_, config]) => config.requiresServer)
    .map(([path]) => path as CriticalPath);
}
