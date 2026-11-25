export type ThemeMode = 'light' | 'night';

export const THEME_STORAGE_KEY = 'baby-tracker-theme';

export const THEME_META_COLORS: Readonly<Record<ThemeMode, string>> = {
  light: '#f4f6f9',
  night: '#0b0e13',
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseThemeMode(raw: string | null | undefined): ThemeMode | null {
  if (raw === 'light' || raw === 'night') {
    return raw;
  }
  return null;
}

export function resolveInitialTheme(
  storedValue: string | null | undefined,
  prefersDark = false,
): ThemeMode {
  const parsed = parseThemeMode(storedValue);
  if (parsed !== null) {
    return parsed;
  }
  return prefersDark ? 'night' : 'light';
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'night' ? 'light' : 'night';
}

export function readStoredTheme(
  storage: KeyValueStorage | undefined,
  prefersDark = false,
): ThemeMode {
  if (!storage) {
    return resolveInitialTheme(null, prefersDark);
  }
  try {
    return resolveInitialTheme(storage.getItem(THEME_STORAGE_KEY), prefersDark);
  } catch {
    return resolveInitialTheme(null, prefersDark);
  }
}

export function persistTheme(
  storage: KeyValueStorage | undefined,
  mode: ThemeMode,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota or restricted WebView errors so UI still switches immediately.
  }
}
