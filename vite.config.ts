import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig, type Plugin } from 'vitest/config';
import { assertSafeClientEnv } from './src/domain/envGuard.ts';

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Enforces client env safety, injects strict CSP in production HTML, and stamps
 * deterministic cache version + hashed asset list into dist/sw.js.
 */
function securityAndPwaPlugin(): Plugin {
  const generatedAssets: string[] = [];
  let isBuild = false;

  return {
    name: 'security-and-pwa',
    configResolved(config) {
      isBuild = config.command === 'build';
      const loaded = loadEnv(config.mode, config.root, '');
      assertSafeClientEnv(loaded);
    },
    transformIndexHtml(html) {
      if (!isBuild) {
        return html;
      }
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`,
      );
    },
    generateBundle(_options, bundle) {
      generatedAssets.length = 0;
      for (const fileName of Object.keys(bundle).sort()) {
        generatedAssets.push(`/${fileName}`);
      }
    },
    closeBundle() {
      if (!isBuild) {
        return;
      }
      const swPath = resolve(import.meta.dirname, 'dist', 'sw.js');
      try {
        const swContent = readFileSync(swPath, 'utf8');
        const versionHash = createHash('sha256')
          .update(JSON.stringify(generatedAssets))
          .digest('hex')
          .slice(0, 10);

        const updated = swContent
          .replace("'dev' /*__CACHE_VERSION__*/", JSON.stringify(versionHash))
          .replace('[] /*__PRECACHE_ASSETS__*/', JSON.stringify(generatedAssets));
        writeFileSync(swPath, updated, 'utf8');
      } catch {
        // Ignore if sw.js is absent in non-standard builds.
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), securityAndPwaPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
