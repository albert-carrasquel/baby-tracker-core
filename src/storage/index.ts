import type { EventStore } from './eventStore';
import {
  EVENTS_STORE_NAME,
  EVENT_INDEX_STARTED_AT,
  EVENT_INDEX_SYNC_STATUS,
  EVENT_INDEX_TYPE,
  EVENT_INDEX_UPDATED_AT,
  IndexedDbEventStore,
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  createIndexedDbEventStore,
  type IndexedDbEventStoreOptions,
} from './indexedDbEventStore';

export {
  createInMemoryEventStore,
  normalizeNewLocalEvent,
  sortEventsNewestFirst,
  type EventStore,
} from './eventStore';

export {
  EVENTS_STORE_NAME,
  EVENT_INDEX_STARTED_AT,
  EVENT_INDEX_SYNC_STATUS,
  EVENT_INDEX_TYPE,
  EVENT_INDEX_UPDATED_AT,
  IndexedDbEventStore,
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  createIndexedDbEventStore,
  type IndexedDbEventStoreOptions,
};

let defaultStoreInstance: EventStore | null = null;

/**
 * Returns the shared browser IndexedDB EventStore singleton.
 */
export function getDefaultEventStore(): EventStore {
  if (defaultStoreInstance === null) {
    defaultStoreInstance = createIndexedDbEventStore();
  }
  return defaultStoreInstance;
}
