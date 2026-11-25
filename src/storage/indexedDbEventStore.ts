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
import {
  normalizeNewLocalEvent,
  sortEventsNewestFirst,
  type EventStore,
} from './eventStore';

export const LOCAL_DB_NAME = 'baby-tracker-core-db';
export const LOCAL_DB_VERSION = 1;
export const EVENTS_STORE_NAME = 'events';

export const EVENT_INDEX_STARTED_AT = 'by_startedAt';
export const EVENT_INDEX_TYPE = 'by_type';
export const EVENT_INDEX_SYNC_STATUS = 'by_syncStatus';
export const EVENT_INDEX_UPDATED_AT = 'by_updatedAt';

export interface IndexedDbEventStoreOptions {
  readonly idbFactory?: IDBFactory;
  readonly dbName?: string;
}

function openEventsDatabase(
  idbFactory: IDBFactory,
  dbName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idbFactory.open(dbName, LOCAL_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE_NAME)) {
        const store = db.createObjectStore(EVENTS_STORE_NAME, {
          keyPath: 'id',
        });
        store.createIndex(EVENT_INDEX_STARTED_AT, 'startedAt', {
          unique: false,
        });
        store.createIndex(EVENT_INDEX_TYPE, 'type', {
          unique: false,
        });
        store.createIndex(EVENT_INDEX_SYNC_STATUS, 'syncStatus', {
          unique: false,
        });
        store.createIndex(EVENT_INDEX_UPDATED_AT, 'updatedAt', {
          unique: false,
        });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(
        request.error ?? new Error(`Failed to open IndexedDB "${dbName}".`),
      );
    };

    request.onblocked = () => {
      reject(new Error(`IndexedDB "${dbName}" upgrade is blocked.`));
    };
  });
}

function filterValidEvents(rawRecords: readonly unknown[]): BabyEvent[] {
  const valid: BabyEvent[] = [];
  for (const item of rawRecords) {
    if (isValidBabyEvent(item)) {
      valid.push(item);
    }
  }
  return sortEventsNewestFirst(valid);
}

/**
 * Native browser IndexedDB EventStore with zero third-party dependencies.
 * Guarantees write durability by awaiting `transaction.oncomplete` and
 * validates every record on both write and read.
 */
export class IndexedDbEventStore implements EventStore {
  private readonly idbFactory: IDBFactory;
  private readonly dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  public constructor(options: IndexedDbEventStoreOptions = {}) {
    const factory = options.idbFactory ?? globalThis.indexedDB;
    if (!factory) {
      throw new Error('Native IndexedDB is unavailable in this environment.');
    }
    this.idbFactory = factory;
    this.dbName = options.dbName ?? LOCAL_DB_NAME;
  }

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise === null) {
      this.dbPromise = openEventsDatabase(this.idbFactory, this.dbName).catch(
        (err: unknown) => {
          this.dbPromise = null;
          throw err;
        },
      );
    }
    return this.dbPromise;
  }

  public async close(): Promise<void> {
    if (this.dbPromise !== null) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }

  public async saveNewEvent<T extends BabyEvent>(event: T): Promise<T> {
    const normalized = normalizeNewLocalEvent(event);
    await this.writeRecord(normalized);
    return normalized;
  }

  public async putEvent<T extends BabyEvent>(event: T): Promise<T> {
    validateBabyEvent(event);
    await this.writeRecord(event);
    return event;
  }

  private async writeRecord(event: BabyEvent): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const request = store.put(event);

      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB put request failed.'));
      };
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(tx.error ?? new Error('IndexedDB write transaction failed.'));
      };
      tx.onabort = () => {
        reject(tx.error ?? new Error('IndexedDB write transaction aborted.'));
      };
    });
  }

  public async getEventById(id: string): Promise<BabyEvent | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result: unknown = request.result;
        resolve(isValidBabyEvent(result) ? result : null);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB get request failed.'));
      };
    });
  }

  public async listAllEvents(): Promise<BabyEvent[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const rows = Array.isArray(request.result) ? request.result : [];
        resolve(filterValidEvents(rows));
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB getAll request failed.'));
      };
    });
  }

  public async listActiveEvents(): Promise<BabyEvent[]> {
    const all = await this.listAllEvents();
    return all.filter(isActiveEvent);
  }

  public async listActiveEventsByType<T extends BabyEventType>(
    type: T,
  ): Promise<BabyEventOf<T>[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const index = store.index(EVENT_INDEX_TYPE);
      const request = index.getAll(type);

      request.onsuccess = () => {
        const rows = Array.isArray(request.result) ? request.result : [];
        const valid = filterValidEvents(rows).filter(
          (event): event is BabyEventOf<T> =>
            isActiveEvent(event) && isEventOfType(event, type),
        );
        resolve(valid);
      };
      request.onerror = () => {
        reject(
          request.error ?? new Error('IndexedDB type index query failed.'),
        );
      };
    });
  }

  public async listEventsBySyncStatus(
    status: SyncStatus,
  ): Promise<BabyEvent[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const index = store.index(EVENT_INDEX_SYNC_STATUS);
      const request = index.getAll(status);

      request.onsuccess = () => {
        const rows = Array.isArray(request.result) ? request.result : [];
        resolve(filterValidEvents(rows));
      };
      request.onerror = () => {
        reject(
          request.error ??
            new Error('IndexedDB syncStatus index query failed.'),
        );
      };
    });
  }

  public async clearAllEvents(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB clear request failed.'));
      };
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(tx.error ?? new Error('IndexedDB clear transaction failed.'));
      };
      tx.onabort = () => {
        reject(tx.error ?? new Error('IndexedDB clear transaction aborted.'));
      };
    });
  }
}

export function createIndexedDbEventStore(
  options?: IndexedDbEventStoreOptions,
): IndexedDbEventStore {
  return new IndexedDbEventStore(options);
}
