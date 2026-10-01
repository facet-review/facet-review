import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const FIXTURES = resolve(import.meta.dirname, '../fixtures');

async function setUpProject(page: Page, runs: { date: string; hits: string }[]) {
  await page.goto('/projects/new');
  await page.getByLabel('Titel des Reviews').fill('Importtest');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Suche' })
    .click();
  await page.getByRole('link', { name: 'Quelle hinzufügen' }).click();
  await page.getByLabel('Bezeichnung').fill('Testdatenbank');
  await page.getByLabel('Plattform bzw. Oberfläche').fill('Synthetisch');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  for (const [index, run] of runs.entries()) {
    if (index > 0) {
      await page.getByRole('link', { name: 'Suchlauf hinzufügen – Testdatenbank' }).click();
    }
    await page.getByLabel('Datum der Suche').fill(run.date);
    await page.getByLabel('Suchstring').fill(`test ${index + 1}`);
    await page.getByLabel('Gemeldete Trefferzahl').fill(run.hits);
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Suche' })).toBeVisible();
  }
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Import' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Import' })).toBeVisible();
}

async function importInto(page: Page, runLabel: string, file: string) {
  await page.getByRole('link', { name: `Datei importieren – Testdatenbank – ${runLabel}` }).click();
  await page.getByLabel('Exportdatei').setInputFiles(resolve(FIXTURES, file));
}

async function confirmImport(page: Page, count: number) {
  await page.getByRole('button', { name: `${count} Datensätze importieren` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Import' })).toBeVisible();
}

/** A count in the dedup summary of the import page. */
const stat = (page: Page, label: string) =>
  page.getByRole('region', { name: 'Deduplizierung' }).locator(`dt:text-is("${label}") + dd`);

test('imports the synthetic fixtures and reviews the documented duplicates', async ({ page }) => {
  await setUpProject(page, [
    { date: '2026-09-01', hits: '12' },
    { date: '2026-09-02', hits: '2' },
    { date: '2026-09-03', hits: '2' },
  ]);

  await importInto(page, '01.09.2026', 'synthetic/edge-cases.ris');
  await expect(page.getByText('Erkanntes Format: RIS · 12 Datensätze')).toBeVisible();
  await confirmImport(page, 12);
  await expect(page.getByRole('status').first()).toContainText(
    '12 Datensätze aus „edge-cases.ris“ importiert.',
  );

  await importInto(page, '02.09.2026', 'synthetic/edge-cases.nbib');
  await confirmImport(page, 2);

  await importInto(page, '03.09.2026', 'synthetic/edge-cases.csv');
  await expect(page.getByRole('group', { name: 'Spalten zuordnen' })).toBeVisible();
  await expect(page.getByLabel('Titel')).toHaveValue('0');
  await confirmImport(page, 2);

  // Expected after automatic deduplication (tests/fixtures/README.md).
  await expect(stat(page, 'Importiert')).toHaveText('16');
  await expect(stat(page, 'Dubletten entfernt')).toHaveText('3');
  await expect(stat(page, 'Offene Kandidaten')).toHaveText('2');

  await page.getByRole('link', { name: /Dubletten prüfen/ }).click();
  await expect(page.getByRole('heading', { name: 'Offene Kandidaten (2)' })).toBeVisible();
  const first = page.getByRole('article', { name: 'Kandidat 1 von 2' });
  await expect(first).toContainText('INFORMATIONSKOMPETENZ');
  await expect(page.getByRole('article', { name: 'Kandidat 2 von 2' })).toContainText(
    'unterschiedliche DOIs',
  );

  // Keyboard only: confirm C, keep D apart.
  await page.getByRole('button', { name: 'Zusammenführen – Kandidat 1 von 2' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Kandidat 1 von 1' })).toBeFocused();
  await expect(page.getByRole('article', { name: 'Kandidat 1 von 1' })).toContainText('randomized');
  await page.getByRole('button', { name: 'Getrennt lassen – Kandidat 1 von 1' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Offene Kandidaten (0)' })).toBeFocused();

  await expect(page.locator('dt:text-is("Eindeutige Datensätze") + dd')).toHaveText('12');
  await expect(page.getByRole('heading', { name: 'Als verschieden markiert (1)' })).toBeVisible();

  // Undo the last decision: D becomes a candidate again.
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('heading', { name: 'Offene Kandidaten (1)' })).toBeVisible();
  await expect(page.locator('dt:text-is("Eindeutige Datensätze") + dd')).toHaveText('12');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('requires a justification when imported and reported numbers differ', async ({ page }) => {
  await setUpProject(page, [{ date: '2026-09-01', hits: '20' }]);
  await importInto(page, '01.09.2026', 'synthetic/edge-cases.ris');
  await expect(page.getByText('Die importierte Anzahl weicht')).toBeVisible();
  await page.getByRole('button', { name: '12 Datensätze importieren' }).click();
  await expect(page.getByText('Bitte begründen Sie die Abweichung.')).toBeVisible();
  await page.getByLabel('Begründung der Abweichung').fill('Testdatei mit 12 von 20 Treffern');
  await confirmImport(page, 12);
  await expect(
    page.getByText('Abweichung begründet: Testdatei mit 12 von 20 Treffern'),
  ).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test('imports one search run from several files', async ({ page }) => {
  await setUpProject(page, [{ date: '2026-09-01', hits: '14' }]);
  await importInto(page, '01.09.2026', 'synthetic/edge-cases.nbib');
  await page.getByLabel('Für diesen Suchlauf folgen weitere Dateien').check();
  await confirmImport(page, 2);
  await expect(page.getByText('Abgleich: weicht ab')).toBeVisible();

  await importInto(page, '01.09.2026', 'synthetic/edge-cases.ris');
  await expect(page.getByText('Die importierte Anzahl weicht')).toHaveCount(0);
  await confirmImport(page, 12);
  await expect(page.getByText('Abgleich: stimmt überein')).toBeVisible();
});

test('undoes an import after confirmation', async ({ page }) => {
  await setUpProject(page, [{ date: '2026-09-01', hits: '2' }]);
  await importInto(page, '01.09.2026', 'synthetic/edge-cases.nbib');
  await confirmImport(page, 2);
  await page.getByRole('button', { name: 'Import rückgängig machen – edge-cases.nbib' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rückgängig machen' }).click();
  await expect(page.getByRole('status').first()).toContainText('rückgängig gemacht');
  await expect(page.getByText('Noch nichts importiert')).toBeVisible();
});

test('rejects files in an unknown format', async ({ page }, testInfo) => {
  await setUpProject(page, [{ date: '2026-09-01', hits: '1' }]);
  const path = testInfo.outputPath('notes.docx');
  await writeFile(path, 'not a bibliography');
  await page.getByRole('link', { name: 'Datei importieren – Testdatenbank – 01.09.2026' }).click();
  await page.getByLabel('Exportdatei').setInputFiles(path);
  await expect(page.getByRole('alert')).toContainText('Das Dateiformat wurde nicht erkannt.');
});

test('imports a real Scopus CSV export with automatic column mapping', async ({ page }) => {
  await setUpProject(page, [{ date: '2026-10-01', hits: '209' }]);
  await importInto(page, '01.10.2026', 'real/scopus_csv.csv');
  await expect(page.getByText('Erkanntes Format: CSV · 209 Datensätze')).toBeVisible();
  await expect(page.getByLabel('Autor:innen')).toHaveValue('1'); // "Author full names"
  await confirmImport(page, 209);
  await expect(page.getByText('Abgleich: stimmt überein')).toBeVisible();
  await expect(stat(page, 'Importiert')).toHaveText('209');
});
