import { describe, expect, it } from 'vitest';
import { createBabyEvent, createDiaperEvent, type BabyEvent } from '../domain/babyEvent';
import {
  EVENTS_STORE_NAME,
  EVENT_INDEX_STARTED_AT,
  EVENT_INDEX_SYNC_STATUS,
  EVENT_INDEX_TYPE,
  EVENT_INDEX_UPDATED_AT,
  createIndexedDbEventStore,
  createInMemoryEventStore,
} from './index';

/* ------------------------------------------------------------------ */
/*  Minimal zero-dependency IDBFactory test double                    */
/*  Persists data across open/close cycles to simulate app reloads.   */
/* ------------------------------------------------------------------ */

interface FakeStoreMeta {
  readonly keyPath: string;
  readonly indexes: Map<string, string>;
  readonly records: Map<string, Record<string, unknown>>;
}

interface FakeDatabaseData {
  version: number;
  readonly stores: Map<string, FakeStoreMeta>;
}

function createFakeIdbFactory() {
  const databases = new Map<string, FakeDatabaseData>();

  function makeRequest<T>(executor: () => T, onDone?: () => void): IDBRequest<T> {
    const req = {
      result: undefined as unknown as T,
      error: null as DOMException | null,
      onsuccess: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
      onerror: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
    } as IDBRequest<T>;

    queueMicrotask(() => {
      try {
        (req as { result: T }).result = executor();
        req.onsuccess?.call(req, new Event('success'));
        onDone?.();
      } catch (err) {
        (req as { error: DOMException }).error = err as DOMException;
        req.onerror?.call(req, new Event('error'));
      }
    });

    return req;
  }

  const factory = {
    open(name: string, version = 1): IDBOpenDBRequest {
      const openReq = {
        result: undefined as unknown as IDBDatabase,
        error: null as DOMException | null,
        onsuccess: null as ((this: IDBRequest<IDBDatabase>, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBRequest<IDBDatabase>, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
      } as IDBOpenDBRequest;

      queueMicrotask(() => {
        let dbData = databases.get(name);
        const isUpgrade = !dbData || dbData.version < version;
        if (!dbData) {
          dbData = { version, stores: new Map() };
          databases.set(name, dbData);
        } else if (isUpgrade) {
          dbData.version = version;
        }

        const currentDbData = dbData;

        const db = {
          name,
          version: currentDbData.version,
          onversionchange: null as (() => void) | null,
          objectStoreNames: {
            contains: (storeName: string) => currentDbData.stores.has(storeName),
          } as DOMStringList,
          createObjectStore(storeName: string, opts?: IDBObjectStoreParameters) {
            const meta: FakeStoreMeta = {
              keyPath: typeof opts?.keyPath === 'string' ? opts.keyPath : 'id',
              indexes: new Map(),
              records: new Map(),
            };
            currentDbData.stores.set(storeName, meta);
            return {
              createIndex(indexName: string, keyPath: string) {
                meta.indexes.set(indexName, keyPath);
                return {} as IDBIndex;
              },
            } as IDBObjectStore;
          },
          transaction(storeName: string) {
            const meta = currentDbData.stores.get(storeName);
            if (!meta) {
              throw new Error(`Missing object store "${storeName}".`);
            }
            const tx = {
              error: null as DOMException | null,
              oncomplete: null as ((ev: Event) => void) | null,
              onerror: null as ((ev: Event) => void) | null,
              onabort: null as ((ev: Event) => void) | null,
              objectStore() {
                return {
                  put(value: Record<string, unknown>) {
                    return makeRequest(
                      () => {
                        const key = String(value[meta.keyPath]);
                        meta.records.set(key, structuredClone(value));
                        return key;
                      },
                      () => queueMicrotask(() => tx.oncomplete?.(new Event('complete'))),
                    );
                  },
                  get(key: string) {
                    return makeRequest(() => {
                      const found = meta.records.get(key);
                      return found ? structuredClone(found) : undefined;
                    });
                  },
                  getAll() {
                    return makeRequest(() =>
                      Array.from(meta.records.values(), (v) => structuredClone(v)),
                    );
                  },
                  clear() {
                    return makeRequest(
                      () => {
                        meta.records.clear();
                        return undefined;
                      },
                      () => queueMicrotask(() => tx.oncomplete?.(new Event('complete'))),
                    );
                  },
                  index(indexName: string) {
                    const field = meta.indexes.get(indexName);
                    if (!field) {
                      throw new Error(`Missing index "${indexName}".`);
                    }
                    return {
                      getAll(queryValue?: unknown) {
                        return makeRequest(() => {
                          const all = Array.from(meta.records.values());
                          const matched =
                            queryValue === undefined
                              ? all
                              : all.filter((rec) => rec[field] === queryValue);
                          return matched.map((v) => structuredClone(v));
                        });
                      },
                    } as IDBIndex;
                  },
                } as unknown as IDBObjectStore;
              },
            } as unknown as IDBTransaction;
            return tx;
          },
          close() {
            // Connection closed; underlying `databases` map persists like disk.
          },
        } as unknown as IDBDatabase;

        (openReq as { result: IDBDatabase }).result = db;
        if (isUpgrade) {
          openReq.onupgradeneeded?.call(
            openReq,
            new Event('upgradeneeded') as IDBVersionChangeEvent,
          );
        }
        openReq.onsuccess?.call(openReq, new Event('success'));
      });

      return openReq;
    },

    inspectIndexes(dbName: string, storeName: string): string[] {
      const store = databases.get(dbName)?.stores.get(storeName);
      return store ? Array.from(store.indexes.keys()) : [];
    },

    injectRawRecord(
      dbName: string,
      storeName: string,
      key: string,
      raw: Record<string, unknown>,
    ): void {
      databases.get(dbName)?.stores.get(storeName)?.records.set(key, raw);
    },
  };

  return factory as unknown as IDBFactory & {
    inspectIndexes(dbName: string, storeName: string): string[];
    injectRawRecord(
      dbName: string,
      storeName: string,
      key: string,
      raw: Record<string, unknown>,
    ): void;
  };
}

describe('IndexedDbEventStore & EventStore (S2-T2 / CA-2)', () => {
  it('creates events store with startedAt, type, syncStatus, and updatedAt indexes', async () => {
    const idb = createFakeIdbFactory();
    const store = createIndexedDbEventStore({
      idbFactory: idb,
      dbName: 'test-schema-db',
    });

    await store.listAllEvents();

    expect(idb.inspectIndexes('test-schema-db', EVENTS_STORE_NAME)).toEqual([
      EVENT_INDEX_STARTED_AT,
      EVENT_INDEX_TYPE,
      EVENT_INDEX_SYNC_STATUS,
      EVENT_INDEX_UPDATED_AT,
    ]);
  });

  it('saves offline events with deletedAt: null and syncStatus: pending, surviving close/reload', async () => {
    const idb = createFakeIdbFactory();
    const firstSession = createIndexedDbEventStore({
      idbFactory: idb,
      dbName: 'test-reload-db',
    });

    const older = createDiaperEvent({
      diaperKind: 'pee',
      startedAt: '2026-11-25T12:00:00.000Z',
      now: new Date('2026-11-25T12:00:00.000Z'),
    });
    const newer = createDiaperEvent({
      diaperKind: 'both',
      note: 'cambio nocturno',
      startedAt: '2026-11-25T14:30:00.000Z',
      now: new Date('2026-11-25T14:30:00.000Z'),
    });

    // Even if caller passes 'synced', saveNewEvent enforces local 'pending'.
    const saved = await firstSession.saveNewEvent({
      ...older,
      syncStatus: 'synced',
    });
    expect(saved.syncStatus).toBe('pending');
    expect(saved.deletedAt).toBeNull();

    await firstSession.saveNewEvent(newer);
    await firstSession.close();

    // Simulate app reopen on a fresh store instance backed by the same IndexedDB.
    const reopenedSession = createIndexedDbEventStore({
      idbFactory: idb,
      dbName: 'test-reload-db',
    });

    const reloaded = await reopenedSession.listActiveEvents();
    expect(reloaded.map((e) => e.id)).toEqual([newer.id, older.id]);
    expect(reloaded.every((e) => e.syncStatus === 'pending')).toBe(true);

    const byId = await reopenedSession.getEventById(newer.id);
    expect(byId?.payload).toEqual({
      diaperKind: 'both',
      note: 'cambio nocturno',
    });
  });

  it('queries by type and syncStatus, and excludes soft-deleted events from active lists', async () => {
    const idb = createFakeIdbFactory();
    const store = createIndexedDbEventStore({
      idbFactory: idb,
      dbName: 'test-queries-db',
    });

    const diaper = createDiaperEvent({
      diaperKind: 'poo',
      startedAt: '2026-11-25T10:00:00.000Z',
      now: new Date('2026-11-25T10:00:00.000Z'),
    });
    const note = createBabyEvent({
      type: 'note',
      payload: { text: 'Dormio tranquilo' },
      startedAt: '2026-11-25T11:00:00.000Z',
      now: new Date('2026-11-25T11:00:00.000Z'),
    });

    await store.saveNewEvent(diaper);
    await store.saveNewEvent(note);

    // Simulate soft-delete via putEvent (as Slice 3 will do) and synced status.
    await store.putEvent({
      ...diaper,
      deletedAt: '2026-11-25T11:05:00.000Z',
      updatedAt: '2026-11-25T11:05:00.000Z',
      syncStatus: 'synced',
    });

    expect((await store.listAllEvents()).length).toBe(2);
    expect((await store.listActiveEvents()).map((e) => e.id)).toEqual([note.id]);
    expect(await store.listActiveEventsByType('diaper')).toEqual([]);
    expect((await store.listActiveEventsByType('note')).map((e) => e.id)).toEqual([
      note.id,
    ]);
    expect((await store.listEventsBySyncStatus('pending')).map((e) => e.id)).toEqual([
      note.id,
    ]);
    expect((await store.listEventsBySyncStatus('synced')).map((e) => e.id)).toEqual([
      diaper.id,
    ]);
  });

  it('rejects invalid writes and safely ignores tampered records on read', async () => {
    const idb = createFakeIdbFactory();
    const store = createIndexedDbEventStore({
      idbFactory: idb,
      dbName: 'test-security-db',
    });

    const valid = createDiaperEvent({
      diaperKind: 'pee',
      now: new Date('2026-11-25T15:00:00.000Z'),
    });
    await store.saveNewEvent(valid);

    // Reject saveNewEvent if deletedAt is already set.
    await expect(
      store.saveNewEvent({
        ...valid,
        deletedAt: '2026-11-25T15:01:00.000Z',
      }),
    ).rejects.toThrow(/deletedAt/);

    // Reject invalid payload on putEvent.
    await expect(
      store.putEvent({
        ...valid,
        payload: { diaperKind: 'invalid' as 'pee' },
      } as BabyEvent),
    ).rejects.toThrow();

    // Tampered record injected directly into IDB is ignored on read.
    idb.injectRawRecord('test-security-db', EVENTS_STORE_NAME, 'tampered-id', {
      id: 'tampered-id',
      type: 'diaper',
      payload: { diaperKind: 'pee' },
      startedAt: 'invalid-date',
    });

    expect(await store.getEventById('tampered-id')).toBeNull();
    expect((await store.listAllEvents()).map((e) => e.id)).toEqual([valid.id]);

    await store.clearAllEvents();
    expect(await store.listAllEvents()).toEqual([]);
  });

  it('keeps parity in createInMemoryEventStore', async () => {
    const mem = createInMemoryEventStore();
    const diaper = createDiaperEvent({
      diaperKind: 'pee',
      now: new Date('2026-11-25T15:00:00.000Z'),
    });
    await mem.saveNewEvent(diaper);
    expect((await mem.listActiveEvents()).map((e) => e.id)).toEqual([diaper.id]);
    await mem.clearAllEvents();
    expect(await mem.listAllEvents()).toEqual([]);
  });
});
