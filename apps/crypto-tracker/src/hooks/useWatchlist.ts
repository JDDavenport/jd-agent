import { useCallback, useEffect, useMemo, useState } from 'react';

export interface WatchlistEntry {
  coinId: string;
  investedUsd: number;
}

const STORAGE_KEY = 'cryptoTracker.watchlist';

function loadWatchlist(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchlistEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWatchlist(entries: WatchlistEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    setEntries(loadWatchlist());
  }, []);

  const add = useCallback((coinId: string) => {
    setEntries((prev) => {
      if (prev.some((entry) => entry.coinId === coinId)) return prev;
      const next = [...prev, { coinId, investedUsd: 0 }];
      saveWatchlist(next);
      return next;
    });
  }, []);

  const remove = useCallback((coinId: string) => {
    setEntries((prev) => {
      const next = prev.filter((entry) => entry.coinId !== coinId);
      saveWatchlist(next);
      return next;
    });
  }, []);

  const updateInvestment = useCallback((coinId: string, investedUsd: number) => {
    setEntries((prev) => {
      const next = prev.map((entry) =>
        entry.coinId === coinId ? { ...entry, investedUsd } : entry
      );
      saveWatchlist(next);
      return next;
    });
  }, []);

  const isWatching = useCallback(
    (coinId: string) => entries.some((entry) => entry.coinId === coinId),
    [entries]
  );

  const lookup = useMemo(() => {
    const map = new Map<string, WatchlistEntry>();
    entries.forEach((entry) => map.set(entry.coinId, entry));
    return map;
  }, [entries]);

  return { entries, add, remove, updateInvestment, isWatching, lookup };
}
