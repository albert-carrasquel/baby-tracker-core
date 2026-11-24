import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Injects hashed build asset paths into dist/sw.js so the PWA shell precaches
 * all generated JS/CSS bundles on install without extra build-time dependencies.
 */
function pwaPrecacheManifestPlugin(): Plugin {
  const generatedAssets: string[] = [];

  return {
    name: 'pwa-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      generatedAssets.length = 0;
      for (const fileName of Object.keys(bundle)) {
        generatedAssets.push(`/${fileName}`);
      }
    },
    closeBundle() {
      const swPath = resolve(import.meta.dirname, 'dist', 'sw.js');
      try {
        const swContent = readFileSync(swPath, 'utf8');
        const updated = swContent.replace(
          '[] /*__PRECACHE_ASSETS__*/',
          JSON.stringify(generatedAssets),
        );
        writeFileSync(swPath, updated, 'utf8');
      } catch {
        // Ignore if sw.js is absent in non-standard builds.
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), pwaPrecacheManifestPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
