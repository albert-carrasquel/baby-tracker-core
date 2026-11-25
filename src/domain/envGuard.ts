const FORBIDDEN_VITE_KEY_PATTERNS = [
  'SERVICE_ROLE',
  'SECRET',
  'PRIVATE',
  'PASSWORD',
] as const;

const FORBIDDEN_VALUE_PREFIXES = [
  { prefix: 'sb_secret_', label: 'Supabase secret key (sb_secret_*)' },
  { prefix: 'sbp_', label: 'Supabase personal access token (sbp_*)' },
  { prefix: 'postgres://', label: 'PostgreSQL connection URI' },
  { prefix: 'postgresql://', label: 'PostgreSQL connection URI' },
  { prefix: '-----BEGIN', label: 'PEM private key' },
] as const;

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

function isServiceRoleJwt(value: string): boolean {
  const parts = value.split('.');
  const payloadSegment = parts[1];
  if (parts.length !== 3 || payloadSegment === undefined) {
    return false;
  }
  const payload = decodeBase64UrlJson(payloadSegment);
  return payload?.['role'] === 'service_role';
}

function isLocalhostHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Validates all client-exposed VITE_* variables so server secrets, Supabase
 * privileged keys (legacy service_role JWT or modern sb_secret_*), DB URIs,
 * or non-HTTPS remote endpoints can never be bundled into the client.
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

    const rawValue = env[key]?.trim() ?? '';
    if (rawValue === '') {
      continue;
    }

    for (const forbidden of FORBIDDEN_VALUE_PREFIXES) {
      if (rawValue.startsWith(forbidden.prefix)) {
        throw new Error(
          `Security violation in "${key}": detected ${forbidden.label}, which must never be exposed in client env.`,
        );
      }
    }

    if (isServiceRoleJwt(rawValue)) {
      throw new Error(
        `Security violation in "${key}": detected a Supabase "service_role" JWT, which bypasses Row Level Security.`,
      );
    }
  }

  const supabaseUrl = env['VITE_SUPABASE_URL']?.trim() ?? '';
  if (supabaseUrl !== '') {
    let parsed: URL;
    try {
      parsed = new URL(supabaseUrl);
    } catch {
      throw new Error(
        'Invalid VITE_SUPABASE_URL: must be a valid URL (e.g. https://<project-ref>.supabase.co).',
      );
    }

    const isAllowedHttpLocal =
      parsed.protocol === 'http:' && isLocalhostHost(parsed.hostname);

    if (parsed.protocol !== 'https:' && !isAllowedHttpLocal) {
      throw new Error(
        'Insecure VITE_SUPABASE_URL: HTTPS is required for remote Supabase endpoints.',
      );
    }
  }
}

/**
 * Extracts exact HTTP and WebSocket origins for CSP connect-src scoping so the
 * browser can only connect to the configured Supabase project (not *.supabase.co).
 */
export function getScopedSupabaseConnectOrigins(
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  assertSafeClientEnv(env);
  const supabaseUrl = env['VITE_SUPABASE_URL']?.trim() ?? '';
  if (supabaseUrl === '') {
    return [];
  }

  const parsed = new URL(supabaseUrl);
  const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return [`${parsed.protocol}//${parsed.host}`, `${wsProtocol}//${parsed.host}`];
}
