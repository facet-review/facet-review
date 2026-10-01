// Renders the PWA icons from the logo geometry (public/favicon.svg) with
// Playwright's Chromium – no image library needed. Run once after a logo change:
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/generate-icons.mjs
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const PUBLIC = resolve(import.meta.dirname, '../public');
const logo = await readFile(resolve(PUBLIC, 'favicon.svg'), 'utf8');
const STONE = '#dde1e2';

// [file, size, share of the canvas the prism uses]; maskable icons keep the
// prism inside the 80 % safe zone.
const ICONS = [
  ['icons/icon-192.png', 192, 0.84],
  ['icons/icon-512.png', 512, 0.84],
  ['icons/maskable-512.png', 512, 0.62],
  ['icons/apple-touch-icon.png', 180, 0.72],
];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {},
);
const page = await browser.newPage();
for (const [file, size, share] of ICONS) {
  const inner = Math.round(size * share);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${STONE}">` +
      logo.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
      '</body>',
  );
  await page.screenshot({ path: resolve(PUBLIC, file), omitBackground: false });
  console.log(`${file} (${size}×${size})`);
}
await browser.close();
