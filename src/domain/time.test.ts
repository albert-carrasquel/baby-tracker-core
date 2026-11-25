import { describe, expect, it } from 'vitest';
import {
  formatElapsedSince,
  isValidIsoUtcTimestamp,
  nowIsoUtc,
  toLocalDateKey,
} from './time';

describe('time utilities (S2-T1)', () => {
  it('produces and validates canonical ISO UTC timestamps', () => {
    const iso = nowIsoUtc(new Date('2026-11-25T14:30:00.000Z'));
    expect(iso).toBe('2026-11-25T14:30:00.000Z');
    expect(isValidIsoUtcTimestamp(iso)).toBe(true);
    expect(isValidIsoUtcTimestamp('2026-11-25T14:30:00Z')).toBe(true);

    // Reject non-UTC offsets, malformed strings, and rolled-over dates.
    expect(isValidIsoUtcTimestamp('2026-11-25T11:30:00-03:00')).toBe(false);
    expect(isValidIsoUtcTimestamp('2026-02-31T00:00:00.000Z')).toBe(false);
    expect(isValidIsoUtcTimestamp('not-a-date')).toBe(false);
  });

  it('computes calendar date key in local timezone across UTC midnight boundary', () => {
    // 2026-11-25 22:30 in Buenos Aires (-03:00) is 2026-11-26T01:30:00.000Z in UTC.
    const lateNightUtc = '2026-11-26T01:30:00.000Z';

    expect(
      toLocalDateKey(lateNightUtc, 'America/Argentina/Buenos_Aires'),
    ).toBe('2026-11-25');
    expect(toLocalDateKey(lateNightUtc, 'UTC')).toBe('2026-11-26');
  });

  it('formats relative elapsed time for status cards', () => {
    const baseIso = '2026-11-25T12:00:00.000Z';
    const baseMs = Date.parse(baseIso);

    expect(formatElapsedSince(baseIso, baseMs + 25_000)).toBe('recién');
    expect(formatElapsedSince(baseIso, baseMs - 5_000)).toBe('recién');
    expect(formatElapsedSince(baseIso, baseMs + 12 * 60_000)).toBe(
      'hace 12 min',
    );
    expect(formatElapsedSince(baseIso, baseMs + 120 * 60_000)).toBe('hace 2 h');
    expect(formatElapsedSince(baseIso, baseMs + 135 * 60_000)).toBe(
      'hace 2 h 15 min',
    );
    expect(formatElapsedSince(baseIso, baseMs + 27 * 3_600_000)).toBe(
      'hace 1 d 3 h',
    );
  });
});
