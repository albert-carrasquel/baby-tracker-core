import { useEffect, useState } from 'react';
import { APP_METADATA, formatShellStatus } from '../domain/appInfo';
import { LOCAL_DB_NAME } from '../storage';
import { getInitialSyncState } from '../sync';

export function App() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncState = getInitialSyncState(isOnline);

  return (
    <main data-sync-state={syncState} data-storage={LOCAL_DB_NAME}>
      <h1>{APP_METADATA.name}</h1>
      <p>{formatShellStatus(isOnline)}</p>
    </main>
  );
}
