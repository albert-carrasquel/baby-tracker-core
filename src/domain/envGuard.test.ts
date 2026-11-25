import { describe, expect, it } from 'vitest';
import {
  assertSafeClientEnv,
  getScopedSupabaseConnectOrigins,
} from './envGuard';

function makeFakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('assertSafeClientEnv & CSP origin scoping', () => {
  it('accepts empty or safe publishable/anon client variables', () => {
    expect(() =>
      assertSafeClientEnv({
        VITE_SUPABASE_URL: 'https://projectref.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_safe_key_example',
        VITE_DEFAULT_BABY_ID: '00000000-0000-4000-8000-000000000000',
      }),
    ).not.toThrow();

    expect(() =>
      assertSafeClientEnv({
        VITE_SUPABASE_URL: 'https://projectref.supabase.co',
        VITE_SUPABASE_ANON_KEY: makeFakeJwt({ role: 'anon' }),
      }),
    ).not.toThrow();
  });

  it('rejects VITE_* variable names containing SERVICE_ROLE, SECRET, PRIVATE, or PASSWORD', () => {
    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_SERVICE_ROLE_KEY: 'abc' }),
    ).toThrow(/SERVICE_ROLE/);
    expect(() =>
      assertSafeClientEnv({ VITE_API_SECRET: 'abc' }),
    ).toThrow(/SECRET/);
    expect(() =>
      assertSafeClientEnv({ VITE_PRIVATE_TOKEN: 'abc' }),
    ).toThrow(/PRIVATE/);
    expect(() =>
      assertSafeClientEnv({ VITE_DB_PASSWORD: 'abc' }),
    ).toThrow(/PASSWORD/);
  });

  it('rejects modern sb_secret_*, sbp_*, DB URIs, PEM keys, and service_role JWTs in any VITE_* value', () => {
    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_ANON_KEY: 'sb_secret_123456' }),
    ).toThrow(/sb_secret_/);

    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_ANON_KEY: 'sbp_token_123456' }),
    ).toThrow(/sbp_/);

    expect(() =>
      assertSafeClientEnv({
        VITE_CUSTOM_ENDPOINT: 'postgresql://postgres:pass@db.example.com:5432/postgres',
      }),
    ).toThrow(/PostgreSQL/);

    expect(() =>
      assertSafeClientEnv({
        VITE_KEY: '-----BEGIN PRIVATE KEY-----\nabc',
      }),
    ).toThrow(/PEM/);

    expect(() =>
      assertSafeClientEnv({
        VITE_ANY_VAR: makeFakeJwt({ role: 'service_role' }),
      }),
    ).toThrow(/service_role/);
  });

  it('enforces HTTPS for remote VITE_SUPABASE_URL while allowing localhost HTTP', () => {
    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_URL: 'http://projectref.supabase.co' }),
    ).toThrow(/HTTPS/);

    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_URL: 'not-a-url' }),
    ).toThrow(/Invalid VITE_SUPABASE_URL/);

    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_URL: 'http://localhost:54321' }),
    ).not.toThrow();
  });

  it('derives exact connect-src origins without wildcard *.supabase.co', () => {
    expect(getScopedSupabaseConnectOrigins({})).toEqual([]);
    expect(
      getScopedSupabaseConnectOrigins({
        VITE_SUPABASE_URL: 'https://myref.supabase.co/rest/v1',
      }),
    ).toEqual(['https://myref.supabase.co', 'wss://myref.supabase.co']);
  });
});
