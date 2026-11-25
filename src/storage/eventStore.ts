import {
  isActiveEvent,
  isEventOfType,
  isValidBabyEvent,
  validateBabyEvent,
  type BabyEvent,
  type BabyEventOf,
  type BabyEventType,
  type SyncStatus,
} from '../domain/babyEvent';

export interface EventStore {
  /**
   * Persists a newly created local event, enforcing `deletedAt: null` and
   * `syncStatus: 'pending'` for immediate offline-first availability (CA-2).
   */
  saveNewEvent<T extends BabyEvent>(event: T): Promise<T>;

  /**
   * Upserts an existing or synchronized event after strict validation.
   */
  putEvent<T extends BabyEvent>(event: T): Promise<T>;

  /**
   * Reads a single validated event by UUID, or `null` if absent/invalid.
   */
  getEventById(id: string): Promise<BabyEvent | null>;

  /**
   * Lists all valid events (including soft-deleted ones), sorted newest-first
   * by `startedAt`.
   */
  listAllEvents(): Promise<BabyEvent[]>;

  /**
   * Lists only active events (`deletedAt === null`), sorted newest-first
   * by `startedAt`.
   */
  listActiveEvents(): Promise<BabyEvent[]>;

  /**
   * Lists active events of a specific `BabyEventType`, sorted newest-first
   * by `startedAt`.
   */
  listActiveEventsByType<T extends BabyEventType>(
    type: T,
  ): Promise<BabyEventOf<T>[]>;

  /**
   * Lists valid events matching a local `SyncStatus` (e.g. `'pending'`).
   */
  listEventsBySyncStatus(status: SyncStatus): Promise<BabyEvent[]>;

  /**
   * Clears all local events (used in tests and explicit secure sign-out).
   */
  clearAllEvents(): Promise<void>;
}

export function sortEventsNewestFirst<T extends BabyEvent>(events: T[]): T[] {
  return events.sort((a, b) => {
    const diff = Date.parse(b.startedAt) - Date.parse(a.startedAt);
    if (diff !== 0) {
      return diff;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function normalizeNewLocalEvent<T extends BabyEvent>(event: T): T {
  if (event.deletedAt !== null) {
    throw new Error('New local events must have deletedAt set to null.');
  }
  const normalized: T = {
    ...event,
    deletedAt: null,
    syncStatus: 'pending',
  };
  validateBabyEvent(normalized);
  return normalized;
}

/**
 * Lightweight in-memory EventStore implementation (useful as a deterministic
 * test double for pure UI flows).
 */
export function createInMemoryEventStore(
  initialEvents: readonly BabyEvent[] = [],
): EventStore {
  const records = new Map<string, BabyEvent>();
  for (const item of initialEvents) {
    validateBabyEvent(item);
    records.set(item.id, structuredClone(item));
  }

  return {
    saveNewEvent<T extends BabyEvent>(event: T): Promise<T> {
      const normalized = normalizeNewLocalEvent(event);
      records.set(normalized.id, structuredClone(normalized));
      return Promise.resolve(structuredClone(normalized));
    },

    putEvent<T extends BabyEvent>(event: T): Promise<T> {
      validateBabyEvent(event);
      records.set(event.id, structuredClone(event));
      return Promise.resolve(structuredClone(event));
    },

    getEventById(id: string): Promise<BabyEvent | null> {
      const found = records.get(id);
      if (!found || !isValidBabyEvent(found)) {
        return Promise.resolve(null);
      }
      return Promise.resolve(structuredClone(found));
    },

    listAllEvents(): Promise<BabyEvent[]> {
      const valid: BabyEvent[] = [];
      for (const value of records.values()) {
        if (isValidBabyEvent(value)) {
          valid.push(structuredClone(value));
        }
      }
      return Promise.resolve(sortEventsNewestFirst(valid));
    },

    async listActiveEvents(): Promise<BabyEvent[]> {
      const all = await this.listAllEvents();
      return all.filter(isActiveEvent);
    },

    async listActiveEventsByType<T extends BabyEventType>(
      type: T,
    ): Promise<BabyEventOf<T>[]> {
      const active = await this.listActiveEvents();
      return active.filter((event) => isEventOfType(event, type));
    },

    async listEventsBySyncStatus(status: SyncStatus): Promise<BabyEvent[]> {
      const all = await this.listAllEvents();
      return all.filter((event) => event.syncStatus === status);
    },

    clearAllEvents(): Promise<void> {
      records.clear();
      return Promise.resolve();
    },
  };
}
