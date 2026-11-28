"use client";

import { useCallback, useSyncExternalStore } from "react";

// A localStorage value that re-renders every component using it when it changes.
// Renders `serverValue` on the server and before hydration; storage that throws
// (private mode, blocked site data) reads as null.

const EVENT = "pikoo:stored-value";
// Used when storage throws, so a choice still lasts until the page reloads
const memory = new Map<string, string | null>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function useStoredValue(key: string, serverValue: string | null = null): [string | null, (v: string | null) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (e: Event) => {
      if (e instanceof StorageEvent ? e.key === key : (e as CustomEvent).detail === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, onStorage);
    };
  }, [key]);
  const value = useSyncExternalStore(subscribe, () => read(key), () => serverValue);
  const set = useCallback((v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, v);
    } catch {
      memory.set(key, v);
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  }, [key]);
  return [value, set];
}
