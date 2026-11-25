import { describe, expect, it } from 'vitest';
import {
  THEME_META_COLORS,
  THEME_STORAGE_KEY,
  parseThemeMode,
  persistTheme,
  readStoredTheme,
  resolveInitialTheme,
  toggleThemeMode,
  type KeyValueStorage,
} from './theme';

function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('theme domain (CA-5)', () => {
  it('parses valid theme modes and ignores unknown values', () => {
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('night')).toBe('night');
    expect(parseThemeMode('dark')).toBeNull();
    expect(parseThemeMode('')).toBeNull();
    expect(parseThemeMode(null)).toBeNull();
  });

  it('resolves stored preference over system preference', () => {
    expect(resolveInitialTheme('night', false)).toBe('night');
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme(null, true)).toBe('night');
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('toggles immediately between light and night modes', () => {
    expect(toggleThemeMode('light')).toBe('night');
    expect(toggleThemeMode('night')).toBe('light');
  });

  it('persists and reads back the selected theme mode', () => {
    const storage = createMemoryStorage();
    expect(readStoredTheme(storage, false)).toBe('light');

    persistTheme(storage, 'night');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('night');
    expect(readStoredTheme(storage, false)).toBe('night');

    persistTheme(storage, 'light');
    expect(readStoredTheme(storage, true)).toBe('light');
  });

  it('falls back safely when storage throws', () => {
    const brokenStorage: KeyValueStorage = {
      getItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => {
        throw new Error('Blocked');
      },
    };

    expect(readStoredTheme(brokenStorage, true)).toBe('night');
    expect(() => persistTheme(brokenStorage, 'night')).not.toThrow();
  });

  it('defines non-glare dark meta color for night mode', () => {
    expect(THEME_META_COLORS.night).toBe('#0b0e13');
    expect(THEME_META_COLORS.light).toBe('#f4f6f9');
  });
});
