import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openSearch(page: Page, title = 'Suchtest') {
  await page.goto('/projects/new');
  await page.getByLabel('Titel des Reviews').fill(title);
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Suche' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Suche' })).toBeVisible();
}

async function addSource(page: Page, type: string, name: string) {
  await page.getByRole('link', { name: 'Quelle hinzufügen' }).click();
  await page.getByLabel('Quellentyp').selectOption({ label: type });
  await page.getByLabel('Bezeichnung').fill(name);
}

const STRATEGY = 'S1  TI tutoring OR AB tutoring\nS2  TI grades\nS3  S1 AND S2';

test('documents a multi-database search with two runs', async ({ page }) => {
  await openSearch(page);
  await addSource(page, 'Bibliografische Datenbank (PRISMA-S Item 1, 2)', 'EBSCOhost');
  await page.getByLabel('Plattform bzw. Oberfläche').fill('EBSCOhost');
  await page.getByRole('button', { name: 'Datenbank hinzufügen' }).click();
  await page.keyboard.type('CINAHL');
  await page.getByRole('button', { name: 'Datenbank hinzufügen' }).click();
  await page.keyboard.type('ERIC');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Suchlauf erfassen' })).toBeVisible();
  await expect(page.getByText('Quelle: EBSCOhost (CINAHL, ERIC)')).toBeVisible();
  await page.getByLabel('Datum der Suche').fill('2026-09-01');
  await page.getByLabel('Suchstring').fill(STRATEGY);
  await page.getByLabel('Gemeldete Trefferzahl').fill('120');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();

  const card = page.getByRole('article', { name: 'EBSCOhost (CINAHL, ERIC)' });
  await expect(card.getByRole('cell', { name: '120' })).toBeVisible();

  await card.getByRole('link', { name: 'Suchlauf hinzufügen – EBSCOhost (CINAHL, ERIC)' }).click();
  await page.getByLabel('Datum der Suche').fill('2026-09-20');
  await page.getByLabel('Suchstring').fill(STRATEGY);
  await page.getByLabel('Gemeldete Trefferzahl').fill('5');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Suche' })).toBeVisible();

  await page.reload();
  await expect(card.getByText('20.09.2026', { exact: true })).toHaveCount(2); // last search + second row
  await expect(
    page.getByText('Gemeldete Treffer aus Datenbanken, Registern und Suchmaschinen: 125'),
  ).toBeVisible();

  // The strategy is stored verbatim, including double spaces and line breaks.
  await card.getByRole('link', { name: /Bearbeiten – Suchlauf vom 01\.09\.2026/ }).click();
  await expect(page.getByLabel('Suchstring')).toHaveValue(STRATEGY);
});

test('shows type-specific fields and blocks saving incomplete entries', async ({ page }) => {
  await openSearch(page);
  await page.getByRole('link', { name: 'Quelle hinzufügen' }).click();
  await page.getByLabel('Quellentyp').selectOption({ label: 'Zitationssuche (PRISMA-S Item 5)' });
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  const summary = page.getByRole('alert');
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('Bezeichnung: Bitte ausfüllen.');

  await page.getByLabel('Bezeichnung').fill('Rückwärtssuche');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  await expect(page.getByRole('group', { name: /Richtung/ })).toBeVisible();
  await expect(page.getByLabel('Suchstring')).toHaveCount(0);

  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Richtung: Bitte ausfüllen.');
  await expect(page.getByRole('alert')).toContainText('Ausgangsdokumente: Bitte ausfüllen.');
  await expect(page.getByRole('alert')).toContainText('Werkzeug: Bitte ausfüllen.');

  await page.getByLabel('Vorwärts und rückwärts').check();
  await page.getByLabel('Ausgangsdokumente').fill('Eingeschlossene Studien');
  await page.getByLabel('Werkzeug').fill('Citationchaser');
  await page.getByLabel('Datum bzw. Beginn').fill('2026-09-10');
  await page.getByLabel('Ende des Zeitraums').fill('2026-09-01');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Ende des Zeitraums: Das Ende darf nicht vor dem Beginn liegen.',
  );

  await page.getByLabel('Ende des Zeitraums').fill('2026-09-15');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Zitationssuche/ })).toBeVisible();
});

test('asks before discarding unsaved changes', async ({ page }) => {
  await openSearch(page);
  await addSource(page, 'Studienregister (PRISMA-S Item 3)', 'ClinicalTrials.gov');
  await page.getByRole('link', { name: 'Abbrechen' }).click();

  const dialog = page.getByRole('dialog', { name: 'Änderungen verwerfen?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByLabel('Bezeichnung')).toHaveValue('ClinicalTrials.gov');

  await page.getByRole('link', { name: 'Abbrechen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Suche' })).toBeVisible();
  await expect(page.getByText('Noch keine Quellen dokumentiert.')).toBeVisible();
});

test('deletes a source with its runs after confirmation', async ({ page }) => {
  await openSearch(page);
  await addSource(page, 'Sonstige Methode (PRISMA-S Item 7)', 'Handsuche');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  await page.getByLabel('Beschreibung').fill('Handsuche in drei Zeitschriften');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();

  await page.getByRole('button', { name: 'Quelle löschen – Handsuche' }).click();
  const dialog = page.getByRole('dialog', { name: 'Quelle löschen?' });
  await expect(dialog).toContainText('mit 1 Suchlauf gelöscht');
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByRole('status').first()).toContainText(
    'Quelle „Handsuche“ wurde gelöscht.',
  );
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('saves project-wide search information automatically', async ({ page }) => {
  await openSearch(page);
  await page.getByLabel('Peer Review der Suchstrategie').fill('PRESS, Bibliothek FH OÖ');
  await expect(page.getByText('Alle Änderungen gespeichert.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Peer Review der Suchstrategie')).toHaveValue(
    'PRESS, Bibliothek FH OÖ',
  );
});

test('exports sources and runs with the project', async ({ page }) => {
  await openSearch(page, 'Export Suche');
  await addSource(page, 'Suchmaschine (PRISMA-S Item 4)', 'Google Scholar');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  await page.getByLabel('Suchstring').fill('"peer tutoring" "higher education"');
  await page.getByLabel('Anzahl geprüfter Treffer').fill('200');
  await page.getByLabel('Werkzeug').fill('Publish or Perish');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();

  await page.getByRole('link', { name: 'Projektübersicht' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportieren (JSON) – Export Suche' }).click(),
  ]);
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.sources).toHaveLength(1);
  expect(file.sources[0]).toMatchObject({ type: 'search_engine', name: 'Google Scholar' });
  expect(file.sourceRuns[0]).toMatchObject({
    sourceId: file.sources[0].id,
    recordsChecked: 200,
    tool: 'Publish or Perish',
  });
  expect(file.sourceRuns[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('has no axe violations on the search page and run form', async ({ page }) => {
  await openSearch(page, 'A11y Suche');
  await addSource(page, 'Website oder Online-Ressource (PRISMA-S Item 4)', 'Eurydice');
  await page.getByLabel('Adresse (URL)').fill('https://eurydice.eacea.ec.europa.eu');
  await page.getByRole('button', { name: 'Speichern und Suchlauf erfassen' }).click();
  const axe = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click(); // show errors
  expect((await axe()).violations).toEqual([]);

  await page.getByLabel('Durchsehen (Browsing)').check();
  await page.getByLabel('Gemeldete Trefferzahl').fill('3');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Eurydice' })).toBeVisible();
  expect((await axe()).violations).toEqual([]);
});
