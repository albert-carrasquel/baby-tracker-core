export interface AppMetadata {
  readonly name: string;
  readonly version: string;
  readonly offlineFirst: true;
}

export const APP_METADATA: AppMetadata = {
  name: 'Baby Tracker Core',
  version: '0.1.0',
  offlineFirst: true,
};

export function formatShellStatus(isOnline: boolean): string {
  return isOnline ? 'En linea' : 'Sin conexion (modo local)';
}
