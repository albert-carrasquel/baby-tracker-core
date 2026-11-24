/**
 * Sync module boundary (Offline-First queue and Supabase LWW reconciliation).
 * Concrete sync engine is implemented in Slice 7 (S7-T2 / S7-T3).
 */
export type SyncConnectionState = 'offline' | 'idle';

export function getInitialSyncState(isOnline: boolean): SyncConnectionState {
  return isOnline ? 'idle' : 'offline';
}
