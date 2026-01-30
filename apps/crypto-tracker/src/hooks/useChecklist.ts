import { useCallback, useEffect, useMemo, useState } from 'react';

export type ChecklistStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  owner?: string;
}

export interface ChecklistState {
  status: ChecklistStatus;
  notes?: string;
}

const STORAGE_KEY = 'cryptoTracker.prdChecklist';

function loadState(): Record<string, ChecklistState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveState(state: Record<string, ChecklistState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useChecklist(items: ChecklistItem[]) {
  const [state, setState] = useState<Record<string, ChecklistState>>({});

  useEffect(() => {
    setState(loadState());
  }, []);

  const setStatus = useCallback((id: string, status: ChecklistStatus) => {
    setState((prev) => {
      const next = { ...prev, [id]: { ...prev[id], status } };
      saveState(next);
      return next;
    });
  }, []);

  const setNotes = useCallback((id: string, notes: string) => {
    setState((prev) => {
      const next = { ...prev, [id]: { ...prev[id], notes } };
      saveState(next);
      return next;
    });
  }, []);

  const progress = useMemo(() => {
    const total = items.length;
    const done = items.filter((item) => state[item.id]?.status === 'done').length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [items, state]);

  return { state, setStatus, setNotes, progress };
}
