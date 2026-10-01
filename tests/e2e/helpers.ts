import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');

/** Project with one database search and the three synthetic files (16 records, 13 units). */
export async function setUpScreening(page: Page) {
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

export const recordTitle = (page: Page) => page.locator('#record-title');

/** Presses a decision key and waits until the next record is shown. */
export async function decideAndWait(page: Page, key: string, nextTitle: string) {
  await page.keyboard.press(key);
  await expect(recordTitle(page)).toContainText(nextTitle);
  // Focus moves to the title once the new view (and its shortcuts) is ready.
  await expect(recordTitle(page)).toBeFocused();
}
