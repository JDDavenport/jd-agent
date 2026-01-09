/**
 * useKeyboardShortcuts Hook
 *
 * Global keyboard shortcuts for the Command Center dashboard.
 * Supports vim-style navigation (g + key) and common actions.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

interface ShortcutConfig {
  enabled?: boolean;
  onHelp?: () => void;
}

export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
  const { enabled = true, onHelp } = config;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pendingKey = useRef<string | null>(null);
  const pendingTimeout = useRef<NodeJS.Timeout | null>(null);

  const clearPending = useCallback(() => {
    pendingKey.current = null;
    if (pendingTimeout.current) {
      clearTimeout(pendingTimeout.current);
      pendingTimeout.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // Handle "g" prefix for navigation shortcuts
      if (pendingKey.current === 'g') {
        clearPending();
        event.preventDefault();

        switch (key) {
          case 't': // g t → Tasks app
            window.location.href = 'http://localhost:5180';
            break;
          case 'g': // g g → Goals page
            navigate('/goals');
            break;
          case 'h': // g h → Habits page
            navigate('/habits');
            break;
          case 'v': // g v → Vault app
            window.location.href = 'http://localhost:5181';
            break;
          case 'd': // g d → Dashboard (home)
            navigate('/');
            break;
          case 's': // g s → Settings
            navigate('/settings');
            break;
          case 'p': // g p → Progress
            navigate('/progress');
            break;
          case 'c': // g c → Canvas
            navigate('/canvas');
            break;
        }
        return;
      }

      // Single key shortcuts
      switch (key) {
        case 'g':
          // Start "g" prefix mode
          pendingKey.current = 'g';
          // Clear after 1 second if no follow-up key
          pendingTimeout.current = setTimeout(clearPending, 1000);
          break;

        case 'r':
          // Refresh all dashboard data
          if (!event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          }
          break;

        case '?':
          // Show help
          event.preventDefault();
          onHelp?.();
          break;

        case 'escape':
          // Clear any pending state
          clearPending();
          break;
      }
    },
    [navigate, queryClient, clearPending, onHelp]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPending();
    };
  }, [enabled, handleKeyDown, clearPending]);

  return {
    clearPending,
  };
}

/**
 * Keyboard shortcuts reference
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: 'g t', description: 'Go to Tasks app' },
  { keys: 'g g', description: 'Go to Goals' },
  { keys: 'g h', description: 'Go to Habits' },
  { keys: 'g v', description: 'Go to Vault app' },
  { keys: 'g d', description: 'Go to Dashboard' },
  { keys: 'g s', description: 'Go to Settings' },
  { keys: 'g p', description: 'Go to Progress' },
  { keys: 'g c', description: 'Go to Canvas' },
  { keys: 'r', description: 'Refresh dashboard data' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Cancel / Close' },
] as const;

export default useKeyboardShortcuts;
