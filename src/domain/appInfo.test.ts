import { describe, expect, it } from 'vitest';
import { APP_METADATA, formatShellStatus } from './appInfo';

describe('appInfo', () => {
  it('exposes offline-first MVP metadata', () => {
    expect(APP_METADATA.name).toBe('Baby Tracker Core');
    expect(APP_METADATA.offlineFirst).toBe(true);
  });

  it('formats connectivity label', () => {
    expect(formatShellStatus(true)).toBe('En linea');
    expect(formatShellStatus(false)).toBe('Sin conexion (modo local)');
  });
});
