/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { contentSecurityPolicy } from './src/app/csp.ts';

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

/**
 * Writes the Content Security Policy into the built index.html (and so into
 * 404.html). Build only: the dev server needs inline styles and its HMR socket.
 */
function contentSecurityPolicyMeta(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy() },
        injectTo: 'head-prepend',
      },
    ],
  };
}

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

export default defineConfig({
  define: {
    // Written into every project export (`app.version`).
    __APP_VERSION__: JSON.stringify(version),
  },
  // Absolute asset paths are required: 404.html is served at arbitrary nested paths.
  base: '/',
  plugins: [
    react(),
    contentSecurityPolicyMeta(),
    // Installable and offline-capable (PRD §6). Registration happens in
    // src/app/UpdatePrompt.tsx (no inline script, compatible with the CSP).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Facet Review',
        short_name: 'Facet Review',
        description: 'Systematic Reviews nach PRISMA 2020 & PRISMA-S – local-first, ohne Tracking.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1f5f6b',
        background_color: '#dde1e2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Everything the app needs offline, including the lazily loaded PDF
        // engine (~1.5 MB), the import worker and all font subsets.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,webmanifest}'],
        globIgnores: ['404.html'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // OpenAlex is never cached: every search must reach the API.
        runtimeCaching: [],
      },
    }),
    spaFallback(),
  ],
  build: {
    // Keep font files as separate local assets instead of inlining them.
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/db/**'],
      exclude: ['src/**/*.test.ts', 'src/domain/testing.ts'],
      // CLAUDE.md: counting and deduplication ≥ 90 %; applied to all domain logic.
      thresholds: {
        'src/domain/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
});
