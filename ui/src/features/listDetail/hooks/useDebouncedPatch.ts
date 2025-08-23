import { useRef } from 'react';

export type UseDebouncedPatchOptions<TPatch extends object> = {
  delayMs?: number;
  applyPatch: (patch: TPatch, signal: AbortSignal) => Promise<void>;
};

export function useDebouncedPatch<TPatch extends object>(options: UseDebouncedPatchOptions<TPatch>) {
  const { delayMs = 400, applyPatch } = options;
  const debounceTimerRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<TPatch | null>(null);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  const flush = async () => {
    const value = pendingPatchRef.current;
    pendingPatchRef.current = null;
    if (value == null) return;
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
    }
    const controller = new AbortController();
    inFlightAbortRef.current = controller;
    try {
      await applyPatch(value, controller.signal);
    } finally {
      if (inFlightAbortRef.current === controller) {
        inFlightAbortRef.current = null;
      }
    }
  };

  const onChange = (nextPatch: TPatch) => {
    pendingPatchRef.current = nextPatch;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      flush();
    }, delayMs);
  };

  const onBlurFlush = () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    flush();
  };

  const cancel = () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingPatchRef.current = null;
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
      inFlightAbortRef.current = null;
    }
  };

  return { onChange, onBlurFlush, cancel } as const;
}


