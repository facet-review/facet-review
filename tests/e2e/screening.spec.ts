import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');

/** Project with one database search and the three synthetic files (16 records, 13 units). */
async function setUpScreening(page: Page) {
  await page.goto('/projects/new');
  await page.getByLabel('Titel des Reviews').fill('Screeningtest');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Suche' })
    .click();
  await page.getByRole('link', { name: 'Quelle hinzufügen' }).click();
  await page.getByLabel('Bezeichnung').fill('Testdatenbank');
  await page.getByLabel('Plattform bzw. Oberfläche').fill('Synthetisch');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  await page.getByLabel('Datum der Suche').fill('2026-09-01');
  await page.getByLabel('Suchstring').fill('test');
  await page.getByLabel('Gemeldete Trefferzahl').fill('16');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Suche' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Import' })
    .click();
  for (const [file, count] of [
    ['edge-cases.ris', 12],
    ['edge-cases.nbib', 2],
    ['edge-cases.csv', 2],
  ] as const) {
    await page
      .getByRole('link', { name: 'Datei importieren – Testdatenbank – 01.09.2026' })
      .click();
    await page.getByLabel('Exportdatei').setInputFiles(resolve(FIXTURES, 'synthetic', file));
    await page.getByRole('button', { name: `${count} Datensätze importieren` }).waitFor();
    // Shown only while fewer records than reported are imported.
    const more = page.getByLabel('Für diesen Suchlauf folgen weitere Dateien');
    if (await more.count()) await more.check();
    await page.getByRole('button', { name: `${count} Datensätze importieren` }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Import', exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Screening' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Screening' })).toBeVisible();
}

const recordTitle = (page: Page) => page.locator('#record-title');

/** Presses a decision key and waits until the next record is shown. */
async function decideAndWait(page: Page, key: string, nextTitle: string) {
  await page.keyboard.press(key);
  await expect(recordTitle(page)).toContainText(nextTitle);
  // Focus moves to the title once the new view (and its shortcuts) is ready.
  await expect(recordTitle(page)).toBeFocused();
}

test('screens title and abstract by keyboard only, with undo and highlighting', async ({
  page,
}) => {
  await setUpScreening(page);
  await expect(
    page.getByText('2 Dublettenkandidaten sind noch offen.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Stufe 1: Titel und Abstract/ })).toContainText(
    '0 von 13 entschieden',
  );

  // Highlight terms (project setting), then start.
  await page.getByLabel('Hervorheben: einschließende Begriffe').fill('systematic review*');
  await page.getByLabel('Hervorheben: ausschließende Begriffe').fill('editorial');
  await page.getByLabel('Hervorheben: ausschließende Begriffe').blur();
  await page.getByRole('link', { name: 'Screening starten' }).click();

  await expect(recordTitle(page)).toBeFocused();
  await expect(recordTitle(page)).toContainText('Reporting literature searches');
  await expect(recordTitle(page).locator('mark')).toHaveText('systematic reviews');
  await expect(page.getByText('Datensatz 1 von 13 (Offen)')).toBeVisible();

  await page.keyboard.press('i');
  await expect(recordTitle(page)).toContainText('Informationskompetenz');
  await expect(recordTitle(page)).toBeFocused();
  await expect(page.getByRole('status').first()).toHaveText('Eingeschlossen. Nächster Datensatz.');
  await decideAndWait(page, 'e', 'INFORMATIONSKOMPETENZ');
  await decideAndWait(page, 'm', 'Peer review of search strategies');

  // ← goes back to the record just marked "maybe", Z undoes the latest decision.
  await page.keyboard.press('ArrowLeft');
  await expect(recordTitle(page)).toContainText('INFORMATIONSKOMPETENZ');
  await expect(page.getByText('Aktuell: Vielleicht.')).toBeVisible();
  await page.keyboard.press('z');
  await expect(page.getByText('Noch nicht entschieden.')).toBeVisible();
  await page.getByText('Historie (2 Einträge)').click();
  await expect(page.getByText('Rückgängig', { exact: false }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Zur Liste' }).click();
  await expect(page.getByText('Fortschritt: 2 von 13 entschieden')).toBeVisible();
  await page.getByRole('button', { name: 'Ausgeschlossen', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Informationskompetenz');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('link', { name: /^Informationskompetenz/ }).click();
  const unitResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(unitResults.violations).toEqual([]);
});

test('single-key shortcuts can be turned off (WCAG 2.1.4)', async ({ page }) => {
  await setUpScreening(page);
  await page.getByLabel('Tastenkürzel mit einzelnen Tasten verwenden', { exact: false }).uncheck();
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await page.keyboard.press('i');
  await expect(page.getByText('Noch nicht entschieden.')).toBeVisible();
  await expect(recordTitle(page)).toContainText('Reporting literature searches');
  await page.getByRole('button', { name: 'Einschließen' }).click();
  await expect(recordTitle(page)).toContainText('Informationskompetenz');
});

test('locks full text while maybes are open, then screens full texts', async ({ page }) => {
  await setUpScreening(page);
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await decideAndWait(page, 'i', 'Informationskompetenz'); // A
  await decideAndWait(page, 'i', 'INFORMATIONSKOMPETENZ'); // C1
  await decideAndWait(page, 'm', 'Peer review of search strategies'); // C2
  await page.getByRole('link', { name: 'Zur Liste' }).click();

  await page.getByRole('link', { name: /Stufe 2: Volltext/ }).click();
  await expect(page.getByText('Stufe 2 ist gesperrt: 1 Datensatz', { exact: false })).toBeVisible();
  await page.getByLabel('„Vielleicht“-Einträge in Stufe 2', { exact: false }).check();
  await expect(page.getByText('Fortschritt: 0 von 3 entschieden')).toBeVisible();
  await expect(
    page.getByText('Datensätze sind in Stufe 1 noch nicht entschieden', { exact: false }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toContainText('Reporting literature searches');
  await expect(page.getByRole('link', { name: /DOI 10.5555/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open-Access-Version (Unpaywall)' })).toBeVisible();

  // E opens the mandatory reason picker; a digit picks the reason.
  await page.keyboard.press('e');
  await expect(page.getByRole('radio').first()).toBeFocused();
  await page.keyboard.press('2');
  await expect(recordTitle(page)).toContainText('Informationskompetenz');
  await expect(recordTitle(page)).toBeFocused();

  // N: not retrieved with an optional note.
  await page.keyboard.press('n');
  await page.getByLabel('Notiz (optional)', { exact: false }).fill('Fernleihe erfolglos');
  await page.keyboard.press('Enter');
  await expect(recordTitle(page)).toContainText('INFORMATIONSKOMPETENZ');
  await expect(recordTitle(page)).toBeFocused();
  await page.keyboard.press('i');

  // After the last record of the view, the overview reports it.
  await expect(
    page.getByText('Das war der letzte Datensatz dieser Ansicht.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Fortschritt: 3 von 3 entschieden')).toBeVisible();
  await page.getByRole('button', { name: 'Alle', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Nicht beschaffbar');

  // The used exclusion reason can no longer be removed in the project.
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Projekt' })
    .click();
  await expect(
    page.getByText('Wird in Screening-Entscheidungen verwendet', { exact: false }),
  ).toHaveCount(1);
});

test('turns contradicting decisions into a conflict when candidates are merged', async ({
  page,
}) => {
  await setUpScreening(page);
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await decideAndWait(page, 'i', 'Informationskompetenz'); // A
  await decideAndWait(page, 'i', 'INFORMATIONSKOMPETENZ'); // C1 included
  await decideAndWait(page, 'e', 'Peer review of search strategies'); // C2 excluded

  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Import' })
    .click();
  await page.getByRole('link', { name: /Dubletten prüfen/ }).click();
  await page.getByRole('button', { name: 'Zusammenführen – Kandidat 1 von 2' }).click();
  await expect(page.getByRole('heading', { name: 'Offene Kandidaten (1)' })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Screening' })
    .click();
  await page.getByRole('button', { name: 'Konflikt', exact: true }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await page.getByRole('table').getByRole('link').first().click();
  await expect(
    page.getByText('Konflikt: Diese Datensätze wurden als Dubletten zusammengeführt', {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ausschließen' }).click();

  // The conflict was the only entry of the "conflict" view: back on the overview.
  await expect(
    page.getByText('Das war der letzte Datensatz dieser Ansicht.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Fortschritt: 2 von 12 entschieden')).toBeVisible();
});
