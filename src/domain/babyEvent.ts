import {
  isValidIsoUtcTimestamp,
  nowIsoUtc,
  toLocalDateKey,
} from './time';

/* ------------------------------------------------------------------ */
/*  Local-first generic defaults (non-PII, migrated on Supabase link) */
/* ------------------------------------------------------------------ */

export const LOCAL_DEFAULT_BABY_ID = 'local-baby';
export const LOCAL_DEFAULT_USER_ID = 'local-caregiver';

/* ------------------------------------------------------------------ */
/*  Validation bounds (Sec. 2.1 of docs/spec.md)                      */
/* ------------------------------------------------------------------ */

export const MAX_PAYLOAD_BYTES = 4096;
export const MAX_SHORT_NOTE_LENGTH = 280;
export const MAX_PEDIATRIC_NOTE_LENGTH = 500;
export const MAX_MED_FIELD_LENGTH = 120;
export const MAX_ID_LENGTH = 128;

export const AMOUNT_ML_MIN = 1;
export const AMOUNT_ML_MAX = 1000;
export const DURATION_SEC_MIN = 1;
export const DURATION_SEC_MAX = 43_200; // 12 hours
export const TEMP_C_MIN = 30;
export const TEMP_C_MAX = 45;
export const WEIGHT_KG_MIN = 0.2;
export const WEIGHT_KG_MAX = 40;
export const HEIGHT_CM_MIN = 20;
export const HEIGHT_CM_MAX = 150;

/* ------------------------------------------------------------------ */
/*  Core domain types (Sec. 3 & Sec. 6 of docs/spec.md)               */
/* ------------------------------------------------------------------ */

export const BABY_EVENT_TYPES = [
  'feeding_breast',
  'feeding_bottle',
  'pumping',
  'sleep',
  'diaper',
  'health_temp',
  'health_growth',
  'health_med',
  'note',
] as const;

export type BabyEventType = (typeof BABY_EVENT_TYPES)[number];

export const SYNC_STATUSES = ['synced', 'pending', 'error'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export type BreastSide = 'left' | 'right';
export type PumpingSide = 'left' | 'right' | 'both';
export type BottleMilkType = 'breast_milk' | 'formula' | 'other';
export type SleepKind = 'nap' | 'night';
export type DiaperKind = 'pee' | 'poo' | 'both';

export interface TimeInterval {
  readonly start: string;
  readonly end: string | null;
}

export interface FeedingBreastPayload {
  readonly left: readonly TimeInterval[];
  readonly right: readonly TimeInterval[];
  readonly note?: string;
}

export interface FeedingBottlePayload {
  readonly amountMl: number;
  readonly milkType: BottleMilkType;
  readonly note?: string;
}

export interface PumpingPayload {
  readonly amountMl?: number;
  readonly durationSec?: number;
  readonly side?: PumpingSide;
  readonly note?: string;
}

export interface SleepPayload {
  readonly kind: SleepKind;
  readonly note?: string;
}

export interface DiaperPayload {
  readonly diaperKind: DiaperKind;
  readonly note?: string;
}

export interface HealthTempPayload {
  readonly tempC: number;
  readonly note?: string;
}

export interface HealthGrowthPayload {
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly note?: string;
}

export interface HealthMedPayload {
  readonly medName: string;
  readonly dose: string;
  readonly note?: string;
}

export interface NotePayload {
  readonly text: string;
}

export interface EventPayloadByType {
  readonly feeding_breast: FeedingBreastPayload;
  readonly feeding_bottle: FeedingBottlePayload;
  readonly pumping: PumpingPayload;
  readonly sleep: SleepPayload;
  readonly diaper: DiaperPayload;
  readonly health_temp: HealthTempPayload;
  readonly health_growth: HealthGrowthPayload;
  readonly health_med: HealthMedPayload;
  readonly note: NotePayload;
}

interface BabyEventBase<T extends BabyEventType> {
  readonly id: string;
  readonly babyId: string;
  readonly type: T;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly payload: EventPayloadByType[T];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly syncStatus: SyncStatus;
}

export type BabyEvent = {
  [T in BabyEventType]: BabyEventBase<T>;
}[BabyEventType];

export type BabyEventOf<T extends BabyEventType> = Extract<
  BabyEvent,
  { readonly type: T }
>;

export function isEventOfType<T extends BabyEventType>(
  event: BabyEvent,
  type: T,
): event is BabyEventOf<T> {
  return event.type === type;
}

/**
 * Remote representation for Supabase (syncStatus is strictly local-only).
 */
export type RemoteBabyEvent = {
  [T in BabyEventType]: Omit<BabyEventBase<T>, 'syncStatus'>;
}[BabyEventType];

/* ------------------------------------------------------------------ */
/*  UUID generation & active filter                                   */
/* ------------------------------------------------------------------ */

export function generateEventId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  throw new Error('Secure crypto.randomUUID() is unavailable in this environment.');
}

export function isActiveEvent(
  event: Pick<BabyEvent, 'deletedAt'>,
): boolean {
  return event.deletedAt === null;
}

/* ------------------------------------------------------------------ */
/*  Strict runtime validation (guards IndexedDB & Supabase inputs)    */
/* ------------------------------------------------------------------ */

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafePlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return false;
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      return false;
    }
    const nested = (value as Record<string, unknown>)[key];
    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (typeof item === 'object' && item !== null && !isSafePlainObject(item)) {
          return false;
        }
      }
    } else if (typeof nested === 'object' && nested !== null) {
      if (!isSafePlainObject(nested)) {
        return false;
      }
    }
  }
  return true;
}

function isBoundedNonEmptyString(value: unknown, maxLen: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLen
  );
}

function isOptionalNoteValid(note: unknown): note is string | undefined {
  return (
    note === undefined ||
    (typeof note === 'string' && note.length <= MAX_SHORT_NOTE_LENGTH)
  );
}

function isFiniteInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isValidTimeInterval(value: unknown): value is TimeInterval {
  if (!isSafePlainObject(value)) {
    return false;
  }
  const start = value['start'];
  const end = value['end'];
  if (!isValidIsoUtcTimestamp(start)) {
    return false;
  }
  if (end !== null) {
    if (!isValidIsoUtcTimestamp(end)) {
      return false;
    }
    if (Date.parse(end) < Date.parse(start)) {
      return false;
    }
  }
  return true;
}

function getUtf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

function validatePayloadForType(
  type: BabyEventType,
  payload: unknown,
): boolean {
  if (!isSafePlainObject(payload)) {
    return false;
  }

  const serialized = JSON.stringify(payload);
  if (getUtf8ByteLength(serialized) > MAX_PAYLOAD_BYTES) {
    return false;
  }

  switch (type) {
    case 'diaper': {
      const kind = payload['diaperKind'];
      const validKind = kind === 'pee' || kind === 'poo' || kind === 'both';
      return validKind && isOptionalNoteValid(payload['note']);
    }
    case 'sleep': {
      const kind = payload['kind'];
      const validKind = kind === 'nap' || kind === 'night';
      return validKind && isOptionalNoteValid(payload['note']);
    }
    case 'feeding_bottle': {
      const milkType = payload['milkType'];
      const validMilk =
        milkType === 'breast_milk' ||
        milkType === 'formula' ||
        milkType === 'other';
      return (
        validMilk &&
        isFiniteInRange(payload['amountMl'], AMOUNT_ML_MIN, AMOUNT_ML_MAX) &&
        isOptionalNoteValid(payload['note'])
      );
    }
    case 'feeding_breast': {
      const left = payload['left'];
      const right = payload['right'];
      if (!Array.isArray(left) || !Array.isArray(right)) {
        return false;
      }
      if (left.length === 0 && right.length === 0) {
        return false;
      }
      return (
        left.every(isValidTimeInterval) &&
        right.every(isValidTimeInterval) &&
        isOptionalNoteValid(payload['note'])
      );
    }
    case 'pumping': {
      const amount = payload['amountMl'];
      const duration = payload['durationSec'];
      const side = payload['side'];
      const hasAmount = amount !== undefined;
      const hasDuration = duration !== undefined;
      if (!hasAmount && !hasDuration) {
        return false;
      }
      if (hasAmount && !isFiniteInRange(amount, 0, AMOUNT_ML_MAX)) {
        return false;
      }
      if (
        hasDuration &&
        !isFiniteInRange(duration, DURATION_SEC_MIN, DURATION_SEC_MAX)
      ) {
        return false;
      }
      const validSide =
        side === undefined ||
        side === 'left' ||
        side === 'right' ||
        side === 'both';
      return validSide && isOptionalNoteValid(payload['note']);
    }
    case 'health_temp': {
      return (
        isFiniteInRange(payload['tempC'], TEMP_C_MIN, TEMP_C_MAX) &&
        isOptionalNoteValid(payload['note'])
      );
    }
    case 'health_growth': {
      const weight = payload['weightKg'];
      const height = payload['heightCm'];
      const hasWeight = weight !== undefined;
      const hasHeight = height !== undefined;
      if (!hasWeight && !hasHeight) {
        return false;
      }
      if (hasWeight && !isFiniteInRange(weight, WEIGHT_KG_MIN, WEIGHT_KG_MAX)) {
        return false;
      }
      if (hasHeight && !isFiniteInRange(height, HEIGHT_CM_MIN, HEIGHT_CM_MAX)) {
        return false;
      }
      return isOptionalNoteValid(payload['note']);
    }
    case 'health_med': {
      return (
        isBoundedNonEmptyString(payload['medName'], MAX_MED_FIELD_LENGTH) &&
        isBoundedNonEmptyString(payload['dose'], MAX_MED_FIELD_LENGTH) &&
        isOptionalNoteValid(payload['note'])
      );
    }
    case 'note': {
      return isBoundedNonEmptyString(
        payload['text'],
        MAX_PEDIATRIC_NOTE_LENGTH,
      );
    }
  }
}

export function isValidBabyEvent(input: unknown): input is BabyEvent {
  if (!isSafePlainObject(input)) {
    return false;
  }

  const id = input['id'];
  const babyId = input['babyId'];
  const type = input['type'];
  const startedAt = input['startedAt'];
  const endedAt = input['endedAt'];
  const createdBy = input['createdBy'];
  const createdAt = input['createdAt'];
  const updatedAt = input['updatedAt'];
  const deletedAt = input['deletedAt'];
  const syncStatus = input['syncStatus'];

  if (
    !isBoundedNonEmptyString(id, MAX_ID_LENGTH) ||
    !isBoundedNonEmptyString(babyId, MAX_ID_LENGTH) ||
    !isBoundedNonEmptyString(createdBy, MAX_ID_LENGTH)
  ) {
    return false;
  }

  if (
    typeof type !== 'string' ||
    !(BABY_EVENT_TYPES as readonly string[]).includes(type)
  ) {
    return false;
  }

  if (
    typeof syncStatus !== 'string' ||
    !(SYNC_STATUSES as readonly string[]).includes(syncStatus)
  ) {
    return false;
  }

  if (
    !isValidIsoUtcTimestamp(startedAt) ||
    !isValidIsoUtcTimestamp(createdAt) ||
    !isValidIsoUtcTimestamp(updatedAt)
  ) {
    return false;
  }

  if (endedAt !== null) {
    if (!isValidIsoUtcTimestamp(endedAt)) {
      return false;
    }
    if (Date.parse(endedAt) < Date.parse(startedAt)) {
      return false;
    }
  }

  if (deletedAt !== null && !isValidIsoUtcTimestamp(deletedAt)) {
    return false;
  }

  return validatePayloadForType(type as BabyEventType, input['payload']);
}

export function validateBabyEvent(input: unknown): BabyEvent {
  if (!isValidBabyEvent(input)) {
    throw new Error('Invalid BabyEvent structure or out-of-bounds payload.');
  }
  return input;
}

/* ------------------------------------------------------------------ */
/*  Factories                                                         */
/* ------------------------------------------------------------------ */

export interface CreateBabyEventOptions<T extends BabyEventType> {
  readonly type: T;
  readonly payload: EventPayloadByType[T];
  readonly startedAt?: string;
  readonly endedAt?: string | null;
  readonly babyId?: string;
  readonly createdBy?: string;
  readonly id?: string;
  readonly now?: Date;
}

export function createBabyEvent<T extends BabyEventType>(
  options: CreateBabyEventOptions<T>,
): BabyEventOf<T> {
  const timestamp = nowIsoUtc(options.now);
  const candidate: BabyEventBase<T> = {
    id: options.id ?? generateEventId(),
    babyId: options.babyId ?? LOCAL_DEFAULT_BABY_ID,
    type: options.type,
    startedAt: options.startedAt ?? timestamp,
    endedAt: options.endedAt ?? null,
    payload: options.payload,
    createdBy: options.createdBy ?? LOCAL_DEFAULT_USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncStatus: 'pending',
  };

  validateBabyEvent(candidate);
  return candidate as unknown as BabyEventOf<T>;
}

export interface CreateDiaperEventInput {
  readonly diaperKind: DiaperKind;
  readonly startedAt?: string;
  readonly note?: string;
  readonly babyId?: string;
  readonly createdBy?: string;
  readonly now?: Date;
}

export function createDiaperEvent(
  input: CreateDiaperEventInput,
): BabyEventOf<'diaper'> {
  const trimmedNote = input.note?.trim();
  const payload: DiaperPayload =
    trimmedNote && trimmedNote.length > 0
      ? { diaperKind: input.diaperKind, note: trimmedNote }
      : { diaperKind: input.diaperKind };

  return createBabyEvent({
    type: 'diaper',
    payload,
    startedAt: input.startedAt,
    babyId: input.babyId,
    createdBy: input.createdBy,
    now: input.now,
  });
}

/* ------------------------------------------------------------------ */
/*  Local calendar date grouping & daily timeline helpers             */
/* ------------------------------------------------------------------ */

export interface GroupByLocalDateOptions {
  readonly timeZone?: string;
  readonly includeDeleted?: boolean;
}

/**
 * Groups events by calendar date ('YYYY-MM-DD') in the device's local timezone
 * using `startedAt` as the base criterion, excluding soft-deleted events by
 * default and sorting each day newest-first.
 */
export function groupEventsByLocalDate<T extends BabyEvent>(
  events: readonly T[],
  options: GroupByLocalDateOptions = {},
): Map<string, T[]> {
  const includeDeleted = options.includeDeleted ?? false;
  const visible = includeDeleted ? [...events] : events.filter(isActiveEvent);

  visible.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

  const grouped = new Map<string, T[]>();
  for (const event of visible) {
    const key = toLocalDateKey(event.startedAt, options.timeZone);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }
  return grouped;
}

export function getActiveEventsForLocalDate<T extends BabyEvent>(
  events: readonly T[],
  localDateKey: string,
  timeZone?: string,
): T[] {
  return groupEventsByLocalDate(events, { timeZone }).get(localDateKey) ?? [];
}
