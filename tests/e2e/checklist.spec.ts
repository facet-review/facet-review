import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { decideAndWait, recordTitle, setUpScreening } from './helpers';

async function openModule(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Module' }).getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}

async function downloadOf(page: Page, button: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ]);
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

/** Synthetic data, A and C1 included in both stages, C2 excluded. */
async function setUpProject(page: Page) {
  await setUpScreening(page);
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await decideAndWait(page, 'i', 'Informationskompetenz');
  await decideAndWait(page, 'i', 'INFORMATIONSKOMPETENZ');
  await decideAndWait(page, 'e', 'Peer review of search strategies');
  await page.getByRole('link', { name: 'Zur Liste' }).click();
  await page.getByRole('link', { name: /Stufe 2: Volltext/ }).click();
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await decideAndWait(page, 'i', 'Informationskompetenz');
  await page.keyboard.press('i');
  await expect(page.getByText('Das war der letzte Datensatz', { exact: false })).toBeVisible();
}

test('documents the checklist by keyboard and adopts suggestions only on request', async ({
  page,
}) => {
  await setUpProject(page);
  await openModule(page, 'Checkliste');
  await expect(page.getByText('Inoffizielle Arbeitsübersetzung', { exact: false })).toBeVisible();
  await expect(page.getByText('0 erledigt, 0 nicht zutreffend, 42 offen (von 42)')).toBeVisible();

  // Item 12: not applicable, by keyboard.
  const item12 = page.getByRole('article', { name: /^12 / });
  await item12.getByRole('radio', { name: 'Nicht zutreffend' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('1 erledigt', { exact: false })).toHaveCount(0);
  await expect(page.getByText('0 erledigt, 1 nicht zutreffend, 41 offen')).toBeVisible();

  // Item 6: own text first, then the suggestion asks before replacing it.
  const item6 = page.getByRole('article', { name: /^6 / });
  await item6.getByLabel('Wo berichtet').fill('S. 4');
  await item6.getByLabel('Notiz').fill('Eigener Text');
  await item6.getByLabel('Notiz').blur();
  await expect(
    item6.getByText('Testdatenbank (Synthetisch) – zuletzt durchsucht am 2026-09-01'),
  ).toBeVisible();
  await item6.getByRole('button', { name: /Vorschlag übernehmen \(ersetzt Eingaben\)/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Notiz');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(item6.getByLabel('Notiz')).toHaveValue('Eigener Text');
  await item6.getByRole('button', { name: /Vorschlag übernehmen/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ersetzen' }).click();
  await expect(item6.getByLabel('Notiz')).toHaveValue(/Testdatenbank/);
  await expect(item6.getByRole('radio', { name: 'Erledigt' })).toBeChecked();

  // The English original is available for every item.
  await item6.getByText('Englischer Originaltext').click();
  await expect(item6.locator('[lang="en"]')).toContainText('Specify all databases');

  await page.getByRole('button', { name: 'Offen', exact: true }).click();
  await expect(page.getByRole('article', { name: /^6 / })).toHaveCount(0);

  const pdf = await downloadOf(page, 'Checkliste als PDF exportieren');
  expect(pdf.name).toMatch(/^facet-review-checklist-.*\.pdf$/);
  expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
});

test('exports appendix, included studies and all records', async ({ page }) => {
  await setUpProject(page);
  await openModule(page, 'Exporte');

  const markdown = (await downloadOf(page, 'Suchanhang als Markdown')).bytes.toString('utf8');
  expect(markdown).toContain('```\ntest\n```');
  expect(markdown).toContain('Limits und Filter: Nicht dokumentiert');
  expect(markdown).toContain('Rethlefsen ML');

  const appendixPdf = await downloadOf(page, 'Suchanhang als PDF');
  expect(appendixPdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');

  const ris = (await downloadOf(page, 'Eingeschlossene Studien als RIS')).bytes.toString('utf8');
  expect(ris.match(/^TY {2}- /gm)).toHaveLength(2);
  expect(ris).toContain('N1  - Studie: eigene Studie');

  const included = (await downloadOf(page, 'Eingeschlossene Studien als CSV')).bytes.toString(
    'utf8',
  );
  expect(included.startsWith('\uFEFF"Studie";"Titel"')).toBe(true);
  expect(included).toContain('Page MJ');

  const csv = (await downloadOf(page, 'Alle Datensätze als CSV')).bytes.toString('utf8');
  expect(csv.split('\r\n').filter((line) => line.startsWith('"')).length).toBeGreaterThan(16);
  expect(csv).toContain('"eingeschlossen"');

  // Comma when chosen.
  await page.getByLabel('Trennzeichen für CSV').selectOption({ label: 'Komma (,)' });
  const comma = (await downloadOf(page, 'Eingeschlossene Studien als CSV')).bytes.toString('utf8');
  expect(comma.startsWith('﻿"Studie","Titel"')).toBe(true);
});

test('re-imports the exported RIS of included studies', async ({ page }) => {
  await setUpProject(page);
  await openModule(page, 'Exporte');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Eingeschlossene Studien als RIS' }).click(),
  ]);
  const path = await download.path();
  await openModule(page, 'Import');
  await page.getByRole('link', { name: 'Datei importieren – Testdatenbank – 01.09.2026' }).click();
  await page.getByLabel('Exportdatei').setInputFiles({
    name: 'included.ris',
    mimeType: 'application/x-research-info-systems',
    buffer: await readFile(path),
  });
  await expect(page.getByText('Erkanntes Format: RIS · 2 Datensätze')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`has no axe violations on checklist and exports (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await setUpScreening(page);
    for (const name of ['Checkliste', 'Exporte']) {
      await openModule(page, name);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });
}
