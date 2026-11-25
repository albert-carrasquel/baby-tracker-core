import { describe, expect, it } from 'vitest';
import {
  LOCAL_DEFAULT_BABY_ID,
  LOCAL_DEFAULT_USER_ID,
  MAX_PEDIATRIC_NOTE_LENGTH,
  createBabyEvent,
  createDiaperEvent,
  generateEventId,
  getActiveEventsForLocalDate,
  groupEventsByLocalDate,
  isValidBabyEvent,
  validateBabyEvent,
} from './babyEvent';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('BabyEvent contract & strict validation (S2-T1)', () => {
  it('generates valid v4 UUIDs via native crypto.randomUUID()', () => {
    const id1 = generateEventId();
    const id2 = generateEventId();
    expect(id1).toMatch(UUID_V4_REGEX);
    expect(id2).toMatch(UUID_V4_REGEX);
    expect(id1).not.toBe(id2);
  });

  it('creates a local diaper event with non-PII defaults, pending syncStatus, and null deletedAt', () => {
    const now = new Date('2026-11-25T15:00:00.000Z');
    const diaper = createDiaperEvent({
      diaperKind: 'both',
      note: '  sin irritacion  ',
      now,
    });

    expect(diaper.id).toMatch(UUID_V4_REGEX);
    expect(diaper.babyId).toBe(LOCAL_DEFAULT_BABY_ID);
    expect(diaper.createdBy).toBe(LOCAL_DEFAULT_USER_ID);
    expect(diaper.type).toBe('diaper');
    expect(diaper.payload).toEqual({
      diaperKind: 'both',
      note: 'sin irritacion',
    });
    expect(diaper.startedAt).toBe('2026-11-25T15:00:00.000Z');
    expect(diaper.endedAt).toBeNull();
    expect(diaper.deletedAt).toBeNull();
    expect(diaper.syncStatus).toBe('pending');
  });

  it('supports all 9 MVP event types with valid payloads', () => {
    const now = new Date('2026-11-25T15:00:00.000Z');

    expect(() =>
      createBabyEvent({
        type: 'feeding_breast',
        startedAt: '2026-11-25T14:40:00.000Z',
        endedAt: '2026-11-25T14:55:00.000Z',
        payload: {
          left: [
            {
              start: '2026-11-25T14:40:00.000Z',
              end: '2026-11-25T14:48:00.000Z',
            },
          ],
          right: [
            {
              start: '2026-11-25T14:50:00.000Z',
              end: '2026-11-25T14:55:00.000Z',
            },
          ],
        },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'feeding_bottle',
        payload: { amountMl: 90, milkType: 'formula' },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'pumping',
        payload: { amountMl: 60, durationSec: 900, side: 'both' },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'sleep',
        startedAt: '2026-11-25T13:00:00.000Z',
        endedAt: '2026-11-25T14:15:00.000Z',
        payload: { kind: 'nap' },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'health_temp',
        payload: { tempC: 36.8 },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'health_growth',
        payload: { weightKg: 4.35, heightCm: 54.5 },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'health_med',
        payload: { medName: 'Paracetamol', dose: '0.6 ml' },
        now,
      }),
    ).not.toThrow();

    expect(() =>
      createBabyEvent({
        type: 'note',
        payload: { text: 'Consultar sobre reflujo leve en proximo control.' },
        now,
      }),
    ).not.toThrow();
  });

  it('rejects out-of-range numbers, oversized text/payloads, invalid timestamps, and dangerous keys', () => {
    const valid = createDiaperEvent({
      diaperKind: 'pee',
      now: new Date('2026-11-25T15:00:00.000Z'),
    });

    // Out-of-range temperature
    expect(
      isValidBabyEvent({
        ...valid,
        type: 'health_temp',
        payload: { tempC: 99 },
      }),
    ).toBe(false);

    // NaN / Infinity
    expect(
      isValidBabyEvent({
        ...valid,
        type: 'feeding_bottle',
        payload: { amountMl: Number.NaN, milkType: 'formula' },
      }),
    ).toBe(false);

    // Oversized note text
    expect(
      isValidBabyEvent({
        ...valid,
        type: 'note',
        payload: { text: 'a'.repeat(MAX_PEDIATRIC_NOTE_LENGTH + 1) },
      }),
    ).toBe(false);

    // endedAt earlier than startedAt
    expect(
      isValidBabyEvent({
        ...valid,
        startedAt: '2026-11-25T15:00:00.000Z',
        endedAt: '2026-11-25T14:59:00.000Z',
      }),
    ).toBe(false);

    // Non-UTC timestamp
    expect(
      isValidBabyEvent({
        ...valid,
        startedAt: '2026-11-25T12:00:00-03:00',
      }),
    ).toBe(false);

    // Prototype pollution own property via JSON.parse
    const malicious = JSON.parse(
      JSON.stringify(valid).replace(
        '"diaperKind":"pee"',
        '"diaperKind":"pee","__proto__":{"polluted":true}',
      ),
    ) as unknown;
    expect(() => validateBabyEvent(malicious)).toThrow();
  });

  it('groups active events by local calendar date across midnight and excludes deletedAt !== null', () => {
    const tz = 'America/Argentina/Buenos_Aires'; // UTC-3
    const e1 = createDiaperEvent({
      diaperKind: 'pee',
      // 2026-11-24 23:15 local (-03:00) -> still Nov 24 locally, Nov 25 in UTC!
      startedAt: '2026-11-25T02:15:00.000Z',
      now: new Date('2026-11-25T02:15:00.000Z'),
    });
    const e2 = createDiaperEvent({
      diaperKind: 'poo',
      // 2026-11-25 00:10 local (-03:00) -> Nov 25 locally
      startedAt: '2026-11-25T03:10:00.000Z',
      now: new Date('2026-11-25T03:10:00.000Z'),
    });
    const deletedEvent = {
      ...createDiaperEvent({
        diaperKind: 'both',
        startedAt: '2026-11-25T04:00:00.000Z',
        now: new Date('2026-11-25T04:00:00.000Z'),
      }),
      deletedAt: '2026-11-25T04:05:00.000Z',
    };

    const grouped = groupEventsByLocalDate([e1, e2, deletedEvent], {
      timeZone: tz,
    });

    expect(grouped.get('2026-11-24')?.map((e) => e.id)).toEqual([e1.id]);
    expect(grouped.get('2026-11-25')?.map((e) => e.id)).toEqual([e2.id]);
    expect(
      getActiveEventsForLocalDate([e1, e2, deletedEvent], '2026-11-25', tz).map(
        (e) => e.id,
      ),
    ).toEqual([e2.id]);
  });
});
