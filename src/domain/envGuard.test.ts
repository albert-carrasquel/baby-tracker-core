import { describe, expect, it } from 'vitest';
import { assertSafeClientEnv } from './envGuard';

function makeFakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('assertSafeClientEnv', () => {
  it('accepts empty or safe anon client variables', () => {
    expect(() =>
      assertSafeClientEnv({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: makeFakeJwt({ role: 'anon' }),
        VITE_DEFAULT_BABY_ID: '00000000-0000-4000-8000-000000000000',
      }),
    ).not.toThrow();
  });

  it('rejects VITE_* variable names containing SERVICE_ROLE, SECRET, or PRIVATE', () => {
    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_SERVICE_ROLE_KEY: 'abc' }),
    ).toThrow(/SERVICE_ROLE/);

    expect(() =>
      assertSafeClientEnv({ VITE_API_SECRET: 'abc' }),
    ).toThrow(/SECRET/);

    expect(() =>
      assertSafeClientEnv({ VITE_PRIVATE_TOKEN: 'abc' }),
    ).toThrow(/PRIVATE/);
  });

  it('rejects a service_role JWT mistakenly placed in VITE_SUPABASE_ANON_KEY', () => {
    const serviceRoleJwt = makeFakeJwt({ role: 'service_role' });
    expect(() =>
      assertSafeClientEnv({ VITE_SUPABASE_ANON_KEY: serviceRoleJwt }),
    ).toThrow(/service_role/);
  });
});
