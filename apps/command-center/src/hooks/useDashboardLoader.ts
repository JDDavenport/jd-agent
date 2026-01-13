/**
 * useDashboardLoader Hook
 *
 * Coordinates dashboard data loading to prevent overwhelming the server.
 * Uses a cascading loading pattern:
 * 1. First: Enhanced dashboard (metrics cards)
 * 2. After 500ms: Tasks and deadlines
 * 3. After 1000ms: Secondary widgets (canvas, fitness, etc.)
 */

import { useState, useEffect } from 'react';
import { useDashboardEnhanced } from './useDashboardEnhanced';

export function useDashboardLoader() {
  const [phase, setPhase] = useState(1);
  const enhanced = useDashboardEnhanced();

  useEffect(() => {
    // Phase 2: After enhanced data loads or after 2 seconds
    const timer1 = setTimeout(() => {
      setPhase(2);
    }, enhanced.isSuccess ? 500 : 2000);

    return () => clearTimeout(timer1);
  }, [enhanced.isSuccess]);

  useEffect(() => {
    if (phase >= 2) {
      // Phase 3: Load secondary widgets 1 second after phase 2
      const timer2 = setTimeout(() => {
        setPhase(3);
      }, 1000);

      return () => clearTimeout(timer2);
    }
  }, [phase]);

  return {
    enhanced,
    // Control flags for cascading load
    canLoadTasks: phase >= 2,
    canLoadSecondary: phase >= 3,
    phase,
  };
}
