#!/usr/bin/env bun
/**
 * Test Vault iOS App
 *
 * Runs the iOS Testing Agent against the Vault app with the defined requirements.
 *
 * Usage:
 *   cd hub && bun run scripts/test-vault-ios.ts
 *
 * Prerequisites:
 *   - iOS Simulator running with Vault app
 *   - GOOGLE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY set
 */

// Load environment variables
import { config } from 'dotenv';
config();

import { testIOSApp } from '../src/agents/testing/ios-testing-agent';

// Vault iOS App Requirements
const VAULT_REQUIREMENTS = [
  // Core viewing functionality
  {
    id: 'VIEW-001',
    description: 'User can view all notes in a hierarchical list',
    category: 'View Notes',
    priority: 'critical' as const,
  },
  {
    id: 'VIEW-002',
    description: 'Notes are displayed with their titles visible',
    category: 'View Notes',
    priority: 'critical' as const,
  },
  {
    id: 'VIEW-003',
    description: 'User can see a sidebar or navigation to browse notes',
    category: 'View Notes',
    priority: 'high' as const,
  },

  // Search functionality
  {
    id: 'SEARCH-001',
    description: 'User can access a search function',
    category: 'Search',
    priority: 'critical' as const,
  },
  {
    id: 'SEARCH-002',
    description: 'Search input field is visible or accessible',
    category: 'Search',
    priority: 'high' as const,
  },

  // AI Chat functionality
  {
    id: 'AI-001',
    description: 'User can access an AI chat or assistant feature',
    category: 'AI Chat',
    priority: 'high' as const,
  },
  {
    id: 'AI-002',
    description: 'Chat interface has an input field for questions',
    category: 'AI Chat',
    priority: 'high' as const,
  },

  // Create note functionality
  {
    id: 'CREATE-001',
    description: 'User can see a button or option to create a new note',
    category: 'Create Note',
    priority: 'critical' as const,
  },
  {
    id: 'CREATE-002',
    description: 'New note creation is accessible from the main screen',
    category: 'Create Note',
    priority: 'high' as const,
  },

  // Note nesting/hierarchy
  {
    id: 'NEST-001',
    description: 'Notes appear to support nesting or hierarchy',
    category: 'Nesting',
    priority: 'high' as const,
  },
  {
    id: 'NEST-002',
    description: 'Indentation or folder structure is visible for nested notes',
    category: 'Nesting',
    priority: 'medium' as const,
  },

  // Block editor functionality
  {
    id: 'BLOCK-001',
    description: 'Editor area is visible when viewing/editing a note',
    category: 'Block Editor',
    priority: 'critical' as const,
  },
  {
    id: 'BLOCK-002',
    description: 'Formatting toolbar or options are available',
    category: 'Block Editor',
    priority: 'high' as const,
  },
  {
    id: 'BLOCK-003',
    description: 'User can see block-level content (paragraphs, headings, lists)',
    category: 'Block Editor',
    priority: 'high' as const,
  },

  // Mobile-specific UI
  {
    id: 'MOBILE-001',
    description: 'App has mobile-appropriate navigation (bottom tabs or hamburger menu)',
    category: 'Mobile UI',
    priority: 'high' as const,
  },
  {
    id: 'MOBILE-002',
    description: 'Touch targets appear appropriately sized for mobile',
    category: 'Mobile UI',
    priority: 'medium' as const,
  },
  {
    id: 'MOBILE-003',
    description: 'Content is readable without horizontal scrolling',
    category: 'Mobile UI',
    priority: 'medium' as const,
  },
];

async function main() {
  console.log('🍎 Vault iOS App Testing');
  console.log('========================\n');

  try {
    const session = await testIOSApp({
      bundleId: 'com.jdagent.vault',
      requirements: VAULT_REQUIREMENTS,
    });

    // Exit with appropriate code
    const failCount = session.results.filter(r => r.status === 'fail').length;
    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test run failed:', error);
    process.exit(1);
  }
}

main();
