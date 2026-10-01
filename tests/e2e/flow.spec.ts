import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { decideAndWait, recordTitle, setUpScreening } from './helpers';

/** Synthetic data, three decisions: A included, C1 included, C2 excluded. */
async function setUpFlow(page: Page) {
  await setUpScreening(page);
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await decideAndWait(page, 'i', 'Informationskompetenz');
  await decideAndWait(page, 'i', 'INFORMATIONSKOMPETENZ');
  await decideAndWait(page, 'e', 'Peer review of search strategies');
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('link', { name: 'Flow-Diagramm' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Flow-Diagramm' })).toBeVisible();
}

const diagram = (page: Page) => page.getByRole('group', { name: /PRISMA-2020-Flow-Diagramm/ });

async function downloadText(page: Page, button: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ]);
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), 'utf8'),
  };
}

test('derives the diagram from the data, in English labels by default', async ({ page }) => {
  await setUpFlow(page);
  await expect(diagram(page)).toContainText('Records screened');
  await expect(
    diagram(page).getByRole('button', { name: /^Records screened \(n = 13\)/ }),
  ).toBeVisible();
  await expect(
    diagram(page).getByRole('button', { name: /^Records excluded \(n = 1\)/ }),
  ).toBeVisible();
  await expect(diagram(page)).toContainText('Testdatenbank (n = 16)');
  await expect(
    diagram(page).getByRole('button', { name: /Duplicate records removed \(n\s=\s3\)/ }),
  ).toBeVisible();
  await expect(diagram(page)).toContainText('Source: Page MJ, et al. BMJ 2021;372:n71.');
  // 13 units, 3 decided in stage 1; the two included ones are open in full text.
  await expect(
    page.getByText('10 Datensätze in Stufe 1 noch nicht entschieden', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText('2 Berichte in Stufe 2 noch nicht entschieden', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Records screened');

  // German labels are marked as a working translation.
  await page
    .getByRole('group', { name: 'Beschriftung des Diagramms' })
    .getByRole('button', { name: 'Deutsch' })
    .click();
  await expect(diagram(page)).toContainText('Gescreente Datensätze');
  await expect(diagram(page)).toContainText('Arbeitsübersetzung');
});

test('drills down from a box to its records and back, by keyboard', async ({ page }) => {
  await setUpFlow(page);
  const box = diagram(page).getByRole('button', { name: /^Records excluded/ });
  await box.focus();
  await page.keyboard.press('Enter');
  const heading = page.getByRole('heading', { name: 'Datensätze: Records excluded' });
  await expect(heading).toBeFocused();
  await expect(page.getByRole('region', { name: 'Datensätze: Records excluded' })).toContainText(
    'INFORMATIONSKOMPETENZ',
  );
  await page.getByRole('button', { name: 'Zurück zum Diagramm' }).click();
  await expect(box).toBeFocused();

  // The table offers the same drill-down per number.
  await page
    .getByRole('button', { name: 'Datensätze anzeigen – Duplicate records removed' })
    .click();
  await expect(page.getByRole('heading', { name: /^Datensätze: / })).toBeFocused();
  await expect(page.getByText('Duplicate records removed (n = 3)', { exact: true })).toBeVisible();
});

test('exports SVG, PNG and CSV with the attribution', async ({ page }) => {
  await setUpFlow(page);
  const csv = await downloadText(page, 'Zahlen als CSV exportieren');
  expect(csv.name).toMatch(/^facet-review-flow-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(csv.text).toContain('"Records screened","13"');
  expect(csv.text).toContain('Page MJ, et al. BMJ 2021;372:n71');
  expect(csv.text).toContain('CC BY 4.0');

  const svg = await downloadText(page, 'Als SVG exportieren');
  expect(svg.text).toContain('<svg');
  expect(svg.text).toContain('@font-face');
  expect(svg.text).toContain('CC BY 4.0');
  expect(svg.text).not.toContain('var(--');

  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Als PNG exportieren' }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const bytes = await readFile(await png.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});

test('shows manual numbers for update reviews', async ({ page }) => {
  await setUpFlow(page);
  await page.getByLabel('Variante').selectOption({ label: 'Update, nur Datenbanken und Register' });
  await page.getByLabel('Eingeschlossene Studien (vorherige Version)').fill('4');
  await page.getByLabel('Eingeschlossene Studien (vorherige Version)').blur();
  const table = page.getByRole('table');
  await expect(table).toContainText(
    'Studies included in previous version of review (n = 4) (entered manually)',
  );
  await expect(table).toContainText('Total studies included in review (n = 4)');
  await expect(diagram(page)).toContainText('Previous studies');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`has no axe violations on the flow page (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await setUpFlow(page);
    await diagram(page)
      .getByRole('button', { name: /^Records excluded/ })
      .click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
