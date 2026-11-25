import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig, type Plugin } from 'vitest/config';
import {
  assertSafeClientEnv,
  getScopedSupabaseConnectOrigins,
} from './src/domain/envGuard.ts';

function buildProductionCsp(connectOrigins: readonly string[]): string {
  const connectSrc = ["'self'", ...connectOrigins].join(' ');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function readOptionalDistFile(distDir: string, fileName: string): string {
  try {
    return readFileSync(resolve(distDir, fileName), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Enforces client env safety, injects origin-scoped CSP in production HTML,
 * and stamps a full shell + asset content hash into dist/sw.js.
 */
function securityAndPwaPlugin(): Plugin {
  const generatedAssets: string[] = [];
  let isBuild = false;
  let productionCsp = buildProductionCsp([]);

  return {
    name: 'security-and-pwa',
    configResolved(config) {
      isBuild = config.command === 'build';
      const loaded = loadEnv(config.mode, config.root, '');
      assertSafeClientEnv(loaded);
      productionCsp = buildProductionCsp(getScopedSupabaseConnectOrigins(loaded));
    },
    transformIndexHtml(html) {
      if (!isBuild) {
        return html;
      }
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${productionCsp}" />`,
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
      const distDir = resolve(import.meta.dirname, 'dist');
      const swPath = resolve(distDir, 'sw.js');
      try {
        const swContent = readFileSync(swPath, 'utf8');
        const hash = createHash('sha256');
        hash.update(JSON.stringify(generatedAssets));
        hash.update(readOptionalDistFile(distDir, 'index.html'));
        hash.update(readOptionalDistFile(distDir, 'theme-init.js'));
        hash.update(readOptionalDistFile(distDir, 'manifest.webmanifest'));
        const versionHash = hash.digest('hex').slice(0, 10);

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
