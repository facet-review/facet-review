import { readFile, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function createProject(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Neues Projekt' }).click();
  await page.getByLabel('Titel des Reviews').fill(title);
  await page.getByLabel('Autor:in').fill('Ada Lovelace');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projekt' })).toBeVisible();
}

async function waitForSave(page: Page) {
  await expect(
    page.getByRole('status').filter({ hasText: 'Alle Änderungen gespeichert.' }),
  ).toBeVisible();
}

async function exportFromOverview(page: Page, title: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: `Exportieren (JSON) – ${title}` }).click(),
  ]);
  return download;
}

test('requires a title when creating a project', async ({ page }) => {
  await page.goto('/projects/new');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(page.getByLabel('Titel des Reviews')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Bitte ausfüllen.')).toBeVisible();
});

test('creates a project, edits module 1 and keeps everything after reload', async ({ page }) => {
  await createProject(page, 'Tutoring und Schulerfolg');

  await page.getByLabel('Institution').fill('FH OÖ');
  await page.getByRole('textbox', { name: 'Forschungsfrage' }).fill('Wirkt Tutoring?');
  await page.getByRole('combobox', { name: 'Strukturierung' }).selectOption('PICO');
  await page.getByLabel('Population').fill('Studierende');
  await page.getByRole('button', { name: 'Einschlusskriterium hinzufügen' }).click();
  await expect(page.getByLabel('Einschlusskriterium 1')).toBeFocused();
  await page.keyboard.type('Randomisierte Studien');
  await page.getByLabel('Link zum Protokoll').fill('https://osf.io/abcd');
  await waitForSave(page);

  await page.reload();
  await expect(page.getByLabel('Institution')).toHaveValue('FH OÖ');
  await expect(page.getByRole('textbox', { name: 'Forschungsfrage' })).toHaveValue(
    'Wirkt Tutoring?',
  );
  await expect(page.getByRole('combobox', { name: 'Strukturierung' })).toHaveValue('PICO');
  await expect(page.getByLabel('Population')).toHaveValue('Studierende');
  await expect(page.getByLabel('Einschlusskriterium 1')).toHaveValue('Randomisierte Studien');
  await expect(page.getByLabel('Link zum Protokoll')).toHaveValue('https://osf.io/abcd');

  // Module navigation is project-scoped.
  const nav = page.getByRole('navigation', { name: 'Module' });
  await nav.getByRole('link', { name: 'Screening' }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/screening$/);
  await expect(nav.getByRole('link', { name: 'Screening' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('flags an invalid registration URL', async ({ page }) => {
  await createProject(page, 'URL-Test');
  await page.getByLabel('Link zur Registrierung').fill('osf.io/abcd');
  await expect(page.getByLabel('Link zur Registrierung')).toHaveAttribute('aria-invalid', 'true');
});

test('reorders exclusion reasons by keyboard', async ({ page }) => {
  await createProject(page, 'Sortier-Test');
  await expect(page.getByLabel('Ausschlussgrund 1')).toHaveValue('Falsche Population');
  await expect(page.getByLabel('Ausschlussgrund 2')).toHaveValue(
    'Falsche Intervention bzw. Exposition',
  );

  await page.getByRole('button', { name: 'Nach unten – Ausschlussgrund 1' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByLabel('Ausschlussgrund 1')).toHaveValue(
    'Falsche Intervention bzw. Exposition',
  );
  await expect(page.getByLabel('Ausschlussgrund 2')).toHaveValue('Falsche Population');
  // Focus follows the moved item.
  await expect(page.getByRole('button', { name: 'Nach unten – Ausschlussgrund 2' })).toBeFocused();
  await waitForSave(page);
  await page.reload();
  await expect(page.getByLabel('Ausschlussgrund 1')).toHaveValue(
    'Falsche Intervention bzw. Exposition',
  );
});

test('exports a project and imports it again as a copy', async ({ page }) => {
  await createProject(page, 'Export-Test');
  await page.getByLabel('Institution').fill('FH OÖ');
  await waitForSave(page);
  await page.getByRole('link', { name: 'Projektübersicht' }).click();

  const download = await exportFromOverview(page, 'Export-Test');
  expect(download.suggestedFilename()).toMatch(
    /^facet-review_export-test_\d{4}-\d{2}-\d{2}\.json$/,
  );
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.format).toBe('facet-review-project');
  expect(file.schemaVersion).toBe(1);
  expect(file.project.metadata.institution).toBe('FH OÖ');
  await expect(page.getByText('noch nie')).toHaveCount(0);

  await page.getByTestId('import-project-input').setInputFiles((await download.path())!);
  const dialog = page.getByRole('dialog', { name: 'Projekt bereits vorhanden' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Als Kopie importieren' }).click();

  await expect(page.getByRole('link', { name: 'Export-Test (Kopie)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export-Test', exact: true })).toBeVisible();
});

test('shows readable errors for a broken import file', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('broken.json');
  await writeFile(path, '{ "format": "facet-review-project", "schemaVersion": 99 }');
  await page.goto('/');
  await page.getByTestId('import-project-input').setInputFiles(path);
  await expect(page.getByRole('alert')).toContainText('neueren Version von Facet Review');
});

test('deletes a project after confirmation', async ({ page }) => {
  await createProject(page, 'Lösch-Test');
  await page.getByRole('link', { name: 'Projektübersicht' }).click();
  await page.getByRole('button', { name: 'Löschen – Lösch-Test' }).click();

  const dialog = page.getByRole('dialog', { name: 'Projekt löschen?' });
  await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();

  await expect(page.getByRole('link', { name: 'Lösch-Test' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('wurde gelöscht');
});

test('has no axe violations on the project page and dialogs', async ({ page }) => {
  await createProject(page, 'A11y-Test');
  await page.getByRole('combobox', { name: 'Strukturierung' }).selectOption('SPIDER');
  const axe = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect((await axe()).violations).toEqual([]);

  await page.getByRole('link', { name: 'Projektübersicht' }).click();
  await page.getByRole('button', { name: 'Löschen – A11y-Test' }).click();
  expect((await axe()).violations).toEqual([]);
});
