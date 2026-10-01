/// <reference lib="dom" />
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { setUpScreening } from './helpers';

/**
 * PRD §6: the Content Security Policy enforces "no data leaves the browser
 * except to OpenAlex". These tests run against the production build.
 */

/** Collects CSP violations reported by the page (from the first script on). */
async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = store;
    document.addEventListener('securitypolicyviolation', (event) => {
      store.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

test('the built page carries the policy', async ({ page }) => {
  await page.goto('/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("connect-src 'self' https://api.openalex.org;");
});

test('blocks connections to any other host', async ({ page }) => {
  const violations = await watchViolations(page);
  await page.goto('/');
  const attempts = await page.evaluate(async () => {
    const outcome = async (attempt: () => Promise<unknown>) =>
      attempt().then(
        () => 'allowed',
        () => 'blocked',
      );
    return {
      fetch: await outcome(() => fetch('https://example.org/collect')),
      // sendBeacon only queues; whether it was blocked shows in the violations below.
      beacon: String(navigator.sendBeacon('https://example.org/beacon', 'x')),
      image: await outcome(
        () =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = resolve;
            image.onerror = reject;
            image.src = 'https://example.org/pixel.png';
          }),
      ),
      script: await outcome(
        () =>
          new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.onload = resolve;
            script.onerror = reject;
            script.src = 'https://example.org/tracker.js';
            document.head.append(script);
          }),
      ),
    };
  });
  expect(attempts).toEqual({
    fetch: 'blocked',
    beacon: 'true',
    image: 'blocked',
    script: 'blocked',
  });
  await expect
    .poll(violations)
    .toEqual(
      expect.arrayContaining([
        'connect-src https://example.org/collect',
        'connect-src https://example.org/beacon',
        'script-src-elem https://example.org/tracker.js',
      ]) as unknown as string[],
    );
});

test('allows the OpenAlex API', async ({ page }) => {
  await page.route('https://api.openalex.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '{"meta":{"count":0},"results":[]}',
    }),
  );
  await page.goto('/');
  const status = await page.evaluate(() =>
    fetch('https://api.openalex.org/works?per-page=1').then((response) => response.status),
  );
  expect(status).toBe(200);
});

async function download(page: Page, button: string) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ]);
  return readFile(await file.path());
}

test('every module and export works within the policy, without any foreign request', async ({
  page,
}) => {
  const violations = await watchViolations(page);
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.host !== 'localhost:4173') foreign.push(url.href);
  });

  await setUpScreening(page);
  const nav = page.getByRole('navigation', { name: 'Module' });
  for (const name of ['Projekt', 'Suche', 'Import', 'Screening', 'Checkliste']) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await download(page, 'Checkliste als PDF exportieren');

  await nav.getByRole('link', { name: 'Flow-Diagramm' }).click();
  expect((await download(page, 'Als SVG exportieren')).toString('utf8')).toContain('<svg');
  expect((await download(page, 'Als PNG exportieren')).subarray(1, 4).toString()).toBe('PNG');
  await download(page, 'Zahlen als CSV exportieren');

  await nav.getByRole('link', { name: 'Exporte' }).click();
  expect((await download(page, 'Suchanhang als PDF')).subarray(0, 5).toString()).toBe('%PDF-');
  await download(page, 'Suchanhang als Markdown');
  await download(page, 'Alle Datensätze als CSV');
  await download(page, 'Projekt als JSON exportieren');

  // The only violation: the PDF engine first tries to fetch() its WebAssembly
  // from an embedded data: URL; the policy blocks that and it decodes the
  // same bytes in memory instead (nothing leaves the browser either way).
  expect((await violations()).filter((entry) => entry !== 'connect-src data')).toEqual([]);
  expect(foreign).toEqual([]);
});
