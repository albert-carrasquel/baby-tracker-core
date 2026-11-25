const ISO_UTC_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * Returns a strict ISO-8601 UTC timestamp string (ending in 'Z').
 */
export function nowIsoUtc(date: Date = new Date()): string {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) {
    throw new Error('Invalid Date instance passed to nowIsoUtc.');
  }
  return date.toISOString();
}

/**
 * Validates that a value is a canonical ISO-8601 UTC timestamp ('...Z')
 * representing a real calendar instant.
 */
export function isValidIsoUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_UTC_REGEX.test(value)) {
    return false;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return false;
  }
  // Guard against rolled-over calendar dates such as 2026-02-31T00:00:00Z.
  const canonicalPrefix = new Date(ms).toISOString().slice(0, 19);
  return value.slice(0, 19) === canonicalPrefix;
}

/**
 * Converts an ISO timestamp into a 'YYYY-MM-DD' calendar key in the device's
 * local timezone (or an explicit IANA timezone for deterministic testing).
 */
export function toLocalDateKey(
  isoTimestamp: string,
  timeZone?: string,
): string {
  const ms = Date.parse(isoTimestamp);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp "${isoTimestamp}".`);
  }

  const date = new Date(ms);
  if (timeZone === undefined) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date parts for timezone "${timeZone}".`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Formats relative elapsed time since `startedAtIso` in concise Spanish
 * suitable for compact 360px mobile status cards (e.g. "recién", "hace 12 min",
 * "hace 2 h 15 min", "hace 1 d 3 h").
 */
export function formatElapsedSince(
  startedAtIso: string,
  nowMs: number = Date.now(),
): string {
  const startMs = Date.parse(startedAtIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) {
    throw new Error('Invalid timestamp passed to formatElapsedSince.');
  }

  const diffMs = Math.max(0, nowMs - startMs);
  const totalMinutes = Math.floor(diffMs / 60_000);

  if (totalMinutes < 1) {
    return 'recién';
  }

  if (totalMinutes < 60) {
    return `hace ${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;

  if (totalHours < 24) {
    return remMinutes === 0
      ? `hace ${totalHours} h`
      : `hace ${totalHours} h ${remMinutes} min`;
  }

  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  return remHours === 0 ? `hace ${days} d` : `hace ${days} d ${remHours} h`;
}
