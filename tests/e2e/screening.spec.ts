import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { decideAndWait, recordTitle, setUpScreening } from './helpers';

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
