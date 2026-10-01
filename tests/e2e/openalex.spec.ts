import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * OpenAlex search against recorded answers (tests/fixtures/openalex). Every
 * request to api.openalex.org is answered here – there are no live requests.
 */
const FIXTURES = resolve(import.meta.dirname, '../fixtures/openalex');
const fixture = (name: string) => readFile(resolve(FIXTURES, name), 'utf8');

async function answer(route: Route) {
  const params = new URL(route.request().url()).searchParams;
  const cursor = params.get('cursor');
  const name = cursor === null ? 'count.json' : cursor === '*' ? 'page-1.json' : 'page-2.json';
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: await fixture(name),
  });
}

/** Records every OpenAlex request; `handler` decides the answer (recorded pages by default). */
async function mockOpenAlex(page: Page, handler: (route: Route) => Promise<void> = answer) {
  const requests: URL[] = [];
  await page.route('https://api.openalex.org/**', async (route) => {
    requests.push(new URL(route.request().url()));
    await handler(route);
  });
  return requests;
}

async function openOpenAlex(page: Page) {
  await page.goto('/projects/new');
  await page.getByLabel('Titel des Reviews').fill('OpenAlex-Test');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Suche' })
    .click();
  await page.getByRole('link', { name: 'In OpenAlex suchen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Suche in OpenAlex' })).toBeVisible();
}

const SEARCH = '"information literacy" AND (tutoring OR "peer teaching")';

async function fillSearch(page: Page) {
  await page.getByLabel('Suchstring').fill(SEARCH);
  await page.getByLabel('Erscheinungsjahr von').fill('2015');
  await page.getByLabel('Erscheinungsjahr bis').fill('2026');
  for (const type of ['Artikel', 'Buchkapitel', 'Preprint']) {
    await page.getByRole('checkbox', { name: type, exact: true }).check();
  }
}

test('searches, documents the run and imports the hits', async ({ page }) => {
  const requests = await mockOpenAlex(page);
  await openOpenAlex(page);
  await fillSearch(page);
  await page.getByText('Angaben für OpenAlex (nur in diesem Browser)').click();
  await page.getByLabel('E-Mail-Adresse (optional)').fill('ada@example.org');

  await page.getByRole('button', { name: 'Treffer zählen' }).click();
  await expect(page.getByRole('status')).toHaveText('3 Treffer in OpenAlex.');
  await expect(page.getByRole('listitem').filter({ hasText: 'Praxisbericht' })).toBeVisible();

  await page
    .getByRole('button', { name: '3 Treffer importieren und Suchlauf protokollieren' })
    .click();
  await expect(page.getByRole('status')).toContainText('3 Datensätze aus OpenAlex importiert');

  // Paging by cursor, limits as filters, the address only because it was entered.
  const cursors = requests.map((url) => url.searchParams.get('cursor'));
  expect(cursors).toHaveLength(3);
  expect(cursors.slice(0, 2)).toEqual([null, '*']);
  expect(cursors[2]).toMatch(/^\S+$/);
  for (const url of requests) {
    expect(url.searchParams.get('mailto')).toBe('ada@example.org');
    expect(url.searchParams.get('filter')).toContain('type:article|preprint|book-chapter');
  }

  // The run is documented in module 2 – verbatim, with limits and hits.
  await page.getByRole('link', { name: 'Zur Suchübersicht' }).click();
  const card = page.getByRole('article', { name: /OpenAlex/ });
  await expect(card).toContainText('OpenAlex API');
  await expect(card.getByRole('cell', { name: '3', exact: true }).first()).toBeVisible();
  await card.getByRole('link', { name: /Bearbeiten – Suchlauf vom/ }).click();
  await expect(page.getByLabel('Suchstring')).toHaveValue(`title_and_abstract.search:${SEARCH}`);
  await expect(page.getByLabel('Limits und Filter')).toHaveValue(
    /Erscheinungsjahr 2015–2026; Publikationstypen: article, preprint, book-chapter\nfilter=/,
  );
  await expect(page.getByLabel('Notizen')).not.toHaveValue(/mailto|ada@example\.org/);

  // The records are in the import module and can be deduplicated like file imports.
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Import' })
    .click();
  await expect(page.getByRole('main')).toContainText('OpenAlex-Suche');

  // The address stays in this browser: it is not part of the project export.
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Exporte' })
    .click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Projekt als JSON exportieren' }).click(),
  ]);
  const json = await readFile(await download.path(), 'utf8');
  expect(json).toContain('title_and_abstract.search:');
  expect(json).not.toContain('ada@example.org');
});

test('sends no e-mail address unless one is entered', async ({ page }) => {
  const requests = await mockOpenAlex(page);
  await openOpenAlex(page);
  await page.getByLabel('Suchstring').fill('tutoring');
  await page.getByRole('button', { name: 'Treffer zählen' }).click();
  await expect(page.getByRole('status')).toHaveText('3 Treffer in OpenAlex.');
  expect(requests).toHaveLength(1);
  expect(requests[0]!.searchParams.has('mailto')).toBe(false);
  expect(requests[0]!.searchParams.has('api_key')).toBe(false);
});

test('explains invalid searches before sending anything', async ({ page }) => {
  const requests = await mockOpenAlex(page);
  await openOpenAlex(page);
  await page.getByRole('button', { name: 'Treffer zählen' }).click();
  const summary = page.getByRole('alert');
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('Bitte einen Suchstring eingeben.');

  await page.getByLabel('Suchstring').fill('tutoring, grades');
  await page.getByLabel('Erscheinungsjahr von').fill('2020');
  await page.getByLabel('Erscheinungsjahr bis').fill('2010');
  await page.getByRole('button', { name: 'Treffer zählen' }).click();
  await expect(summary).toContainText('Kommas sind bei der Suche in Titel');
  await expect(summary).toContainText('Das Jahr „von“ liegt nach dem Jahr „bis“.');
  expect(requests).toHaveLength(0);
});

test('retries after a rate limit and saves nothing when OpenAlex fails', async ({ page }) => {
  let calls = 0;
  await mockOpenAlex(page, async (route) => {
    calls++;
    if (calls === 1) {
      await route.fulfill({
        status: 429,
        headers: { 'Retry-After': '0', 'Access-Control-Allow-Origin': '*' },
        body: await fixture('rate-limited.json'),
      });
    } else if (calls === 2) {
      await answer(route);
    } else {
      // A client error is not retried (server errors are, with back-off – see unit tests).
      await route.fulfill({ status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  });
  await openOpenAlex(page);
  await page.getByLabel('Suchstring').fill('tutoring');
  await page.getByRole('button', { name: 'Treffer zählen' }).click();
  await expect(page.getByRole('status')).toHaveText('3 Treffer in OpenAlex.');

  await page.getByRole('button', { name: /Treffer importieren/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'OpenAlex hat die Anfrage abgelehnt (HTTP 400). Es wurde nichts gespeichert.',
  );
  await page.getByRole('link', { name: 'Suche', exact: true }).first().click();
  await expect(page.getByText('Noch keine Quellen dokumentiert', { exact: false })).toBeVisible();
});

test('says that the search needs a connection when offline', async ({ page, context }) => {
  await mockOpenAlex(page);
  await openOpenAlex(page);
  await context.setOffline(true);
  await expect(page.getByText('Die OpenAlex-Suche braucht eine Internetverbindung.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Treffer zählen' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await context.setOffline(false);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`has no axe violations on the OpenAlex page (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockOpenAlex(page);
    await openOpenAlex(page);
    await fillSearch(page);
    await page.getByRole('button', { name: 'Treffer zählen' }).click();
    await expect(page.getByRole('status')).toHaveText('3 Treffer in OpenAlex.');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
