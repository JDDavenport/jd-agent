import { useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<unknown>;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook for auto-saving data with debouncing
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 30000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const lastSavedRef = useRef<string>('');
  const isSavingRef = useRef(false);

  const save = useCallback(async () => {
    if (!enabled || isSavingRef.current) return;

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;

    try {
      isSavingRef.current = true;
      await onSave(data);
      lastSavedRef.current = serialized;
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, [data, onSave, enabled]);

  const debouncedSave = useDebouncedCallback(save, debounceMs);

  // Trigger debounced save when data changes
  useEffect(() => {
    if (enabled) {
      debouncedSave();
    }
  }, [data, enabled, debouncedSave]);

  // Force save on unmount
  useEffect(() => {
    return () => {
      if (enabled) {
        debouncedSave.flush();
      }
    };
  }, [enabled, debouncedSave]);

  // Return a function to force immediate save
  const forceSave = useCallback(() => {
    debouncedSave.cancel();
    return save();
  }, [debouncedSave, save]);

  return { forceSave, isSaving: isSavingRef.current };
}
