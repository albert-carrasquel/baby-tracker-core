const FORBIDDEN_VITE_KEY_PATTERNS = ['SERVICE_ROLE', 'SECRET', 'PRIVATE'] as const;

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Prevents accidental exposure of server-only secrets or Supabase service_role
 * keys through client-exposed VITE_* environment variables.
 */
export function assertSafeClientEnv(
  env: Readonly<Record<string, string | undefined>>,
): void {
  for (const key of Object.keys(env)) {
    if (!key.startsWith('VITE_')) {
      continue;
    }

    const upperKey = key.toUpperCase();
    for (const pattern of FORBIDDEN_VITE_KEY_PATTERNS) {
      if (upperKey.includes(pattern)) {
        throw new Error(
          `Unsafe client environment variable "${key}": VITE_* variables are bundled into the browser and must never contain ${pattern}.`,
        );
      }
    }
  }

  const anonKey = env['VITE_SUPABASE_ANON_KEY'];
  if (anonKey && anonKey.trim() !== '') {
    const parts = anonKey.trim().split('.');
    const payloadSegment = parts[1];
    if (parts.length === 3 && payloadSegment !== undefined) {
      const payload = decodeBase64UrlJson(payloadSegment);
      if (payload?.['role'] === 'service_role') {
        throw new Error(
          'Security violation: VITE_SUPABASE_ANON_KEY contains a Supabase "service_role" token, which bypasses Row Level Security.',
        );
      }
    }
  }
}
