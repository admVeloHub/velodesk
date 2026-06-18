/**
 * Hook localStorage reativo
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage(key, initialValue) {
  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const [value, setValue] = useState(read);

  useEffect(() => {
    setValue(read());
  }, [read]);

  const setStored = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key]
  );

  return [value, setStored];
}

export function getStorageItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setStorageItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getStorageString(key, fallback = '') {
  return localStorage.getItem(key) ?? fallback;
}

export function setStorageString(key, value) {
  localStorage.setItem(key, value);
}
