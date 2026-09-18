// ════════════════════════════════════════════════════════════════════════════
// storage.ts — Safe localStorage wrappers (Safari private mode throws)
// ════════════════════════════════════════════════════════════════════════════

const memoryFallback = new Map<string, string>();

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}
