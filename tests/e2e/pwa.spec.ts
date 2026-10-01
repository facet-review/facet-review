/// <reference lib="dom" />
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/** PRD §6: installable, usable offline except the OpenAlex search, updates announced. */
test.use({ serviceWorkers: 'allow' });

const SW_FILE = resolve(import.meta.dirname, '../../dist/sw.js');

/** Opens the app and waits until the service worker controls the page. */
async function installed(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Facet Review ist jetzt auch offline nutzbar')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first page load is not controlled yet; the next one is.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
}

test('is installable: manifest with name, icons and colours', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = await page.evaluate(async (url) => (await fetch(url)).json(), href!);
  expect(manifest).toMatchObject({
    name: 'Facet Review',
    start_url: '/',
    display: 'standalone',
    theme_color: '#1f5f6b',
    background_color: '#dde1e2',
  });
  const icons = (manifest as { icons: { src: string; sizes: string; purpose?: string }[] }).icons;
  expect(icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']) as unknown as string[],
  );
  expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of icons) {
    const status = await page.evaluate(async (src) => (await fetch(src)).status, icon.src);
    expect(status, icon.src).toBe(200);
  }
});

test('works offline after the first visit, except the OpenAlex search', async ({
  page,
  context,
}) => {
  await installed(page);
  await page.getByRole('link', { name: 'Neues Projekt' }).first().click();
  await page.getByLabel('Titel des Reviews').fill('Offline-Projekt');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projekt', exact: true })).toBeVisible();
  const projectUrl = new URL(page.url());

  await goOffline(context);
  // Reload and a deep link are answered by the service worker.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Projekt', exact: true })).toBeVisible();
  await page.goto(projectUrl.pathname.replace(/project$/, 'screening'));
  await expect(page.getByRole('heading', { level: 1, name: 'Screening' })).toBeVisible();

  // The lazily loaded PDF engine is precached as well.
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Checkliste' })
    .click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Checkliste als PDF exportieren' }).click(),
  ]);
  expect((await readFile(await download.path())).subarray(0, 5).toString()).toBe('%PDF-');

  await page.goto(projectUrl.pathname.replace(/project$/, 'search/openalex'));
  await expect(page.getByText('Die OpenAlex-Suche braucht eine Internetverbindung.')).toBeVisible();
  await context.setOffline(false);
});

test('announces a new version instead of reloading unasked', async ({ page }) => {
  await installed(page);
  // Simulate a deploy: the served service worker changes (same length, so the
  // preview server's cached file size stays valid). Restored afterwards.
  const original = await readFile(SW_FILE, 'utf8');
  const changed = original.replace(/revision:"([0-9a-f])/, (_match, digit: string) => {
    return `revision:"${digit === '0' ? '1' : '0'}`;
  });
  expect(changed).not.toBe(original);
  try {
    await writeFile(SW_FILE, changed);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    const banner = page.getByRole('status').filter({ hasText: 'Eine neue Version' });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner.getByRole('button', { name: 'Jetzt neu laden' })).toBeVisible();
    await banner.getByRole('button', { name: 'Später' }).click();
    await expect(page.getByText('Eine neue Version')).toBeHidden();
  } finally {
    await writeFile(SW_FILE, original);
  }
});
