/// <reference types="vitest/config" />
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves 404.html for unknown paths. A copy of index.html lets the
 * client-side router handle deep links such as /projects/:id on direct load and reload.
 */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  // Absolute asset paths are required: 404.html is served at arbitrary nested paths.
  base: '/',
  plugins: [react(), spaFallback()],
  build: {
    // Keep font files as separate local assets instead of inlining them.
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/i18n/**'],
    },
  },
});
